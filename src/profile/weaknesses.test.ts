import { expect, test } from 'vitest';
import { HALF_LIFE_GAMES } from './recency';
import { NO_BAND_STATS, type BandStatsSource } from './bandStats';
import { TOP_WEAKNESSES, rankWeaknesses, topWeaknesses, type WeaknessContext } from './weaknesses';
import type { Theme } from '@/review/errorLog';
import { aGame, type GameSpec } from './testGames';
import type { ProfileGame } from './types';

function ctx(games: ProfileGame[], over: Partial<WeaknessContext> = {}): WeaknessContext {
  return {
    games,
    bucket: null,
    source: NO_BAND_STATS,
    comparisonsAllowed: false,
    early: false,
    ...over,
  };
}

/**
 * A game in which one theme occurs `n` times, each losing `dropPercent` win per
 * cent. The moves and the errors are built from the SAME plies, which is what the
 * join under test relies on.
 */
function themeGame(theme: Theme, n: number, dropPercent: number, over: GameSpec = {}): ProfileGame {
  return aGame({
    moves: Array.from({ length: n }, () => ({ label: 'Mistake' as const, drop: dropPercent, winBefore: 70 })),
    errors: Array.from({ length: n }, (_, i) => ({ theme, ply: i })),
    ...over,
  });
}

test('every error is paired with the move that caused it', () => {
  // The quiet failure this guards: an unmatched error contributes a zero loss and
  // its theme ranks last however often it happened. The audit is asserted rather
  // than assumed, because a join that silently missed would look like a learner
  // who simply makes cheap mistakes.
  const { join } = rankWeaknesses(
    ctx([themeGame('hung_piece', 4, 25), themeGame('missed_capture', 2, 40)]),
  );
  expect(join.unmatched).toBe(0);
  expect(join.matched).toBe(6);
});

test('POSITIVE CONTROL: the audit can report an unmatched error', () => {
  // Without this, `unmatched: 0` above would also be satisfied by an audit that
  // never increments. The error is put on a ply the learner did not move at.
  const g = aGame({ moves: [{ label: 'Mistake', drop: 30 }], errors: [{ theme: 'hung_piece', ply: 99 }] });
  const { join, weaknesses } = rankWeaknesses(ctx([g]));
  expect(join.unmatched).toBe(1);
  expect(join.matched).toBe(0);
  // And it still appears as a weakness, at zero cost rather than vanishing.
  expect(weaknesses[0]?.occurrences).toBe(1);
  expect(weaknesses[0]?.cost).toBe(0);
});

test('an opponent move at the same ply is not the learners loss', () => {
  // The join is scoped to the learner's own moves. If it were not, an error at
  // ply 3 would pick up whatever the bot did at ply 3 and cost would be fiction.
  const g = aGame({
    learner: 'w',
    moves: [
      { mover: 'b', drop: 90, label: 'Blunder' },
      { mover: 'w', drop: 10, label: 'Mistake' },
    ],
    errors: [{ theme: 'hung_piece', ply: 0 }],
  });
  const { join } = rankWeaknesses(ctx([g]));
  // Ply 0 belongs to Black here, so there is no learner move to join to.
  expect(join.unmatched).toBe(1);
});

test('the costliest weakness comes first', () => {
  const games = [themeGame('hung_piece', 2, 10), themeGame('missed_capture', 2, 60)];
  const ranked = topWeaknesses(ctx(games));
  expect(ranked[0]?.theme).toBe('missed_capture');
  expect(ranked[1]?.theme).toBe('hung_piece');
  expect(ranked[0]?.cost).toBeGreaterThan(ranked[1]?.cost ?? 0);
});

test('a frequent cheap weakness can outrank a rare expensive one', () => {
  // The "multiplied by" half of F-SW-3, which a ranking on severity alone fails.
  const games = [themeGame('hung_piece', 10, 12), themeGame('missed_mate', 1, 90)];
  expect(topWeaknesses(ctx(games))[0]?.theme).toBe('hung_piece');
});

test('recency changes the order, not just the numbers', () => {
  // Same theme counts, same losses, different positions in history. `games[0]` is
  // the most recent, so the theme in the newer game must win.
  const recentTheme = themeGame('ignored_threat', 3, 30);
  const oldTheme = themeGame('hung_piece', 3, 30);
  const filler = Array.from({ length: HALF_LIFE_GAMES * 3 }, () => aGame({}));
  const ranked = topWeaknesses(ctx([recentTheme, ...filler, oldTheme]));
  expect(ranked[0]?.theme).toBe('ignored_threat');
  // And swapping the two swaps the answer, which is what makes this about
  // recency rather than about the themes.
  const swapped = topWeaknesses(ctx([oldTheme, ...filler, recentTheme]));
  expect(swapped[0]?.theme).toBe('hung_piece');
});

test('only three weaknesses are returned, and fewer when fewer exist', () => {
  const four = [
    themeGame('hung_piece', 2, 50),
    themeGame('missed_capture', 2, 40),
    themeGame('missed_mate', 2, 30),
    themeGame('ignored_threat', 2, 20),
  ];
  expect(topWeaknesses(ctx(four))).toHaveLength(TOP_WEAKNESSES);
  // Non-vacuous: all four really did rank, so the slice is doing the limiting.
  expect(rankWeaknesses(ctx(four)).weaknesses).toHaveLength(4);
  // And a learner with one weakness is shown one, not three padded ones.
  expect(topWeaknesses(ctx([themeGame('hung_piece', 1, 20)]))).toHaveLength(1);
});

test('a learner with no errors at all has no weaknesses', () => {
  expect(topWeaknesses(ctx([aGame({}), aGame({})]))).toEqual([]);
  expect(topWeaknesses(ctx([]))).toEqual([]);
});

test('the count shown is the raw count and the games count is distinct games', () => {
  // F-SW-3 prints "9 times in 20 games". Both numbers, and neither is the
  // weighted one used for ranking.
  const games = [themeGame('hung_piece', 2, 20), themeGame('hung_piece', 3, 20), aGame({})];
  const w = topWeaknesses(ctx(games))[0];
  expect(w?.occurrences).toBe(5);
  expect(w?.games).toBe(2);
  expect(w?.weightedOccurrences).toBeLessThan(5);
});

test('each weakness carries a plain name, a lesson and a drill', () => {
  const w = topWeaknesses(ctx([themeGame('hung_piece', 2, 20)]))[0];
  expect(w?.name).toBe('Leaving pieces free to take');
  expect(w?.lessonId).toBe('1.2.4');
  expect(w?.lessonTitle).toBeTruthy();
  expect(w?.lessonTitle).not.toBe('1.2.4');
  expect(w?.drill?.to).toBe('/puzzles/fix');
});

test('an unclassified weakness is ranked and named, with no lesson', () => {
  // The common case: twelve of sixteen motifs are untagged. It must be visible
  // rather than dropped, because the cost is real even when the cause is not
  // nameable yet.
  const w = topWeaknesses(ctx([themeGame('unclassified', 5, 35)]))[0];
  expect(w?.theme).toBe('unclassified');
  expect(w?.occurrences).toBe(5);
  expect(w?.lessonId).toBeNull();
  // It still gets a drill: the learner's own positions are the drill.
  expect(w?.drill?.to).toBe('/puzzles/fix');
});

test('ties are broken deterministically, not by map order', () => {
  // Reachable: every error a Miss the engine scored at no loss gives two themes
  // an identical cost of zero. Map order would then decide which weakness the
  // learner is told to fix first, and it would change with game order.
  const build = (order: 0 | 1) => {
    const a = themeGame('hung_piece', 1, 0);
    const b = themeGame('missed_capture', 1, 0);
    return rankWeaknesses(ctx(order === 0 ? [a, b] : [b, a])).weaknesses.map((w) => w.theme);
  };
  expect(build(0)).toEqual(build(1));
});

// ── F-SW-5's flag ───────────────────────────────────────────────────────────

test('with no band statistics the typical-for-level flag is unknown', () => {
  const w = topWeaknesses(ctx([themeGame('hung_piece', 3, 20)]))[0];
  expect(w?.typicalForLevel).toEqual({ known: false });
});

test('the flag stays unknown even with band statistics when F-SW-6 forbids comparisons', () => {
  // The sample-size gate must apply to the flag too. A flag shown under ten games
  // would be the comparison F-SW-6 says not to make, wearing a different hat.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  const w = topWeaknesses(
    ctx([themeGame('hung_piece', 3, 20)], {
      source,
      bucket: { floor: 800, name: '800s' },
      comparisonsAllowed: false,
    }),
  )[0];
  expect(w?.typicalForLevel).toEqual({ known: false });
});

test('POSITIVE CONTROL: with statistics and a big enough sample the flag is known and worded', () => {
  // The three tests above assert `{ known: false }`. Without this one, a
  // `typicalForLevel` that returned `{ known: false }` unconditionally would pass
  // all three and the mechanism F-SW-3 asks for would be dead on arrival.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 3 };
  const w = topWeaknesses(
    ctx([themeGame('hung_piece', 3, 20)], {
      source,
      bucket: { floor: 800, name: '800s' },
      comparisonsAllowed: true,
    }),
  )[0];
  expect(w?.typicalForLevel.known).toBe(true);
  if (w?.typicalForLevel.known === true) {
    // Three occurrences over one game is a rate of 3, the same as the population,
    // so this is typical at the level — and the wording says so in words.
    expect(w.typicalForLevel.typical).toBe(true);
    expect(w.typicalForLevel.wording).toContain('most 800s');
    expect(w.typicalForLevel.wording).toContain('about as often as');
  }
});

test('a rate well away from the population reads as unusual for the level', () => {
  const source: BandStatsSource = { hasData: true, typicalFor: () => 0.2 };
  const w = topWeaknesses(
    ctx([themeGame('hung_piece', 3, 20)], {
      source,
      bucket: { floor: 800, name: '800s' },
      comparisonsAllowed: true,
    }),
  )[0];
  expect(w?.typicalForLevel.known).toBe(true);
  if (w?.typicalForLevel.known === true) {
    expect(w.typicalForLevel.typical).toBe(false);
    expect(w.typicalForLevel.wording).toContain('far more often than');
  }
});

test('unclassified never gets a typical-for-level flag, even with full band data', () => {
  // No population statistic could be mined for "mistakes this app's tagger could
  // not name", because the category is a property of our own coverage.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  const w = topWeaknesses(
    ctx([themeGame('unclassified', 3, 20)], {
      source,
      bucket: { floor: 800, name: '800s' },
      comparisonsAllowed: true,
    }),
  )[0];
  expect(w?.theme).toBe('unclassified');
  expect(w?.typicalForLevel).toEqual({ known: false });
});

test('a source that declares it has no data cannot produce a flag, whatever it returns', () => {
  // The defective-source case, not the well-behaved one. NO_BAND_STATS returns
  // null from typicalFor as well as declaring hasData false, so it exercises both
  // gates at once and tells them apart in neither direction — which is how an
  // earlier draft carried an unreachable duplicate check for two hours.
  const lying: BandStatsSource = { hasData: false, typicalFor: () => 2 };
  const w = topWeaknesses(
    ctx([themeGame('hung_piece', 2, 20)], {
      source: lying,
      bucket: { floor: 800, name: '800s' },
      comparisonsAllowed: true,
    }),
  )[0];
  expect(w?.typicalForLevel).toEqual({ known: false });
});

test('the flag is not ErrorEntry.typical wearing a different name', () => {
  // src/review/errorLog.ts sets `typical: true` on all four tagged themes — it
  // records that the curriculum teaches the theme, and its own comment says it is
  // "never about other learners". If the profile read that field, this weakness
  // would arrive with `known: true` and a sentence about other players.
  const g = themeGame('hung_piece', 2, 20);
  expect(g.review.errors.every((e) => e.typical)).toBe(true);
  const w = topWeaknesses(ctx([g]))[0];
  expect(w?.typicalForLevel).toEqual({ known: false });
});

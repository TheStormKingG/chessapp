import { expect, test } from 'vitest';
import { WINNING_WIN_PERCENT } from '@/review/keyMoments';
import {
  LINES_PER_COLOUR,
  isForcing,
  meanOf,
  measureGame,
  openingLines,
  ratePerGame,
  totalsOf,
} from './metrics';
import { aGame } from './testGames';

// ── The fixture itself, checked before anything is measured with it ──────────

test('the fixture attributes moves to the learner, so a zero count means zero', () => {
  // The failure this guards is the one that makes every other test in the file
  // pass for the wrong reason: a fixture whose moves belong to the opponent
  // produces zero for every learner metric, and a test expecting zero is happy.
  const g = measureGame(aGame({ learner: 'b', moves: [{ label: 'Blunder' }, { label: 'Blunder' }] }));
  expect(g.learner).toBe('b');
  expect(g.blunders).toBe(2);
});

// ── isForcing ───────────────────────────────────────────────────────────────

test('captures, checks and mates are forcing; quiet moves are not', () => {
  for (const san of ['exd5', 'Nxe5', 'Qh5+', 'Rd8#', 'Bxf7+', 'cxb8=Q+']) {
    expect(isForcing(san), san).toBe(true);
  }
  for (const san of ['Nf3', 'e4', 'O-O', 'Rfd1', 'a8=Q', 'Kh1']) {
    expect(isForcing(san), san).toBe(false);
  }
});

// ── One game ────────────────────────────────────────────────────────────────

test('the opponents moves are never counted as the learners', () => {
  // Review.counts counts both sides. Reading it would roughly double a learner's
  // blunders, so the module filters on `mover`. This is the test that notices.
  const g = measureGame(
    aGame({
      learner: 'w',
      moves: [
        { label: 'Blunder', mover: 'w' },
        { label: 'Blunder', mover: 'b' },
        { label: 'Blunder', mover: 'b' },
        { label: 'Mistake', mover: 'b' },
      ],
    }),
  );
  expect(g.blunders).toBe(1);
  expect(g.mistakes).toBe(0);
});

test('book moves are excluded from the accuracy denominator', () => {
  // The review layer's own definition: `derivedFrom` averages non-book moves.
  // A book move scores 100, so including them would inflate every accuracy.
  const g = measureGame(
    aGame({
      moves: [
        { book: true, accuracy: 100, phase: 'opening' },
        { book: true, accuracy: 100, phase: 'opening' },
        { accuracy: 50, phase: 'opening' },
      ],
    }),
  );
  expect(g.ownMoves).toBe(1);
  expect(g.accuracyByPhase.opening).toBe(50);
});

test('accuracy is reported per phase and is null for a phase never reached', () => {
  const g = measureGame(
    aGame({
      moves: [
        { accuracy: 90, phase: 'opening' },
        { accuracy: 70, phase: 'middlegame' },
        { accuracy: 50, phase: 'middlegame' },
      ],
    }),
  );
  expect(g.accuracyByPhase.opening).toBe(90);
  expect(g.accuracyByPhase.middlegame).toBe(60);
  // Null, not zero. A game that never reached an endgame has no endgame accuracy,
  // and zero would read as "played the endgame terribly".
  expect(g.accuracyByPhase.endgame).toBeNull();
});

test('a blunder counts as made in a winning position only above the shared threshold', () => {
  // The threshold is imported from src/review/keyMoments.ts, so this pins that
  // the profile uses the review layer's definition of "winning" and not a second
  // one of its own.
  const above = measureGame(aGame({ moves: [{ label: 'Blunder', winBefore: WINNING_WIN_PERCENT }] }));
  const below = measureGame(aGame({ moves: [{ label: 'Blunder', winBefore: WINNING_WIN_PERCENT - 1 }] }));
  expect(above.blundersWhenWinning).toBe(1);
  expect(above.everWinning).toBe(true);
  expect(below.blundersWhenWinning).toBe(0);
  expect(below.everWinning).toBe(false);
  // A non-blunder from a winning position is still a winning position.
  expect(measureGame(aGame({ moves: [{ label: 'Best', winBefore: 95 }] })).everWinning).toBe(true);
});

test('accuracy in positions with no forcing move ignores positions that had one', () => {
  const g = measureGame(
    aGame({
      moves: [
        { accuracy: 40, san: 'Nxe5', bestSan: 'Nf3' }, // played a capture
        { accuracy: 40, san: 'Nf3', bestSan: 'Qh5+' }, // best was a check
        { accuracy: 80, san: 'Rd1', bestSan: 'Rc1' }, // quiet
        { accuracy: 90, san: 'h3', bestSan: 'a4' }, // quiet
      ],
    }),
  );
  expect(g.noForcingMoves).toBe(2);
  expect(g.accuracyNoForcingMove).toBe(85);
  // Non-vacuous: both forcing moves were excluded, and their accuracy differs
  // from the answer, so a filter that matched everything would give 62.5.
  expect(g.accuracyNoForcingMove).not.toBe(62.5);
});

test('an unknown error theme folds into unclassified instead of vanishing', () => {
  // ErrorEntry.theme is a bare string on the stored row. A count that vanished
  // would understate the learner's cost, which is the one direction that matters.
  const g = aGame({ errors: [{ theme: 'hung_piece' }] });
  // Reach past the spec to write a theme no build has ever produced.
  const rewritten = {
    ...g,
    review: { ...g.review, errors: g.review.errors.map((e) => ({ ...e, theme: 'pin_from_2031' })) },
  };
  const m = measureGame(rewritten);
  expect(m.themeCounts.unclassified).toBe(1);
  expect(m.themeCounts.hung_piece).toBe(0);
  // Positive control: the same fixture left alone lands in hung_piece, so the
  // assertion above is about the unknown theme and not about a broken fixture.
  expect(measureGame(g).themeCounts.hung_piece).toBe(1);
});

test('strong moves found come from the found key moments, not from labels', () => {
  expect(measureGame(aGame({ found: 3 })).strongMovesFound).toBe(3);
  expect(measureGame(aGame({ moves: [{ label: 'Best' }, { label: 'Best' }] })).strongMovesFound).toBe(0);
});

// ── Aggregation ─────────────────────────────────────────────────────────────

test('a mean over games skips the games that have no value, and is null when none do', () => {
  expect(meanOf([{ v: 10 }, { v: null }, { v: 20 }], (x) => x.v)).toBe(15);
  expect(meanOf([{ v: null }, { v: null }], (x) => x.v)).toBeNull();
  expect(meanOf([], (x: { v: number | null }) => x.v)).toBeNull();
});

test('a rate over zero games is null, never zero', () => {
  // Zero would read as a measurement — "you never hang pieces" — from a learner
  // who has played nothing.
  expect(ratePerGame(0, 0)).toBeNull();
  expect(ratePerGame(5, 0)).toBeNull();
  expect(ratePerGame(3, 4)).toBe(0.75);
  expect(ratePerGame(0, 4)).toBe(0);
});

test('totals count both occurrences and the games they happened in', () => {
  // The two are different and F-SW-3 prints both: "9 times in 20 games".
  const t = totalsOf(
    [
      aGame({ errors: [{ theme: 'hung_piece' }, { theme: 'hung_piece' }] }),
      aGame({ errors: [{ theme: 'hung_piece' }] }),
      aGame({ errors: [{ theme: 'missed_mate' }] }),
    ].map(measureGame),
  );
  expect(t.games).toBe(3);
  expect(t.themeCounts.hung_piece).toBe(3);
  expect(t.themeGames.hung_piece).toBe(2);
  expect(t.themeCounts.missed_mate).toBe(1);
  expect(t.themeGames.missed_mate).toBe(1);
  expect(t.themeCounts.ignored_threat).toBe(0);
});

test('conversion of winning positions counts only the games that had one', () => {
  const t = totalsOf(
    [
      aGame({ result: 'win', moves: [{ winBefore: 95 }] }),
      aGame({ result: 'loss', moves: [{ winBefore: 95 }] }),
      aGame({ result: 'draw', moves: [{ winBefore: 95 }] }),
      // Never winning: must not appear in either number, which is what stops the
      // denominator being "all games" and the rate being meaningless.
      aGame({ result: 'loss', moves: [{ winBefore: 20 }] }),
    ].map(measureGame),
  );
  expect(t.winningPositions).toBe(3);
  expect(t.winningPositionsWon).toBe(1);
  expect(t.games).toBe(4);
});

test('partial games are counted, so a floor can be declared as a floor', () => {
  const t = totalsOf([aGame({ partial: true }), aGame(), aGame({ partial: true })].map(measureGame));
  expect(t.partialGames).toBe(2);
});

// ── Openings ────────────────────────────────────────────────────────────────

test('opening lines are grouped by name AND colour', () => {
  // The same opening played from both sides is two different repertoire problems.
  // Grouping on name alone would merge a learner's French as White with their
  // French as Black and report one meaningless accuracy.
  const lines = openingLines(
    [
      aGame({ learner: 'w', opening: { name: 'Italian Game', leftBookAtPly: 10 }, result: 'win' }),
      aGame({ learner: 'b', opening: { name: 'Italian Game', leftBookAtPly: 8 }, result: 'loss' }),
    ].map(measureGame),
  );
  expect(lines).toHaveLength(2);
  expect(lines.filter((l) => l.colour === 'w')[0]?.wins).toBe(1);
  expect(lines.filter((l) => l.colour === 'b')[0]?.losses).toBe(1);
});

test('five lines per colour, not five in total', () => {
  // "as White and Black" — a settled White repertoire must not crowd out every
  // Black line, which is what a global top five would do.
  const many = [
    ...Array.from({ length: 8 }, (_, i) =>
      aGame({ learner: 'w', opening: { name: `White line ${String(i)}`, leftBookAtPly: 6 } }),
    ),
    ...Array.from({ length: 7 }, (_, i) =>
      aGame({ learner: 'b', opening: { name: `Black line ${String(i)}`, leftBookAtPly: 6 } }),
    ),
  ].map(measureGame);
  const lines = openingLines(many);
  expect(lines.filter((l) => l.colour === 'w')).toHaveLength(LINES_PER_COLOUR);
  expect(lines.filter((l) => l.colour === 'b')).toHaveLength(LINES_PER_COLOUR);
});

test('the most played lines are the ones kept', () => {
  const played = (name: string, n: number) =>
    Array.from({ length: n }, () => aGame({ learner: 'w', opening: { name, leftBookAtPly: 6 } }));
  const lines = openingLines(
    [
      ...played('Rare', 1),
      ...played('Common', 9),
      ...played('Middling', 4),
      ...played('A', 1),
      ...played('B', 1),
      ...played('C', 1),
      ...played('D', 1),
    ].map(measureGame),
  );
  const white = lines.filter((l) => l.colour === 'w');
  expect(white).toHaveLength(LINES_PER_COLOUR);
  expect(white[0]?.name).toBe('Common');
  expect(white[0]?.games).toBe(9);
  expect(white[1]?.name).toBe('Middling');
  // The nine-game line is in and at least one one-game line is out.
  expect(white.map((l) => l.name)).not.toContain('D');
});

test('the move the learner usually leaves the book is a median, not a mean', () => {
  // One game that followed a line to move twenty-five would drag a mean well past
  // where the learner typically departs. F-SW-4's word is "usually".
  const lines = openingLines(
    [
      aGame({ learner: 'w', opening: { name: 'Line', leftBookAtPly: 8 } }), // move 5
      aGame({ learner: 'w', opening: { name: 'Line', leftBookAtPly: 10 } }), // move 6
      aGame({ learner: 'w', opening: { name: 'Line', leftBookAtPly: 60 } }), // move 31
    ].map(measureGame),
  );
  expect(lines[0]?.leavesBookAtMove).toBe(6);
  // The mean would be 14, so the assertion discriminates.
  expect(lines[0]?.leavesBookAtMove).not.toBe(14);
});

test('a line the learner never left the book in reports no departure move', () => {
  const lines = openingLines(
    [aGame({ learner: 'w', opening: { name: 'Line', leftBookAtPly: null } })].map(measureGame),
  );
  expect(lines[0]?.leavesBookAtMove).toBeNull();
  expect(lines[0]?.games).toBe(1);
});

test('games with no opening name are omitted, not pooled into an Unknown line', () => {
  // The book is fetched at runtime and is absent offline, so an "Unknown" bucket
  // would measure the learner's network rather than their openings.
  const lines = openingLines(
    [
      aGame({ learner: 'w', opening: null }),
      aGame({ learner: 'w', opening: null }),
      aGame({ learner: 'w', opening: { name: 'Italian Game', leftBookAtPly: 9 } }),
    ].map(measureGame),
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]?.name).toBe('Italian Game');
  expect(lines[0]?.games).toBe(1);
  expect(lines.map((l) => l.name)).not.toContain('Unknown');
});

test('line order is stable when two lines are played equally often', () => {
  // Otherwise the order follows Map insertion, which follows game order, and the
  // list reshuffles on every new game for no reason the learner can see.
  const build = () =>
    openingLines(
      [
        aGame({ learner: 'w', opening: { name: 'Zukertort', leftBookAtPly: 6 } }),
        aGame({ learner: 'w', opening: { name: 'Alekhine', leftBookAtPly: 6 } }),
      ].map(measureGame),
    ).map((l) => l.name);
  expect(build()).toEqual(['Alekhine', 'Zukertort']);
  expect(build()).toEqual(['Alekhine', 'Zukertort']);
});

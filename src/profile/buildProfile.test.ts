import { expect, test } from 'vitest';
import { SKILL_IDS } from './types';
import { NO_BAND_STATS, type BandStatsSource } from './bandStats';
import { COMPARISON_MIN_GAMES, LABEL_DROP_GAMES } from './sampleSize';
import { buildProfile } from './buildProfile';
import { aGame, games, type GameSpec } from './testGames';

const withTheme: GameSpec = {
  moves: [{ label: 'Mistake', drop: 30, winBefore: 70 }],
  errors: [{ theme: 'hung_piece', ply: 0 }],
};

test('the profile says how many games it rests on', () => {
  // F-SW-6's first sentence.
  expect(buildProfile(games(7)).games).toBe(7);
  expect(buildProfile([]).games).toBe(0);
});

test('bullet games are excluded by default and included by the switch', () => {
  // F-IM-2: their errors are clock-driven rather than skill-driven.
  const mixed = [
    aGame({ speed: 'bullet', ...withTheme }),
    aGame({ speed: 'bullet', ...withTheme }),
    aGame({ speed: 'rapid', ...withTheme }),
  ];
  expect(buildProfile(mixed).games).toBe(1);
  expect(buildProfile(mixed, { includeBullet: true }).games).toBe(3);
  // And the exclusion reaches the weaknesses, not just the count.
  expect(buildProfile(mixed).weaknesses[0]?.occurrences).toBe(1);
  expect(buildProfile(mixed, { includeBullet: true }).weaknesses[0]?.occurrences).toBe(3);
});

test('games are ordered newest first whatever order they arrive in', () => {
  // The failure this prevents: a caller handing over Dexie's natural order would
  // invert the recency weighting, and every number would still look plausible.
  const older = aGame({ gameId: 'older', playedAt: '2026-01-01T00:00:00.000Z' });
  const newer = aGame({ gameId: 'newer', playedAt: '2026-06-01T00:00:00.000Z' });
  expect(buildProfile([older, newer]).gameIds).toEqual(['newer', 'older']);
  expect(buildProfile([newer, older]).gameIds).toEqual(['newer', 'older']);
});

test('games played at the same instant get a total order', () => {
  // chess.com's daily games carry a date and no time, so this is reachable. An
  // unstable order would move a weakness up or down between renders.
  const same = '2026-03-03T00:00:00.000Z';
  const a = aGame({ gameId: 'aaa', playedAt: same });
  const b = aGame({ gameId: 'bbb', playedAt: same });
  expect(buildProfile([a, b]).gameIds).toEqual(buildProfile([b, a]).gameIds);
});

test('recency follows when the game was PLAYED, not the order it was handed over', () => {
  // The whole point of sorting on playedAt: an imported back-catalogue arrives in
  // whatever order the provider walked its archives.
  const recentTheme = aGame({
    gameId: 'recent',
    playedAt: '2026-09-01T00:00:00.000Z',
    moves: [{ label: 'Mistake', drop: 30, winBefore: 70 }],
    errors: [{ theme: 'ignored_threat', ply: 0 }],
  });
  const oldTheme = aGame({
    gameId: 'old',
    playedAt: '2020-01-01T00:00:00.000Z',
    moves: [{ label: 'Mistake', drop: 30, winBefore: 70 }],
    errors: [{ theme: 'hung_piece', ply: 0 }],
  });
  const filler = games(25, (i) => ({ gameId: `f${String(i)}`, playedAt: `2023-01-${String(10 + (i % 20)).padStart(2, '0')}T00:00:00.000Z` }));
  // Handed over oldest-theme-first, which is the order that would break it.
  const p = buildProfile([oldTheme, ...filler, recentTheme]);
  expect(p.weaknesses[0]?.theme).toBe('ignored_threat');
});

// ── F-SW-6 at the boundaries, through the whole projection ──────────────────

test('the sample-size rule reaches the assembled profile, not just its own module', () => {
  // The spine is unit-tested in sampleSize.test.ts. This is the different claim:
  // that buildProfile actually applies it. A profile that computed confidence and
  // then ignored it would pass every test in that file.
  for (const [n, comparisons, label] of [
    [0, false, null],
    [COMPARISON_MIN_GAMES - 1, false, null],
    [COMPARISON_MIN_GAMES, true, 'early'],
    [LABEL_DROP_GAMES - 1, true, 'early'],
    [LABEL_DROP_GAMES, true, null],
  ] as const) {
    const p = buildProfile(games(n));
    expect(p.confidence.games, `n=${String(n)}`).toBe(n);
    expect(p.confidence.comparisons, `n=${String(n)}`).toBe(comparisons);
    expect(p.confidence.label, `n=${String(n)}`).toBe(label);
  }
});

test('with the shipped band source no comparison is shown at any sample size', () => {
  for (const n of [0, 9, 10, 29, 30, 60]) {
    const p = buildProfile(games(n), { rating: 800, source: NO_BAND_STATS });
    expect(p.comparisons.shown, `n=${String(n)}`).toBe(false);
  }
  // And the reason is the honest one above ten games.
  const big = buildProfile(games(40), { rating: 800 });
  expect(big.comparisons).toEqual({ shown: false, reason: 'no-band-data' });
  const small = buildProfile(games(4), { rating: 800 });
  expect(small).toMatchObject({ comparisons: { shown: false, reason: 'too-few-games' } });
});

test('no row and no weakness in a shipped profile carries a comparison', () => {
  // The end-to-end honesty check. Fourteen rows across six skills, three
  // weaknesses, three strengths: not one of them may claim anything about other
  // players while there are no statistics.
  const p = buildProfile(games(40, () => withTheme), { rating: 800 });
  const rows = p.skills.flatMap((s) => s.rows);
  expect(rows.length).toBeGreaterThan(5);
  for (const r of rows) expect(r.comparison, r.label).toBeNull();
  for (const w of p.weaknesses) expect(w.typicalForLevel, w.name).toEqual({ known: false });
  for (const s of p.strengths) expect(s.text, s.id).not.toContain('800s');
});

test('POSITIVE CONTROL: with statistics the whole profile does compare', () => {
  // Without this, the test above is a statement about a dead mechanism rather than
  // about absent data — and it would keep passing on the day the statistics land.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  const p = buildProfile(games(40, () => withTheme), { rating: 842, source });
  expect(p.comparisons).toEqual({ shown: true, label: null });
  const rows = p.skills.flatMap((s) => s.rows);
  const compared = rows.filter((r) => r.comparison !== null);
  expect(compared.length).toBeGreaterThan(0);
  expect(compared[0]?.comparison).toContain('most 800s');
  expect(p.weaknesses.some((w) => w.typicalForLevel.known)).toBe(true);
});

test('under ten games the assembled profile shows no comparison even with full statistics', () => {
  // Found by mutation: hardcoding `comparisonsAllowed: true` in buildProfile broke
  // nothing, because every test that expected no comparisons also used a source
  // with no data. This is F-SW-6's actual rule reaching the screen: statistics
  // present, rating present, sample too small.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  const p = buildProfile(games(COMPARISON_MIN_GAMES - 1, () => withTheme), { rating: 800, source });
  expect(p.comparisons).toEqual({ shown: false, reason: 'too-few-games' });
  for (const r of p.skills.flatMap((s) => s.rows)) expect(r.comparison, r.label).toBeNull();
  for (const w of p.weaknesses) expect(w.typicalForLevel, w.name).toEqual({ known: false });
  for (const s of p.strengths) expect(s.text, s.id).not.toContain('800s');
  // Positive control: one more game and the same context does compare, so the
  // nulls above are the sample-size gate and not the fixture.
  const one_more = buildProfile(games(COMPARISON_MIN_GAMES, () => withTheme), { rating: 800, source });
  expect(one_more.skills.flatMap((s) => s.rows).some((r) => r.comparison !== null)).toBe(true);
});

test('the early label reaches the comparison sentences between ten and thirty games', () => {
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  const early = buildProfile(games(12, () => withTheme), { rating: 800, source });
  expect(early.comparisons).toEqual({ shown: true, label: 'early' });
  const sentence = early.skills.flatMap((s) => s.rows).find((r) => r.comparison !== null)?.comparison;
  expect(sentence).toContain('early');

  const settled = buildProfile(games(40, () => withTheme), { rating: 800, source });
  const settledSentence = settled.skills.flatMap((s) => s.rows).find((r) => r.comparison !== null)?.comparison;
  expect(settledSentence).not.toContain('early');
});

test('a rating with no band statistics is not enough, and statistics with no rating are not either', () => {
  // Both halves of F-SW-5's input. Either missing means absent comparisons.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  const noRating = buildProfile(games(40, () => withTheme), { rating: null, source });
  expect(noRating.comparisons.shown).toBe(true); // the sample is fine and the source has data…
  // …but with no rating there is no bucket, so every individual comparison is null.
  for (const r of noRating.skills.flatMap((s) => s.rows)) expect(r.comparison, r.label).toBeNull();
  // Positive control: a rating turns them on.
  const withRating = buildProfile(games(40, () => withTheme), { rating: 800, source });
  expect(withRating.skills.flatMap((s) => s.rows).some((r) => r.comparison !== null)).toBe(true);
});

// ── Shape ───────────────────────────────────────────────────────────────────

test('all six F-PG-1 skills are present, in order, every time', () => {
  for (const n of [0, 1, 40]) {
    const p = buildProfile(games(n));
    expect(p.skills.map((s) => s.id), `n=${String(n)}`).toEqual([...SKILL_IDS]);
  }
});

test('a skill with nothing to report says what is absent rather than printing zero', () => {
  const p = buildProfile([]);
  for (const s of p.skills) {
    // Every skill declares at least one thing it cannot measure, with a reason.
    expect(s.notMeasured.length, s.id).toBeGreaterThan(0);
    for (const n of s.notMeasured) expect(n.length, s.id).toBeGreaterThan(20);
    // And an absent measure carries a reason, never a bare zero.
    if (s.headline.kind === 'absent') expect(s.headline.reason, s.id).toBeTruthy();
  }
});

test('the headline of each skill is its first row, never a blended score', () => {
  // A composite would need weights the PRD does not give and no learner could
  // check. This is the structural guarantee that none was invented.
  const p = buildProfile(games(12, () => withTheme));
  for (const s of p.skills) {
    expect(s.rows.length, s.id).toBeGreaterThan(0);
    expect(s.headline, s.id).toEqual(s.rows[0]?.measure);
  }
});

test('an empty profile is a real profile, not a throw', () => {
  const p = buildProfile([]);
  expect(p.games).toBe(0);
  expect(p.strengths).toEqual([]);
  expect(p.weaknesses).toEqual([]);
  expect(p.changed.available).toBe(false);
  expect(p.skills).toHaveLength(SKILL_IDS.length);
});

test('nothing anywhere in the profile renders as undefined or NaN', () => {
  // A profile is a screen full of numbers; one undefined reaches the learner as a
  // broken app. Checked over the serialised whole, so a field added later is
  // covered without anyone remembering.
  for (const n of [0, 1, 9, 10, 40]) {
    const json = JSON.stringify(buildProfile(games(n, () => withTheme)));
    expect(json, `n=${String(n)}`).not.toMatch(/undefined|NaN|Infinity|\[object Object\]/);
  }
});

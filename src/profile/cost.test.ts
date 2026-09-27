import { expect, test } from 'vitest';
import { HALF_LIFE_GAMES, recencyWeight, recencyWeights } from './recency';
import { costOf, expectedScoreLostFromDrop, type Occurrence } from './cost';

/** A weakness that happened `n` times, all in the same game at `rank`. */
function inOneGame(n: number, rank: number, loss: number): Occurrence[] {
  return Array.from({ length: n }, () => ({ gameRank: rank, expectedScoreLost: loss }));
}

// ── The curve ───────────────────────────────────────────────────────────────

test('the newest game is worth a whole game', () => {
  expect(recencyWeight(0)).toBe(1);
});

test('a game one half-life back is worth exactly half', () => {
  // This is the property that makes HALF_LIFE_GAMES readable as what it is
  // named. Read from the constant, so changing the constant cannot leave this
  // test passing against a curve that no longer has that half-life.
  expect(recencyWeight(HALF_LIFE_GAMES)).toBeCloseTo(0.5, 12);
  expect(recencyWeight(HALF_LIFE_GAMES * 2)).toBeCloseTo(0.25, 12);
  expect(recencyWeight(HALF_LIFE_GAMES * 3)).toBeCloseTo(0.125, 12);
});

test('the curve is strictly decreasing and never reaches zero', () => {
  // "Never zero" is the no-cut-off property: a game at rank 400 still counts for
  // something. A cut-off implementation would pass a monotonicity check alone.
  let previous = Infinity;
  for (const rank of [0, 1, 3, 7, 10, 25, 60, 200, 400]) {
    const w = recencyWeight(rank);
    expect(w, `rank ${String(rank)}`).toBeLessThan(previous);
    expect(w, `rank ${String(rank)}`).toBeGreaterThan(0);
    previous = w;
  }
});

test('the most recent twenty games carry about three quarters of the weight', () => {
  // The stated justification for choosing ten, checked rather than asserted in
  // prose. A long tail stands in for the unbounded history.
  const weights = recencyWeights(2000);
  const all = weights.reduce((a, b) => a + b, 0);
  const recent20 = weights.slice(0, 20).reduce((a, b) => a + b, 0);
  expect(recent20 / all).toBeCloseTo(0.75, 2);
});

test('a negative rank cannot buy more than a whole game', () => {
  expect(recencyWeight(-5)).toBe(1);
});

test('recencyWeights hands back one weight per game, newest first', () => {
  expect(recencyWeights(3)).toEqual([recencyWeight(0), recencyWeight(1), recencyWeight(2)]);
  expect(recencyWeights(0)).toEqual([]);
  expect(recencyWeights(-2)).toEqual([]);
});

// ── The units ───────────────────────────────────────────────────────────────

test('a win-per-cent drop becomes expected score on a 0-to-1 scale', () => {
  expect(expectedScoreLostFromDrop(30)).toBeCloseTo(0.3, 12);
  expect(expectedScoreLostFromDrop(0)).toBe(0);
  expect(expectedScoreLostFromDrop(100)).toBe(1);
  // Out of range in both directions is corrected, not propagated: a negative
  // loss would subtract from a weakness's cost and could rank it below a theme
  // that never happened.
  expect(expectedScoreLostFromDrop(-10)).toBe(0);
  expect(expectedScoreLostFromDrop(180)).toBe(1);
});

// ── The product ─────────────────────────────────────────────────────────────

test('with no recency effect the cost is occurrences times mean loss', () => {
  // All in the newest game, so every weight is 1 and the formula reduces to the
  // PRD's sentence read literally. This is the case a reader can check by hand:
  // four occurrences losing a quarter of a game each cost one whole game.
  const c = costOf(inOneGame(4, 0, 0.25));
  expect(c.occurrences).toBe(4);
  expect(c.weightedOccurrences).toBeCloseTo(4, 12);
  expect(c.meanExpectedScoreLost).toBeCloseTo(0.25, 12);
  expect(c.cost).toBeCloseTo(1, 12);
});

test('the two factors multiply back to the cost, whatever the recency spread', () => {
  // The identity the module's header claims. Checked against a spread of ranks
  // so it cannot pass by every weight being equal.
  const occ: Occurrence[] = [
    { gameRank: 0, expectedScoreLost: 0.4 },
    { gameRank: 7, expectedScoreLost: 0.1 },
    { gameRank: 23, expectedScoreLost: 0.9 },
    { gameRank: 40, expectedScoreLost: 0.05 },
  ];
  const c = costOf(occ);
  expect(c.weightedOccurrences * c.meanExpectedScoreLost).toBeCloseTo(c.cost, 12);
  // Non-vacuous: the weights really do differ, so the identity is not being
  // checked on a degenerate all-ones case.
  expect(new Set(occ.map((o) => recencyWeight(o.gameRank))).size).toBe(4);
});

test('the weighted occurrence count is itself weighted, not the raw count', () => {
  // Found by mutation: `weighted += 1` instead of `weighted += w` left every
  // other test in this file passing. The product identity survives it (the mean
  // absorbs the error), the cost survives it (it is summed separately), and the
  // raw count survives it (it is `occurrences.length`). Only asserting the first
  // factor against the sum of the weights notices — and it must be done with
  // MIXED ranks, because with every occurrence in one game the weighted count
  // and the raw count coincide and the mutation is invisible again.
  const occ: Occurrence[] = [
    { gameRank: 0, expectedScoreLost: 0.2 },
    { gameRank: HALF_LIFE_GAMES, expectedScoreLost: 0.2 },
    { gameRank: HALF_LIFE_GAMES * 2, expectedScoreLost: 0.2 },
  ];
  const c = costOf(occ);
  // 1 + 0.5 + 0.25, which is deliberately not 3.
  expect(c.weightedOccurrences).toBeCloseTo(1.75, 12);
  expect(c.occurrences).toBe(3);
  expect(c.weightedOccurrences).toBeLessThan(c.occurrences);
  // And the mean is then a WEIGHTED mean. With equal losses it equals the loss,
  // so the discriminating check is that the cost is the weighted count times it
  // rather than the raw count times it.
  expect(c.cost).toBeCloseTo(1.75 * 0.2, 12);
  expect(c.cost).not.toBeCloseTo(3 * 0.2, 6);
});

test('the same weakness costs more when it is recent than when it is old', () => {
  const recent = costOf(inOneGame(3, 0, 0.3));
  const old = costOf(inOneGame(3, 40, 0.3));
  expect(recent.cost).toBeGreaterThan(old.cost);
  // And the raw count the screen prints is unaffected by recency, which is the
  // point of keeping the two apart.
  expect(recent.occurrences).toBe(old.occurrences);
});

test('a recent cheap weakness can outrank an old expensive one, and the reverse', () => {
  // The discriminating case for "recent games weighted more heavily". If the
  // weighting were dropped, `old` would win on loss alone; if the weighting were
  // absolute, `recent` would win however small its loss. Both directions are
  // pinned so neither degenerate implementation passes.
  const recentSmall = costOf(inOneGame(2, 0, 0.2)); // 2 × 1.0 × 0.2 = 0.40
  const oldBig = costOf(inOneGame(2, 30, 0.9)); // 2 × 0.125 × 0.9 = 0.225
  expect(recentSmall.cost).toBeGreaterThan(oldBig.cost);

  const oldHuge = costOf(inOneGame(20, 30, 0.9)); // 20 × 0.125 × 0.9 = 2.25
  expect(oldHuge.cost).toBeGreaterThan(recentSmall.cost);
});

test('a theme that never happened costs nothing and does not divide by zero', () => {
  const c = costOf([]);
  expect(c).toEqual({ cost: 0, weightedOccurrences: 0, meanExpectedScoreLost: 0, occurrences: 0 });
  expect(Number.isNaN(c.meanExpectedScoreLost)).toBe(false);
});

test('an out-of-range loss is clamped inside the product too', () => {
  // The clamp lives in costOf as well as in expectedScoreLostFromDrop, because a
  // caller can build an Occurrence without going through the converter.
  expect(costOf([{ gameRank: 0, expectedScoreLost: 5 }]).cost).toBeCloseTo(1, 12);
  expect(costOf([{ gameRank: 0, expectedScoreLost: -5 }]).cost).toBe(0);
});

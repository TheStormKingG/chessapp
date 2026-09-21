import { describe, expect, test } from 'vitest';
import { windowFor, pickNext } from './select';
import { expected } from './rating';
import type { Puzzle } from './types';

const P = (id: string, rating: number): Puzzle => ({
  id,
  rating,
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  solution: ['a1a2', 'h1h2'],
  themes: ['fork'],
});

describe('select', () => {
  test('the window is the 70-85% band, derived from the rating curve', () => {
    const w = windowFor(1000);
    expect(w.min).toBeGreaterThan(1000 - 320);
    expect(w.max).toBeLessThan(1000 - 140);
    expect(w.min).toBeLessThan(w.max);
  });

  test('the window edges really are 85% and 70% on the same curve', () => {
    // The point of deriving rather than hardcoding: if the scale constant in
    // rating.ts changes, these still hold and the constants 147/302 would not.
    const w = windowFor(1000);
    expect(expected(1000, w.min)).toBeCloseTo(0.85, 3);
    expect(expected(1000, w.max)).toBeCloseTo(0.7, 3);
  });

  test('picks from inside the window', () => {
    const pool = [P('far', 300), P('in', 750), P('high', 1400)];
    const r = pickNext(pool, { rating: 1000, confidence: 0.5 }, new Set());
    expect(r.puzzle?.id).toBe('in');
    expect(r.widened).toBe(false);
    expect(r.exhausted).toBe(false);
  });

  test('excludes recently seen puzzles', () => {
    const pool = [P('a', 750), P('b', 760)];
    const r = pickNext(pool, { rating: 1000, confidence: 0.5 }, new Set(['a']));
    expect(r.puzzle?.id).toBe('b');
    expect(r.widened).toBe(false);
  });

  test('with nothing seen it picks the lowest in window, so the exclusion above is a real exclusion', () => {
    // Rule 4 of the plan companion: an exclusion test proves nothing unless the
    // excluded puzzle is the one that would otherwise have been picked.
    const pool = [P('a', 750), P('b', 760)];
    expect(pickNext(pool, { rating: 1000, confidence: 0.5 }, new Set()).puzzle?.id).toBe('a');
  });

  test('an empty window widens rather than returning nothing, and says so', () => {
    // Nothing in [698, 853]: the learner has outgrown the pack.
    const pool = [P('only', 1490)];
    const r = pickNext(pool, { rating: 1000, confidence: 0.9 }, new Set());
    expect(r.puzzle?.id).toBe('only');
    expect(r.widened).toBe(true);
    expect(r.exhausted).toBe(false);
  });

  test('widening picks the closest to the window, not merely the first survivor', () => {
    // Window for 1800 is [1498, 1653]: 'near' is 598 below it, 'miles' 747
    // above. 'miles' comes first in the pool, so picking 'near' is what
    // distinguishes "closest" from "first that survives the filter".
    const pool = [P('miles', 2400), P('near', 900)];
    const r = pickNext(pool, { rating: 1800, confidence: 0.9 }, new Set());
    expect(r.puzzle?.id).toBe('near');
    expect(r.widened).toBe(true);
  });

  test('an exhausted pool returns null rather than repeating a seen puzzle silently', () => {
    const pool = [P('a', 750)];
    const r = pickNext(pool, { rating: 1000, confidence: 0.5 }, new Set(['a']));
    expect(r.puzzle).toBeNull();
    expect(r.exhausted).toBe(true);
    expect(r.widened).toBe(false);
  });

  test('an empty pool is exhaustion, not a crash', () => {
    const r = pickNext([], { rating: 1000, confidence: 0 }, new Set());
    expect(r.puzzle).toBeNull();
    expect(r.exhausted).toBe(true);
  });
});

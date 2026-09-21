import { describe, expect, test } from 'vitest';
import { nextRating, START } from './rating';
import type { PuzzleRating } from './types';

const solve = (r: PuzzleRating, p: number) => nextRating(r, p, true);
const fail = (r: PuzzleRating, p: number) => nextRating(r, p, false);

describe('rating', () => {
  test('starts at 800 with no confidence (F-PZ-1)', () => {
    expect(START).toEqual({ rating: 800, confidence: 0 });
  });

  test('solving raises the rating, failing lowers it', () => {
    expect(solve(START, 800).rating).toBeGreaterThan(800);
    expect(fail(START, 800).rating).toBeLessThan(800);
  });

  test('solving a harder puzzle raises the rating more than an easier one', () => {
    const hard = solve(START, 1200).rating;
    const easy = solve(START, 600).rating;
    expect(hard).toBeGreaterThan(easy);
  });

  test('failing an easier puzzle costs more than failing a harder one', () => {
    expect(fail(START, 600).rating).toBeLessThan(fail(START, 1200).rating);
  });

  test('confidence never decreases', () => {
    let r = START;
    for (let i = 0; i < 50; i++) {
      const before = r.confidence;
      r = i % 3 === 0 ? fail(r, 900) : solve(r, 900);
      expect(r.confidence).toBeGreaterThanOrEqual(before);
    }
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  test('the step shrinks as confidence grows, so the rating settles', () => {
    let r = START;
    const first = Math.abs(solve(r, 1000).rating - r.rating);
    for (let i = 0; i < 40; i++) r = solve(r, 1000);
    const later = Math.abs(solve(r, 1000).rating - r.rating);
    expect(later).toBeLessThan(first);
  });

  test('the rating stays inside sane bounds under any sequence', () => {
    let r = START;
    for (let i = 0; i < 500; i++) r = solve(r, 1500);
    expect(r.rating).toBeLessThanOrEqual(3000);
    let s = START;
    for (let i = 0; i < 500; i++) s = fail(s, 600);
    expect(s.rating).toBeGreaterThanOrEqual(400);
  });

  /**
   * Added beyond the plan's Task 8 test list. The plan predicts that replacing
   * the confidence-scaled step with a constant MAX_STEP reddens "the step
   * shrinks as confidence grows". It does not: that test passes under the
   * mutation, because the surprise term shrinks on its own as the rating climbs
   * toward the puzzle's. So nothing in the list guarded the confidence scaling.
   * This compares two ratings at the SAME rating and different confidences,
   * which isolates the step and nothing else.
   */
  test('at the same rating, more confidence means a smaller move', () => {
    const green = solve({ rating: 800, confidence: 0 }, 1000).rating - 800;
    const settled = solve({ rating: 800, confidence: 1 }, 1000).rating - 800;
    expect(green).toBeGreaterThan(0);
    expect(settled).toBeGreaterThan(0);
    expect(settled).toBeLessThan(green);
  });

  test('it is pure: the same inputs give the same output and the input is untouched', () => {
    const r = { rating: 950, confidence: 0.3 };
    const a = solve(r, 1000);
    const b = solve(r, 1000);
    expect(a).toEqual(b);
    expect(r).toEqual({ rating: 950, confidence: 0.3 });
  });
});

import { expect, test } from 'vitest';
import {
  COMPARISON_MIN_GAMES,
  LABEL_DROP_GAMES,
  comparisonAvailability,
  confidenceOf,
} from './sampleSize';

/**
 * F-SW-6 is three clauses with two boundaries, and a boundary is the one place a
 * threshold can be wrong while every test either side of it passes. So both are
 * pinned from both directions: 9/10 and 29/30.
 *
 * The thresholds are also read from the exported constants in the loop at the
 * bottom, so a build that moved COMPARISON_MIN_GAMES to 12 and updated the
 * literals in these tests to match would still fail — the loop asserts the SHAPE
 * of the rule at the declared threshold, and the literal cases assert the PRD's
 * actual numbers. Either alone is defeatable by editing one line.
 */

test('below ten games there are no comparisons at all (F-SW-6)', () => {
  for (const n of [0, 1, 5, 8, 9]) {
    const c = confidenceOf(n);
    expect(c.comparisons, `at ${String(n)} games`).toBe(false);
    expect(c.label, `at ${String(n)} games`).toBeNull();
    expect(c.games).toBe(n);
  }
});

test('the ninth game is below the line and the tenth is on it', () => {
  // The boundary, from both sides, in one test so a single off-by-one is visible.
  expect(confidenceOf(9).comparisons).toBe(false);
  expect(confidenceOf(10).comparisons).toBe(true);
  expect(confidenceOf(10).label).toBe('early');
});

test('from ten to twenty-nine games comparisons are labelled early', () => {
  for (const n of [10, 11, 20, 28, 29]) {
    const c = confidenceOf(n);
    expect(c.comparisons, `at ${String(n)} games`).toBe(true);
    expect(c.label, `at ${String(n)} games`).toBe('early');
  }
});

test('the twenty-ninth game still carries the label and the thirtieth drops it', () => {
  expect(confidenceOf(29).label).toBe('early');
  expect(confidenceOf(30).label).toBeNull();
  expect(confidenceOf(30).comparisons).toBe(true);
});

test('above thirty games the label stays dropped', () => {
  for (const n of [30, 31, 100, 500]) {
    const c = confidenceOf(n);
    expect(c.comparisons, `at ${String(n)} games`).toBe(true);
    expect(c.label, `at ${String(n)} games`).toBeNull();
  }
});

test('the rule holds at whatever the declared thresholds are, not only at 10 and 30', () => {
  // Reading the constants means a change to either one fails here unless the
  // three-clause SHAPE is preserved. The literal tests above are what pin the
  // shape to the PRD's actual numbers.
  expect(confidenceOf(COMPARISON_MIN_GAMES - 1).comparisons).toBe(false);
  expect(confidenceOf(COMPARISON_MIN_GAMES).comparisons).toBe(true);
  expect(confidenceOf(LABEL_DROP_GAMES - 1).label).toBe('early');
  expect(confidenceOf(LABEL_DROP_GAMES).label).toBeNull();
  // Non-vacuous: the two thresholds are distinct and ordered, so the middle band
  // exists. Were they equal, every assertion above would pass while "labelled
  // early" described no sample size at all.
  expect(COMPARISON_MIN_GAMES).toBeLessThan(LABEL_DROP_GAMES);
});

test('a fractional or negative count is clamped, not thrown on', () => {
  expect(confidenceOf(-3).games).toBe(0);
  expect(confidenceOf(-3).comparisons).toBe(false);
  expect(confidenceOf(10.9).games).toBe(10);
  expect(confidenceOf(10.9).label).toBe('early');
});

test('with no band statistics every comparison is absent, at every sample size', () => {
  // The extension of F-SW-6's honest mode to F-SW-5's missing input. The point of
  // testing it at 500 games is that sample size can never rescue it.
  for (const n of [0, 9, 10, 29, 30, 500]) {
    const a = comparisonAvailability(n, false);
    expect(a.shown, `at ${String(n)} games`).toBe(false);
  }
});

test('the two reasons a comparison is absent are told apart', () => {
  // They have different remedies, so they must not collapse into one value.
  expect(comparisonAvailability(9, true)).toEqual({ shown: false, reason: 'too-few-games' });
  expect(comparisonAvailability(50, false)).toEqual({ shown: false, reason: 'no-band-data' });
  // And when the sample is ALSO too small, the sample is the reason reported,
  // because that is the one the learner can act on.
  expect(comparisonAvailability(3, false)).toEqual({ shown: false, reason: 'too-few-games' });
});

test('with band statistics present the F-SW-6 label passes through', () => {
  // Positive control for the two tests above: they assert an absence, and this is
  // the case that proves `comparisonAvailability` can return `shown: true` at
  // all. Without it, a function that returned `shown: false` unconditionally
  // would satisfy every other assertion in this file.
  expect(comparisonAvailability(10, true)).toEqual({ shown: true, label: 'early' });
  expect(comparisonAvailability(30, true)).toEqual({ shown: true, label: null });
});

import { thresholdsFor, bandForUnit, BEST_EPSILON } from './bands';
import { toWinPercent, moveAccuracy } from '@/engine';

test('Appendix C: each band is exactly the PRD table', () => {
  // Section 4 is the PRD's base column.
  expect(thresholdsFor(4)).toEqual({ excellent: 2, good: 5, inaccuracy: 10, mistake: 20 });
  expect(thresholdsFor(3)).toEqual({ excellent: 2.5, good: 6, inaccuracy: 12, mistake: 22 });
  expect(thresholdsFor(2)).toEqual({ excellent: 3, good: 8, inaccuracy: 15, mistake: 25 });
  // Appendix C gives Sections 1 and 2 one shared column.
  expect(thresholdsFor(1)).toEqual(thresholdsFor(2));
});

test('lower bands are never stricter than higher ones', () => {
  for (const k of ['excellent', 'good', 'inaccuracy', 'mistake'] as const) {
    expect(thresholdsFor(1)[k]).toBeGreaterThanOrEqual(thresholdsFor(3)[k]);
    expect(thresholdsFor(3)[k]).toBeGreaterThanOrEqual(thresholdsFor(4)[k]);
  }
});

test('each band is internally ordered', () => {
  for (const b of [1, 2, 3, 4] as const) {
    const t = thresholdsFor(b);
    expect(t.excellent).toBeLessThan(t.good);
    expect(t.good).toBeLessThan(t.inaccuracy);
    expect(t.inaccuracy).toBeLessThan(t.mistake);
  }
});

test('the band comes from the unit id, and today every learner is in band 1', () => {
  expect(bandForUnit('1.1')).toBe(1);
  expect(bandForUnit('1.6')).toBe(1);
  expect(bandForUnit('2.3')).toBe(2);
  expect(bandForUnit('3.1')).toBe(3);
  expect(bandForUnit('4.9')).toBe(4);
  // Unknown or malformed ids fall back to the most generous band, never the strictest.
  expect(bandForUnit('')).toBe(1);
  expect(bandForUnit('nonsense')).toBe(1);
  expect(bandForUnit('9.9')).toBe(4);
});

test('this module does not restate PRD 10.6 — it uses the shipped curve', () => {
  // Values computed from the PRD formulas independently of the implementation.
  expect(toWinPercent(0)).toBeCloseTo(50, 4);
  expect(toWinPercent(200)).toBeCloseTo(67.6212, 3);
  expect(toWinPercent(-200)).toBeCloseTo(32.3788, 3);
  // The curve is symmetric about 50, which is what lets a mover's win per cent
  // after a move be read off the opponent's evaluation as 100 - x.
  for (const cp of [-900, -350, -75, 0, 75, 350, 900]) {
    expect(100 - toWinPercent(cp)).toBeCloseTo(toWinPercent(-cp), 9);
  }
  expect(moveAccuracy(0)).toBeCloseTo(99.9999, 3);
  expect(moveAccuracy(5)).toBeCloseTo(79.817, 3);
  expect(moveAccuracy(20)).toBeCloseTo(40.0204, 3);
  expect(moveAccuracy(50)).toBeCloseTo(8.5303, 3);
});

test('BEST_EPSILON is small enough to matter and large enough to absorb float noise', () => {
  expect(BEST_EPSILON).toBeGreaterThan(0);
  expect(BEST_EPSILON).toBeLessThan(0.5);
});

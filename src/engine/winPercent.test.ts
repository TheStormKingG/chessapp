import { toWinPercent, scoreToWinPercent } from './winPercent';

test('0 cp is 50 per cent, symmetric', () => {
  expect(toWinPercent(0)).toBeCloseTo(50, 5);
  expect(toWinPercent(100) + toWinPercent(-100)).toBeCloseTo(100, 5);
});

test('+300 cp is about 75 per cent (Lichess curve, PRD 10.6)', () => {
  expect(toWinPercent(300)).toBeGreaterThan(73);
  expect(toWinPercent(300)).toBeLessThan(77);
});

test('mate scores saturate', () => {
  expect(scoreToWinPercent({ mate: 3 })).toBe(100);
  expect(scoreToWinPercent({ mate: -1 })).toBe(0);
});

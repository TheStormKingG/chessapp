import { localDay } from '@/data/events';
import { dailyIndex, localDateKey } from './daily';

describe('daily', () => {
  test('the same date gives the same index, on any device', () => {
    expect(dailyIndex('2026-09-19', 1000)).toBe(dailyIndex('2026-09-19', 1000));
  });

  test('different dates give different indices, and not by adjacency', () => {
    const a = dailyIndex('2026-09-19', 1000);
    const b = dailyIndex('2026-09-20', 1000);
    expect(a).not.toBe(b);
    // A weak hash that just increments would make the daily puzzle walk the
    // pack in order, so a learner could read ahead.
    expect(Math.abs(a - b)).toBeGreaterThan(1);
  });

  test('the index is always inside the pack', () => {
    for (let d = 1; d <= 28; d++) {
      const key = `2026-02-${String(d).padStart(2, '0')}`;
      const i = dailyIndex(key, 7);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(7);
    }
  });

  test('an empty pack yields 0 rather than NaN', () => {
    // `x % 0` is NaN, and a NaN index reads as "no puzzle" downstream while
    // looking like an ordinary number in a log.
    expect(dailyIndex('2026-09-19', 0)).toBe(0);
  });

  test('a year of dates uses the whole pack, not a narrow band of it', () => {
    // The property that matters is not "different", it is "spread over the
    // WHOLE pack". A plain sum of the date key's characters passes both of the
    // tests above — consecutive days differ by 8, and eight buckets fill
    // evenly — while every index it can produce for a year lies inside a band
    // about forty wide, so a 5,000-puzzle pack would serve forty puzzles for
    // ever. That is the failure this asserts against, and it is the failure
    // the plan described as "a learner could read ahead".
    const PACK = 5000;
    const indices: number[] = [];
    for (let d = 0; d < 365; d += 1) {
      indices.push(dailyIndex(localDateKey(new Date(2026, 0, 1 + d)), PACK));
    }
    const spread = Math.max(...indices) - Math.min(...indices);
    expect(spread, 'a year of daily puzzles came from one corner of the pack').toBeGreaterThan(
      PACK * 0.8,
    );
    // And they are not a few values repeated: 365 draws from 5,000 collide
    // about thirteen times by the birthday problem, so 300 is a wide margin.
    expect(new Set(indices).size).toBeGreaterThan(300);
  });

  test('the date key is the device-local date, not UTC (spec §4.3)', () => {
    // 2026-09-19T23:30 local must be 2026-09-19 whatever the zone offset.
    const d = new Date(2026, 8, 19, 23, 30);
    expect(localDateKey(d)).toBe('2026-09-19');
  });

  test('the date key is the one the event log already stamps days with', () => {
    // A second, subtly different notion of "today" would put the daily puzzle
    // on one day and its record on another for learners east or west of
    // Greenwich late in the evening.
    const d = new Date(2026, 8, 19, 23, 30);
    expect(localDateKey(d)).toBe(localDay(d));
  });
});

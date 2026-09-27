import { describe, expect, it } from 'vitest';
import { localDay } from '@/data/events';
import { SWAPS_PER_WEEK, WINDOW_DAYS, dayToUtcNoon, daysBetween, shiftDay, swapAllowed } from './schedule';

const TODAY = '2026-09-26';
const back = (n: number) => shiftDay(TODAY, -n);

describe('local-day arithmetic', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetween('2026-09-19', '2026-09-26')).toBe(7);
    expect(daysBetween('2026-09-26', '2026-09-19')).toBe(-7);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
  });

  it('counts whole days across a month and a year boundary', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(shiftDay('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('anchors every day at UTC noon, which is what makes a day exactly a day', () => {
    // The hazard this guards against — a local-midnight parse returning 6.958 days
    // across a daylight-saving change, truncating to 6 — CANNOT be observed on a
    // machine in a zone without DST, and this suite's machine is in one
    // (America/Guyana, a fixed -04:00). A test written as "days across the October
    // change" therefore passes whether or not the parse is correct: it was, and it
    // was removed for it. So the invariant is asserted directly instead, and it
    // fails in any zone if the anchor moves.
    expect(new Date(dayToUtcNoon('2026-10-25')).getUTCHours()).toBe(12);
    expect(new Date(dayToUtcNoon('2026-01-01')).toISOString()).toBe('2026-01-01T12:00:00.000Z');
    // And a sweep over a year of consecutive days, which pins the arithmetic
    // itself: every step is exactly one day, whatever the host zone does.
    for (let i = 0; i < 400; i += 1) {
      expect(daysBetween('2026-01-01', shiftDay('2026-01-01', i))).toBe(i);
    }
  });

  it('agrees with the day string the event log stores', () => {
    // The rule counts days in the same units `deviceDay` is written in.
    const d = new Date(2026, 8, 26, 23, 30);
    expect(shiftDay(localDay(d), 0)).toBe(localDay(d));
  });
});

describe('F-TS-1: at most twice a week', () => {
  it('allows the first swap when nothing has happened', () => {
    expect(swapAllowed([], TODAY)).toEqual({
      allowed: true,
      reason: 'allowed',
      used: 0,
      nextEligibleDay: null,
    });
  });

  it('allows a second swap in the same week', () => {
    expect(swapAllowed([back(3)], TODAY)).toMatchObject({ allowed: true, used: 1 });
  });

  it('refuses a third swap in the same week', () => {
    const d = swapAllowed([back(1), back(3)], TODAY);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('quota-reached');
    expect(d.used).toBe(SWAPS_PER_WEEK);
  });

  it('holds the boundary: six days back still counts, seven does not', () => {
    // Both inside the seven-day window ending today: refused.
    expect(swapAllowed([back(1), back(6)], TODAY)).toMatchObject({ allowed: false, used: 2 });
    // One slips out at exactly seven days: allowed, and the reason is the count.
    expect(swapAllowed([back(1), back(7)], TODAY)).toMatchObject({ allowed: true, used: 1 });
    // And the day either side of the boundary, so the test pins an edge and not a
    // range: eight days back is out too.
    expect(swapAllowed([back(1), back(8)], TODAY)).toMatchObject({ allowed: true, used: 1 });
  });

  it('names the day the quota frees, counted from the blocking swap', () => {
    const d = swapAllowed([back(1), back(6)], TODAY);
    // The older of the two leaves the window seven days after it happened.
    expect(d.nextEligibleDay).toBe(shiftDay(back(6), WINDOW_DAYS));
    expect(daysBetween(TODAY, d.nextEligibleDay ?? '')).toBe(1);
  });

  it('names the right day when the history holds more than the quota', () => {
    // Three in the window (a state a past bug could leave). The second-most-recent
    // is what blocks: when it expires, one swap remains in the window.
    const d = swapAllowed([back(1), back(2), back(5)], TODAY);
    expect(d.used).toBe(3);
    expect(d.nextEligibleDay).toBe(shiftDay(back(2), WINDOW_DAYS));
  });

  it('refuses a second session on a day that already has one, for its own reason', () => {
    const d = swapAllowed([TODAY], TODAY);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('already-today');
    expect(d.nextEligibleDay).toBe(shiftDay(TODAY, 1));
  });

  it('counts days, not sessions: two records on one day are one day', () => {
    expect(swapAllowed([back(2), back(2)], TODAY)).toMatchObject({ allowed: true, used: 1 });
  });

  it('ignores days in the future rather than letting a wrong clock lock the feature', () => {
    expect(swapAllowed([shiftDay(TODAY, 3), shiftDay(TODAY, 4)], TODAY)).toMatchObject({
      allowed: true,
      used: 0,
    });
  });

  it('is insensitive to the order the history arrives in', () => {
    const a = swapAllowed([back(6), back(1)], TODAY);
    const b = swapAllowed([back(1), back(6)], TODAY);
    expect(a).toEqual(b);
  });

  it('lets the path move: after a full week of nothing, swaps are available again', () => {
    expect(swapAllowed([back(8), back(9)], TODAY)).toMatchObject({ allowed: true, used: 0 });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { CHECK_DAYS, closingVerdict, occurrencesIn } from './closeOut';
import { HISTORY_LIMIT, takenDays, useTailored } from './store';
import { shiftDay, swapAllowed } from './schedule';
import { ITALIAN_SANS, aReview } from './testReviews';

const TODAY = '2026-09-26';

describe('occurrencesIn', () => {
  it('counts a theme in one game’s review', () => {
    const review = aReview({
      sans: ITALIAN_SANS,
      errors: [
        { ply: 6, theme: 'hung_piece', bestSan: 'd3' },
        { ply: 4, theme: 'hung_piece', bestSan: 'd3' },
        { ply: 2, theme: 'missed_capture', bestSan: 'd4' },
      ],
    });
    expect(occurrencesIn(review, 'hung_piece')).toBe(2);
    expect(occurrencesIn(review, 'missed_mate')).toBe(0);
  });
});

describe('F-TS-6: the closing verdict', () => {
  it('names the next check date, a week out', () => {
    const c = closingVerdict({ name: 'Leaving pieces free to take', inThisGame: 1, previousPerGame: 2, today: TODAY });
    // The literal date, not `shiftDay(TODAY, CHECK_DAYS)`: computing the expectation
    // from the same constant the code reads makes the assertion true for any value of
    // it, which a mutation run demonstrated by setting the week to one day.
    expect(c.nextCheckDay).toBe('2026-10-03');
    expect(CHECK_DAYS).toBe(7);
  });

  it('says it improved when it happened less often than before', () => {
    const c = closingVerdict({ name: 'Leaving pieces free to take', inThisGame: 1, previousPerGame: 2.4, today: TODAY });
    expect(c.line).toContain('better than your 2.4 a game before it');
  });

  it('says it got worse when it happened more often', () => {
    const c = closingVerdict({ name: 'Leaving pieces free to take', inThisGame: 3, previousPerGame: 1, today: TODAY });
    expect(c.line).toContain('worse than your 1.0 a game before it');
  });

  it('does not claim a direction for a difference inside the noise', () => {
    const c = closingVerdict({ name: 'Leaving pieces free to take', inThisGame: 2, previousPerGame: 2.05, today: TODAY });
    expect(c.line).toContain('about the same');
    expect(c.line).not.toContain('better');
    expect(c.line).not.toContain('worse');
  });

  it('says there is nothing to compare with on a first check, rather than implying progress', () => {
    const c = closingVerdict({ name: 'Leaving pieces free to take', inThisGame: 0, previousPerGame: null, today: TODAY });
    expect(c.line).toContain('first check');
    expect(c.line).not.toContain('better');
    // Positive control: with a history the same call DOES compare.
    expect(closingVerdict({ name: 'x', inThisGame: 0, previousPerGame: 2, today: TODAY }).line).toContain('better');
  });

  it('says so plainly when the weakness did not appear', () => {
    const c = closingVerdict({ name: 'Leaving pieces free to take', inThisGame: 0, previousPerGame: 2, today: TODAY });
    expect(c.line).toContain('No sign of leaving pieces free to take in that game');
  });

  it('agrees in number', () => {
    expect(closingVerdict({ name: 'X', inThisGame: 1, previousPerGame: 2, today: TODAY }).line).toContain('1 time');
    expect(closingVerdict({ name: 'X', inThisGame: 2, previousPerGame: 2, today: TODAY }).line).toContain('2 times');
  });
});

describe('the tailored-session store', () => {
  beforeEach(() => {
    useTailored.getState().reset();
  });

  it('starts empty, so a new device may take a session', () => {
    expect(useTailored.getState().taken).toEqual([]);
    expect(swapAllowed(takenDays(useTailored.getState().taken), TODAY).allowed).toBe(true);
  });

  it('records a session and the day it happened, which is what the weekly rule counts', () => {
    useTailored.getState().record({ day: TODAY, theme: 'hung_piece', lessonId: '1.2.4', signature: 's' });
    expect(takenDays(useTailored.getState().taken)).toEqual([TODAY]);
    expect(swapAllowed(takenDays(useTailored.getState().taken), TODAY).reason).toBe('already-today');
  });

  it('keeps a bounded history, and the bound cannot change a decision', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      useTailored.getState().record({ day: shiftDay(TODAY, -i), theme: 't', lessonId: 'l', signature: 's' });
    }
    expect(useTailored.getState().taken).toHaveLength(HISTORY_LIMIT);
    // What was trimmed is older than the rolling window, so the answer is unchanged.
    const days = takenDays(useTailored.getState().taken);
    expect(days).toContain(TODAY);
    expect(swapAllowed(days, TODAY).reason).toBe('already-today');
  });

  it('remembers a declined offer, and taking a session clears it', () => {
    useTailored.getState().decline('sig-1');
    expect(useTailored.getState().declined).toBe('sig-1');
    useTailored.getState().record({ day: TODAY, theme: 't', lessonId: 'l', signature: 'sig-1' });
    expect(useTailored.getState().declined).toBeNull();
  });

  it('holds the next check date F-TS-6 promises', () => {
    useTailored.getState().setNextCheck({ theme: 'hung_piece', day: '2026-10-03' });
    expect(useTailored.getState().nextCheck).toEqual({ theme: 'hung_piece', day: '2026-10-03' });
  });
});

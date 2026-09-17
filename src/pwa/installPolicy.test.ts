import { describe, expect, it, beforeEach } from 'vitest';
import { DISMISS_KEY, WEEK_MS, readDismissedAt, shouldOffer, writeDismissedAt } from './installPolicy';

beforeEach(() => {
  localStorage.clear();
});

describe('install offer policy', () => {
  it('offers after exactly one completed lesson', () => {
    expect(shouldOffer(1, Date.now())).toBe(true);
  });

  it('stays quiet before the first lesson is finished', () => {
    expect(shouldOffer(0, Date.now())).toBe(false);
  });

  it('stays quiet once the learner is past their first lesson', () => {
    expect(shouldOffer(4, Date.now())).toBe(false);
  });

  it('honours a dismissal for a week and returns after it', () => {
    const now = 10 * WEEK_MS;
    writeDismissedAt(now);
    expect(readDismissedAt()).toBe(now);
    expect(shouldOffer(1, now + WEEK_MS - 1)).toBe(false);
    expect(shouldOffer(1, now + WEEK_MS)).toBe(true);
  });

  it('treats unreadable storage as never dismissed', () => {
    localStorage.setItem(DISMISS_KEY, 'not-a-number');
    expect(readDismissedAt()).toBe(0);
    expect(shouldOffer(1, Date.now())).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { PRACTICE_STORAGE_KEY, starsFor, usePractice } from './results';
import { stars } from '@/lesson/stars';
import { CHESSAPP_STORAGE_PREFIX } from '@/app/clearDeviceData';

const KEY = '1.5.3/1.5.3-c6';

describe('drill stars (F-PR-1)', () => {
  beforeEach(() => {
    usePractice.getState().reset();
  });

  it('shows no stars for a drill never attempted', () => {
    expect(starsFor(usePractice.getState().results, KEY)).toBe(0);
  });

  it('shows no stars for a drill attempted and failed', () => {
    usePractice.getState().record(KEY, { met: false, hints: 0, misses: 0 });
    expect(starsFor(usePractice.getState().results, KEY)).toBe(0);
    // But the attempt is counted, so "never tried" and "tried and lost" differ.
    expect(usePractice.getState().results[KEY]?.attempts).toBe(1);
    expect(usePractice.getState().results[KEY]?.completed).toBe(false);
  });

  it('scores a clean run three stars, exactly as a lesson is scored', () => {
    usePractice.getState().record(KEY, { met: true, hints: 0, misses: 0 });
    expect(starsFor(usePractice.getState().results, KEY)).toBe(3);
    // The claim that matters: this is src/lesson/stars.ts and not a second
    // scheme. If the two ever diverge, this fails.
    expect(starsFor(usePractice.getState().results, KEY)).toBe(stars({ hints: 0, misses: 0 }));
  });

  it('defers to stars.ts for every combination it defines', () => {
    for (const run of [
      { hints: 0, misses: 0 },
      { hints: 0, misses: 1 },
      { hints: 1, misses: 0 },
      { hints: 0, misses: 2 },
      { hints: 2, misses: 3 },
    ]) {
      usePractice.getState().reset();
      usePractice.getState().record(KEY, { met: true, ...run });
      expect(starsFor(usePractice.getState().results, KEY), JSON.stringify(run)).toBe(stars(run));
    }
  });

  it('positive control: stars.ts does not give every run the same rating', () => {
    // Without this, "defers to stars.ts" would pass against a constant.
    expect(new Set([stars({ hints: 0, misses: 0 }), stars({ hints: 1, misses: 0 }), stars({ hints: 0, misses: 3 })]).size).toBe(
      3,
    );
  });

  it('keeps the best stars when a later run is worse', () => {
    usePractice.getState().record(KEY, { met: true, hints: 0, misses: 0 });
    expect(starsFor(usePractice.getState().results, KEY)).toBe(3);
    usePractice.getState().record(KEY, { met: true, hints: 3, misses: 3 });
    expect(starsFor(usePractice.getState().results, KEY)).toBe(3);
  });

  it('raises the stars when a later run is better', () => {
    usePractice.getState().record(KEY, { met: true, hints: 2, misses: 2 });
    const first = starsFor(usePractice.getState().results, KEY);
    usePractice.getState().record(KEY, { met: true, hints: 0, misses: 0 });
    expect(starsFor(usePractice.getState().results, KEY)).toBe(3);
    expect(first).toBeLessThan(3);
  });

  it('does not lose an earlier completion to a later failure', () => {
    usePractice.getState().record(KEY, { met: true, hints: 0, misses: 0 });
    usePractice.getState().record(KEY, { met: false, hints: 0, misses: 0 });
    expect(usePractice.getState().results[KEY]?.completed).toBe(true);
    expect(starsFor(usePractice.getState().results, KEY)).toBe(3);
    expect(usePractice.getState().results[KEY]?.attempts).toBe(2);
  });

  it('keeps drills apart', () => {
    const other = '1.5.1/1.5.1-c6';
    usePractice.getState().record(KEY, { met: true, hints: 0, misses: 0 });
    expect(starsFor(usePractice.getState().results, other)).toBe(0);
    usePractice.getState().record(other, { met: true, hints: 1, misses: 0 });
    expect(starsFor(usePractice.getState().results, KEY)).toBe(3);
    expect(starsFor(usePractice.getState().results, other)).toBe(2);
  });

  it("is cleared by \"clear this device's data\"", () => {
    expect(PRACTICE_STORAGE_KEY.startsWith(CHESSAPP_STORAGE_PREFIX)).toBe(true);
  });
});

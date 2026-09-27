import { beforeEach, describe, expect, it } from 'vitest';
import { NO_BESTS, VISION_STORAGE_KEY, bestOverall, modesAttempted, useVision } from './bests';
import { VISION_MODES } from './types';
import { CHESSAPP_STORAGE_PREFIX } from '@/app/clearDeviceData';

describe('the personal best per mode (F-PR-2)', () => {
  beforeEach(() => {
    useVision.getState().reset();
  });

  it('starts at zero for every mode', () => {
    expect(useVision.getState().bests).toEqual(NO_BESTS);
    expect(VISION_MODES.every((m) => useVision.getState().bests[m] === 0)).toBe(true);
  });

  it('keeps a best for each mode independently', () => {
    const { record } = useVision.getState();
    record('find-square', 9);
    record('count-attackers', 4);
    expect(useVision.getState().bests['find-square']).toBe(9);
    expect(useVision.getState().bests['count-attackers']).toBe(4);
    // The third is untouched: a best per mode, not one best.
    expect(useVision.getState().bests['find-destination']).toBe(0);
  });

  it('only ever goes up', () => {
    const { record } = useVision.getState();
    expect(record('find-square', 7)).toBe(true);
    expect(record('find-square', 3)).toBe(false);
    expect(useVision.getState().bests['find-square']).toBe(7);
    expect(record('find-square', 8)).toBe(true);
    expect(useVision.getState().bests['find-square']).toBe(8);
  });

  it('does not treat equalling the best as beating it', () => {
    const { record } = useVision.getState();
    record('find-square', 5);
    expect(record('find-square', 5)).toBe(false);
    expect(useVision.getState().bests['find-square']).toBe(5);
  });

  it('records a first score of zero as no best', () => {
    // A round in which nothing was answered right must not read as "attempted"
    // on the profile, because the profile distinguishes 0 from absent.
    expect(useVision.getState().record('find-square', 0)).toBe(false);
    expect(modesAttempted(useVision.getState().bests)).toBe(0);
  });
});

describe('the board orientation choice (F-PR-2)', () => {
  beforeEach(() => {
    useVision.getState().reset();
  });

  it('defaults to white and can be set to black', () => {
    expect(useVision.getState().orientation).toBe('w');
    useVision.getState().setOrientation('b');
    expect(useVision.getState().orientation).toBe('b');
  });
});

describe('summaries the profile reads', () => {
  beforeEach(() => {
    useVision.getState().reset();
  });

  it('bestOverall is the largest of the three, and 0 when none was played', () => {
    expect(bestOverall(useVision.getState().bests)).toBe(0);
    useVision.getState().record('find-square', 3);
    useVision.getState().record('count-attackers', 11);
    expect(bestOverall(useVision.getState().bests)).toBe(11);
  });

  it('modesAttempted counts only the modes with a score', () => {
    expect(modesAttempted(useVision.getState().bests)).toBe(0);
    useVision.getState().record('find-square', 1);
    expect(modesAttempted(useVision.getState().bests)).toBe(1);
    useVision.getState().record('find-destination', 2);
    expect(modesAttempted(useVision.getState().bests)).toBe(2);
  });
});

describe('storage', () => {
  it('is cleared by "clear this device\'s data"', () => {
    // clearDeviceData removes every localStorage key with the chessapp prefix,
    // so this is the whole of the integration — asserted rather than assumed,
    // because a key outside the prefix would survive the clear silently.
    expect(VISION_STORAGE_KEY.startsWith(CHESSAPP_STORAGE_PREFIX)).toBe(true);
  });

  it('fills in a mode missing from stored state rather than leaving it undefined', () => {
    // The shape an older build would have written. `undefined` would reach the
    // profile and format as NaN, so `merge` must repair it.
    const merged = useVision.persist.getOptions().merge?.(
      { bests: { 'find-square': 4 }, orientation: 'b' },
      useVision.getState(),
    ) as { bests: Record<string, number>; orientation: string };
    expect(merged.bests['find-square']).toBe(4);
    expect(merged.bests['count-attackers']).toBe(0);
    expect(merged.bests['find-destination']).toBe(0);
    expect(merged.orientation).toBe('b');
  });

  it('repairs a stored orientation that is not a colour', () => {
    const merged = useVision.persist.getOptions().merge?.({ orientation: 'sideways' }, useVision.getState()) as {
      orientation: string;
    };
    expect(merged.orientation).toBe('w');
  });
});

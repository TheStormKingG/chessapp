import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VISION_MODES, type Orientation, type VisionMode } from './types';

/**
 * F-PR-2's "personal best per mode", plus the board orientation the learner
 * chose last.
 *
 * ── WHY THIS IS A SETTING AND NOT AN EVENT ───────────────────────────────────
 *
 * The same call src/tailored/store.ts, src/profile/seen.ts and
 * src/import/settings.ts make, for the same reason: a best is CURRENT STATE read
 * on every open, not a history to replay into a projection. Nothing here is
 * progress — no XP, no unit, no lesson completion — so the event union and its
 * reducer, which are one shared file and a migration conversation, stay out of it.
 *
 * The key is `chessapp-vision`, under the `chessapp` prefix
 * src/app/clearDeviceData.ts clears by, so "clear this device's data" already
 * clears it and no registry needed editing.
 *
 * ── A BEST ONLY EVER GOES UP ────────────────────────────────────────────────
 *
 * `record` takes the maximum. A best that could be lowered by a bad round is not
 * a best, and this is the whole of the store's logic, so it is where the one test
 * that matters points.
 */

export type VisionBests = Record<VisionMode, number>;

interface VisionState {
  bests: VisionBests;
  /** F-PR-2's "board orientation choice", remembered between rounds. */
  orientation: Orientation;
  /** Returns true when the score set a new best, so the screen can say so. */
  record: (mode: VisionMode, score: number) => boolean;
  setOrientation: (o: Orientation) => void;
  /** Tests only: back to the state a new device is in. */
  reset: () => void;
}

export const VISION_STORAGE_KEY = 'chessapp-vision';

/** No best is 0, which reads correctly as "not attempted" on the profile. */
export const NO_BESTS: VisionBests = Object.fromEntries(VISION_MODES.map((m) => [m, 0])) as VisionBests;

export const useVision = create<VisionState>()(
  persist(
    (set, get) => ({
      bests: { ...NO_BESTS },
      orientation: 'w',
      record: (mode, score) => {
        const previous = get().bests[mode];
        if (score <= previous) return false;
        set((s) => ({ bests: { ...s.bests, [mode]: score } }));
        return true;
      },
      setOrientation: (orientation) => {
        set({ orientation });
      },
      reset: () => {
        set({ bests: { ...NO_BESTS }, orientation: 'w' });
      },
    }),
    {
      name: VISION_STORAGE_KEY,
      /**
       * A stored object from a build with fewer modes would leave a mode
       * undefined, and `undefined` formats as "NaN" on the profile rather than as
       * "not attempted". Merging over the full default keeps every mode present
       * whatever is on disk.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<VisionState>;
        return {
          ...current,
          ...saved,
          bests: { ...NO_BESTS, ...(saved.bests ?? {}) },
          orientation: saved.orientation === 'b' ? 'b' : 'w',
        };
      },
    },
  ),
);

/** The best across all three modes: the profile's headline for board vision. */
export function bestOverall(bests: VisionBests): number {
  return Math.max(...VISION_MODES.map((m) => bests[m]));
}

/** How many of the three modes have been attempted at all. */
export function modesAttempted(bests: VisionBests): number {
  return VISION_MODES.filter((m) => bests[m] > 0).length;
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Player preferences that outlive a session (PRD F-AX-1, 7.4):
 * text move entry for people who cannot drag, a muted coach, and muted move
 * sounds.
 *
 * `soundMuted` is separate from `coachMuted` on purpose: one silences spoken
 * hints and praise, the other silences the board. A learner in a quiet room
 * may want the move cue and not the commentary, and someone who finds the
 * commentary useful may still be working next to someone else.
 */
export interface Settings {
  textEntry: boolean;
  coachMuted: boolean;
  soundMuted: boolean;
  setTextEntry: (v: boolean) => void;
  setCoachMuted: (v: boolean) => void;
  setSoundMuted: (v: boolean) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      textEntry: false,
      coachMuted: false,
      soundMuted: false,
      setTextEntry: (textEntry) => set({ textEntry }),
      setCoachMuted: (coachMuted) => set({ coachMuted }),
      setSoundMuted: (soundMuted) => set({ soundMuted }),
    }),
    { name: 'chessapp-settings' },
  ),
);

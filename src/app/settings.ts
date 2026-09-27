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
  /**
   * F-EN-7's two reminder channels, each with its own switch. Both default OFF —
   * `engagement/reminders.ts` `defaultChannels()` is the authority and says why.
   *
   * They live here, beside the other device preferences, for a reason F-EN-7 states
   * as a requirement: "the learner can turn each channel off in two taps". Settings
   * is one tap from Today and the switch is the second. A notifications sub-page
   * would make it three.
   */
  remindPush: boolean;
  remindEmail: boolean;
  /**
   * F-EN-6's chosen cosmetics, by id (`engagement/cosmetics.ts`). Null means the
   * default entry. Stored as an ID and never as a colour, so a theme whose value is
   * corrected in code corrects itself for everyone who chose it.
   */
  boardCosmetic: string | null;
  piecesCosmetic: string | null;
  setTextEntry: (v: boolean) => void;
  setCoachMuted: (v: boolean) => void;
  setSoundMuted: (v: boolean) => void;
  setRemindPush: (v: boolean) => void;
  setRemindEmail: (v: boolean) => void;
  setBoardCosmetic: (v: string | null) => void;
  setPiecesCosmetic: (v: string | null) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      textEntry: false,
      coachMuted: false,
      soundMuted: false,
      remindPush: false,
      remindEmail: false,
      boardCosmetic: null,
      piecesCosmetic: null,
      setTextEntry: (textEntry) => set({ textEntry }),
      setCoachMuted: (coachMuted) => set({ coachMuted }),
      setSoundMuted: (soundMuted) => set({ soundMuted }),
      setRemindPush: (remindPush) => set({ remindPush }),
      setRemindEmail: (remindEmail) => set({ remindEmail }),
      setBoardCosmetic: (boardCosmetic) => set({ boardCosmetic }),
      setPiecesCosmetic: (piecesCosmetic) => set({ piecesCosmetic }),
    }),
    { name: 'chessapp-settings' },
  ),
);

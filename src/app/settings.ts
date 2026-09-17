import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Player preferences that outlive a session (PRD F-AX-1, 7.4):
 * text move entry for people who cannot drag, and a muted coach.
 */
export interface Settings {
  textEntry: boolean;
  coachMuted: boolean;
  setTextEntry: (v: boolean) => void;
  setCoachMuted: (v: boolean) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      textEntry: false,
      coachMuted: false,
      setTextEntry: (textEntry) => set({ textEntry }),
      setCoachMuted: (coachMuted) => set({ coachMuted }),
    }),
    { name: 'chessapp-settings' },
  ),
);

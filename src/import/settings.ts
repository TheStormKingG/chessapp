import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ImportSource } from './types';

/**
 * The learner's import preferences, persisted exactly as src/app/settings.ts does
 * it — zustand plus the `persist` middleware to localStorage.
 *
 * These are settings and not events: F-IM-4's switch and F-IM-2's bullet switch
 * are current state the app reads on every open, not a history to be replayed.
 * The `settings_changed` event is still appended beside each change, which is the
 * house pattern (see SettingsScreen.tsx) — the store holds the value, the event
 * records that it moved.
 */

/** One online account the learner has told us about. */
export interface LinkedAccount {
  source: Exclude<ImportSource, 'pgn'>;
  username: string;
  /**
   * F-AC-5 / F-IM-6: "They feed the rating estimate only after the learner
   * confirms the username is their own account."
   *
   * Import itself needs no confirmation (F-RV-9), so this gates the rating
   * estimate and nothing else. It is a separate flag rather than an assumption
   * because a learner may well import a stronger player's games to study them.
   */
  confirmedOwn: boolean;
}

export interface ImportSettings {
  accounts: LinkedAccount[];
  /** F-IM-2: bullet games are excluded from the profile unless this is on. */
  includeBullet: boolean;
  /** F-IM-4: "The learner can turn this off." */
  keepCurrent: boolean;
  /** ISO 8601 of the last successful check, so the daily job runs once a day. */
  lastCheckedAt: string | null;
  addAccount: (a: LinkedAccount) => void;
  removeAccount: (source: LinkedAccount['source'], username: string) => void;
  confirmOwn: (source: LinkedAccount['source'], username: string, own: boolean) => void;
  setIncludeBullet: (v: boolean) => void;
  setKeepCurrent: (v: boolean) => void;
  setLastCheckedAt: (iso: string | null) => void;
}

function sameAccount(a: LinkedAccount, source: LinkedAccount['source'], username: string): boolean {
  return a.source === source && a.username.toLowerCase() === username.toLowerCase();
}

export const useImportSettings = create<ImportSettings>()(
  persist(
    (set) => ({
      accounts: [],
      includeBullet: false,
      keepCurrent: true,
      lastCheckedAt: null,
      addAccount: (account) => {
        set((s) => {
          // Re-adding an account must not duplicate it, and must not silently
          // reset `confirmedOwn` on an account the learner already confirmed.
          const existing = s.accounts.find((a) => sameAccount(a, account.source, account.username));
          if (existing) {
            return {
              accounts: s.accounts.map((a) =>
                sameAccount(a, account.source, account.username)
                  ? { ...a, confirmedOwn: a.confirmedOwn || account.confirmedOwn }
                  : a,
              ),
            };
          }
          return { accounts: [...s.accounts, account] };
        });
      },
      removeAccount: (source, username) => {
        set((s) => ({ accounts: s.accounts.filter((a) => !sameAccount(a, source, username)) }));
      },
      confirmOwn: (source, username, own) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (sameAccount(a, source, username) ? { ...a, confirmedOwn: own } : a)),
        }));
      },
      setIncludeBullet: (includeBullet) => {
        set({ includeBullet });
      },
      setKeepCurrent: (keepCurrent) => {
        set({ keepCurrent });
      },
      setLastCheckedAt: (lastCheckedAt) => {
        set({ lastCheckedAt });
      },
    }),
    { name: 'chessapp-import' },
  ),
);

/** Every username the learner has told us about, for matching a pasted PGN. */
export function knownUsernames(s: Pick<ImportSettings, 'accounts'>): string[] {
  return s.accounts.map((a) => a.username);
}

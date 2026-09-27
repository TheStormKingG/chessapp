import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * What the app remembers about tailored sessions: which days one was taken on
 * (F-TS-1's "at most twice a week"), when the next check on the weakness is due
 * (F-TS-6), and which offer the learner has already declined (F-HM-7's "the learner
 * can decline it and keep the path's plan").
 *
 * ── WHY THIS IS A SETTING AND NOT AN EVENT ───────────────────────────────────
 *
 * The same call src/profile/seen.ts and src/import/settings.ts make, and for the
 * same reason: this is current state read on every open, not a history to be
 * replayed into a projection. Nothing here is progress — no XP, no unit, no lesson
 * completion. The lesson a tailored session contains still records its own
 * `lesson_completed` in the event log, under the AUTHORED lesson's id, so the path
 * and the totals see it exactly as they see any other lesson.
 *
 * There is a second, practical reason to keep it out of `src/data/`: the event
 * union and its reducer are a single shared file, and adding a member means a
 * migration conversation for a feature whose whole state is three fields that are
 * true now rather than facts about the past.
 *
 * ── THE DAYS ARE LOCAL DAYS ──────────────────────────────────────────────────
 *
 * `localDay()` strings, so the week the rule counts is the week the learner sees.
 * `schedule.ts` owns the arithmetic over them.
 */

export interface TakenSession {
  /** The local day, `YYYY-MM-DD`. */
  day: string;
  /** The review theme the session targeted. */
  theme: string;
  /** The authored lesson it reassembled. */
  lessonId: string;
  /** The profile signature at the moment it was offered. */
  signature: string;
}

export interface NextCheck {
  theme: string;
  day: string;
}

interface TailoredState {
  taken: TakenSession[];
  nextCheck: NextCheck | null;
  /** The profile signature of an offer the learner turned down. */
  declined: string | null;
  record: (s: TakenSession) => void;
  setNextCheck: (n: NextCheck) => void;
  decline: (signature: string) => void;
  /** Tests only: back to the state a new device is in. */
  reset: () => void;
}

export const TAILORED_STORAGE_KEY = 'chessapp-tailored';

/** How many sessions to keep. Enough for the rolling week plus a readable history. */
export const HISTORY_LIMIT = 30;

const EMPTY = { taken: [], nextCheck: null, declined: null } satisfies Partial<TailoredState>;

export const useTailored = create<TailoredState>()(
  persist(
    (set) => ({
      ...EMPTY,
      record: (s) => {
        set((state) => ({
          // Sorted by DAY, newest last, then capped — not capped in insertion order.
          //
          // The cap is a storage bound and must never change a decision, and that
          // guarantee only holds if what gets dropped is the oldest DAY. Insertion
          // order is the same thing in practice (sessions are recorded as they
          // happen), which is exactly why the difference is easy to miss: a test that
          // recorded thirty-five days newest-first watched today's session get
          // trimmed and the weekly rule go blind to it.
          taken: [...state.taken, s].sort((a, b) => a.day.localeCompare(b.day)).slice(-HISTORY_LIMIT),
          // Taking a session answers the offer, so a stale decline must not keep
          // suppressing the next one.
          declined: null,
        }));
      },
      setNextCheck: (nextCheck) => {
        set({ nextCheck });
      },
      decline: (declined) => {
        set({ declined });
      },
      reset: () => {
        set({ ...EMPTY });
      },
    }),
    { name: TAILORED_STORAGE_KEY },
  ),
);

/** The days a session was taken on, for `swapAllowed`. */
export function takenDays(taken: readonly TakenSession[]): string[] {
  return taken.map((t) => t.day);
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { stars } from '@/lesson/stars';

/**
 * F-PR-1's "stars" — the third thing a drill card shows.
 *
 * ── THE SCHEME IS src/lesson/stars.ts, NOT A SECOND ONE ──────────────────────
 *
 * `stars({ hints, misses })` already scores a lesson: three for a clean run, two
 * when a hint was used or a second miss happened, one for merely finishing. A
 * drill run produces exactly those two numbers, so it is reused verbatim and this
 * module does not compute a rating of its own.
 *
 * The alternative — stars from moves used against par — was considered and
 * rejected for a reason worth recording, because it is the obvious design: par
 * means opposite things for different goals. `goal.ts` FAILS a `mate_in` drill on
 * reaching the move budget and PASSES a `hold` drill on reaching it, so "fewer
 * moves is better" is true of three goal kinds and false of the fourth. A curve
 * over par would rate every hold drill identically while looking like a
 * measurement. And the same drill reached from a lesson would then carry two
 * different star ratings, which is the real objection.
 *
 * ── WHY A SETTING AND NOT AN EVENT ──────────────────────────────────────────
 *
 * The call src/tailored/store.ts makes and states: a best is current state read
 * on every open, not a history to replay. The drill's own completion is already
 * an event — it is a challenge inside an authored lesson and the lesson pipeline
 * records it — so nothing about PROGRESS depends on this store. Losing it costs
 * the stars on the cards and nothing else.
 *
 * The key is under the `chessapp` prefix src/app/clearDeviceData.ts clears by.
 */

export type Stars = 1 | 2 | 3;

export interface DrillResult {
  /** Best stars achieved. Never lowered — see `record`. */
  stars: Stars;
  /** How many times the drill has been finished, won or lost. */
  attempts: number;
  /** Whether the goal has ever been met. A failed attempt scores no stars. */
  completed: boolean;
}

interface PracticeState {
  results: Record<string, DrillResult>;
  /**
   * Bank one finished run. `key` comes from `drillKey`.
   *
   * Returns the stars now standing for the drill, so the screen can say what the
   * learner earned without reading the store again.
   */
  record: (key: string, run: { met: boolean; hints: number; misses: number }) => DrillResult;
  reset: () => void;
}

export const PRACTICE_STORAGE_KEY = 'chessapp-practice';

export const usePractice = create<PracticeState>()(
  persist(
    (set, get) => ({
      results: {},
      record: (key, run) => {
        const previous = get().results[key];
        const attempts = (previous?.attempts ?? 0) + 1;
        // A run that did not meet the goal earns no stars at all. `stars()` has no
        // notion of failure — it scores a COMPLETED lesson — so the met/not-met
        // gate belongs here rather than in a changed signature there.
        const earned: Stars | 0 = run.met ? stars({ hints: run.hints, misses: run.misses }) : 0;
        const best = Math.max(previous?.stars ?? 0, earned);
        const result: DrillResult = {
          // A drill never finished has no stars; `starsFor` reports 0 for it.
          stars: (best === 0 ? 1 : best) as Stars,
          attempts,
          completed: (previous?.completed ?? false) || run.met,
        };
        // `stars` is only meaningful once something was completed, so a
        // never-completed drill keeps `completed: false` and the screen shows no
        // stars rather than one.
        set((s) => ({ results: { ...s.results, [key]: result } }));
        return result;
      },
      reset: () => {
        set({ results: {} });
      },
    }),
    { name: PRACTICE_STORAGE_KEY },
  ),
);

/**
 * Stars standing for a drill: 0 when it has never been completed.
 *
 * Zero is a distinct state from one star and the screen shows it differently — an
 * unattempted drill and a drill scraped through are not the same thing, and
 * `DrillResult.stars` cannot be 0 because `stars()` cannot return 0.
 */
export function starsFor(results: Record<string, DrillResult>, key: string): 0 | Stars {
  const r = results[key];
  return r && r.completed ? r.stars : 0;
}

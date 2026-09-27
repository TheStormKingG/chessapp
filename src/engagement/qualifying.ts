import type { LearnerEvent } from '@/data/events';

/**
 * F-EN-1's list of what counts as a day's work, verbatim:
 *
 * > "One qualifying action a day extends the streak: a lesson, a checkpoint, a
 * > set of five puzzles, a game review, a coached game or the daily puzzle."
 *
 * Six kinds, and each one is a question about the event log rather than about a
 * screen, so this file answers all six from `LearnerEvent[]` and nothing else.
 *
 * ── EFFORT, NOT OUTCOME ──────────────────────────────────────────────────────
 *
 * PRD 8.9's own opening sentence is the tie-breaker wherever F-EN-1's wording
 * leaves a choice: "Streaks count effort and never outcomes." So a FAILED
 * checkpoint counts, an UNSOLVED puzzle counts toward the set of five, and a lost
 * coached game counts. Nothing here reads `passed`, `solved` or `result`, and a
 * test asserts that by flipping each of them and expecting the same answer.
 *
 * ── THE DAY IS THE ACTION'S OWN DAY ──────────────────────────────────────────
 *
 * F-EN-1: "Days are counted in the device's local time zone at the time of the
 * action." That is exactly `LearnerEvent.deviceDay`, which `newEvent` stamps from
 * the local date when the event is appended (`data/events.ts`). `createdAt` is
 * never read for a day: its UTC date puts a 22:00 session in a positive-offset
 * zone on the following day, which would turn one evening into two days of
 * activity — the same reason `onboarding/notifications.ts` reads `deviceDay`.
 *
 * ── THE ONE JOIN ─────────────────────────────────────────────────────────────
 *
 * "A coached game" is the only kind that cannot be read off one event.
 * `game_finished` carries the result and no coach flag; `game_started` carries
 * the coach flag and no result. They are joined on `gameId`, and the day credited
 * is the day the game FINISHED — a game begun at 23:50 and finished at 00:10 is
 * work done on the second day, because that is when the qualifying action (the
 * finishing) happened.
 */

/** Which of F-EN-1's six kinds happened. Ordered as F-EN-1 lists them. */
export type QualifyingKind = 'lesson' | 'checkpoint' | 'puzzle-set' | 'review' | 'coached-game' | 'daily-puzzle';

/** F-EN-1's "a set of five puzzles". */
export const PUZZLES_IN_A_SET = 5;

/**
 * Every local day that holds at least one qualifying action, with the kinds that
 * qualified it.
 *
 * A `Map` keyed by `YYYY-MM-DD`, in ascending day order. The kinds are returned
 * as well as the days because the streak card says what the learner did, and
 * recomputing that from a second pass over the log would be a second definition
 * of the same rule.
 */
export function qualifyingDayIndex(events: readonly LearnerEvent[]): Map<string, QualifyingKind[]> {
  // The join's left side, gathered first: a `game_started` may be in the log
  // before or after its `game_finished` depending on the order the caller hands
  // them over, so the coach flags are collected before any finishing event is
  // classified rather than during the same pass.
  const coached = new Set<string>();
  for (const e of events) {
    if (e.payload.type === 'game_started' && e.payload.coach) coached.add(e.payload.gameId);
  }

  const kinds = new Map<string, Set<QualifyingKind>>();
  const puzzlesPerDay = new Map<string, number>();
  const add = (day: string, kind: QualifyingKind) => {
    const set = kinds.get(day) ?? new Set<QualifyingKind>();
    set.add(kind);
    kinds.set(day, set);
  };

  for (const e of events) {
    const day = e.deviceDay;
    const x = e.payload;
    switch (x.type) {
      case 'lesson_completed':
        add(day, 'lesson');
        break;
      case 'checkpoint_attempted':
        // `passed` is deliberately not read: sitting the checkpoint is the work.
        add(day, 'checkpoint');
        break;
      case 'game_reviewed':
        add(day, 'review');
        break;
      case 'game_finished':
        if (coached.has(x.gameId)) add(day, 'coached-game');
        break;
      case 'puzzle_attempted': {
        // The daily puzzle qualifies on its own; any five puzzles qualify as a
        // set. A learner who solves the daily puzzle and four others has both.
        if (x.source === 'daily') add(day, 'daily-puzzle');
        const n = (puzzlesPerDay.get(day) ?? 0) + 1;
        puzzlesPerDay.set(day, n);
        // "A SET of five puzzles" is a property of the DAY, so five attempts
        // spread over two days qualify neither of them.
        if (n === PUZZLES_IN_A_SET) add(day, 'puzzle-set');
        break;
      }
      default:
        break;
    }
  }

  const order: QualifyingKind[] = ['lesson', 'checkpoint', 'puzzle-set', 'review', 'coached-game', 'daily-puzzle'];
  return new Map(
    [...kinds.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, set]) => [day, order.filter((k) => set.has(k))]),
  );
}

/** The local days with at least one qualifying action, ascending. */
export function qualifyingDays(events: readonly LearnerEvent[]): string[] {
  return [...qualifyingDayIndex(events).keys()];
}

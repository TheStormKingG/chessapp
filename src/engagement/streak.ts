// `shiftDay`/`daysBetween` are general local-day arithmetic on `YYYY-MM-DD`
// strings that happen to live beside F-TS-1's swap rule. They are imported
// rather than copied because the reason they parse at UTC NOON — a local-midnight
// Date shifts by an hour across a daylight-saving boundary and `(a-b)/86_400_000`
// then returns 6.958 for six whole days — is exactly the bug this file would
// otherwise reintroduce, and a second copy would have to rediscover it.
import { daysBetween, shiftDay } from '@/tailored/schedule';

/**
 * F-EN-1, the streak, verbatim:
 *
 * > "One qualifying action a day extends the streak: a lesson, a checkpoint, a
 * > set of five puzzles, a game review, a coached game or the daily puzzle. If a
 * > day is missed and the learner holds a streak freeze, the freeze is used
 * > automatically at the end of that day and the streak continues. If no freeze
 * > is held, the streak pauses for a two-day grace period and resets at the end
 * > of the third day without a qualifying action. Freezes are earned by the
 * > weekly quest in F-EN-3 and up to two can be held. Nothing is sold, so there
 * > is no paid repair. Days are counted in the device's local time zone at the
 * > time of the action. Milestones at 3, 7, 14, 30, 60, 100, 200 and 365 days
 * > have their own animation and a shareable card."
 *
 * ── WHY A DAY WALK AND NOT A GAP CALCULATION ─────────────────────────────────
 *
 * The obvious implementation is arithmetic on the gap between the last two
 * qualifying days. It cannot work, because the freeze LEDGER is stateful: how
 * many freezes are held today depends on every grant and every automatic
 * consumption since the first one, and a consumption depends on whether a freeze
 * was held on that particular night. So the reducer walks the calendar one day at
 * a time from the first qualifying day to `today`, which is the only order in
 * which grants and consumptions interleave correctly. A two-year-old account is
 * about 700 iterations of integer work; callers memoise on the event list.
 *
 * ── WHAT "RESETS AT THE END OF THE THIRD DAY" MEANS, PRECISELY ────────────────
 *
 * With the last qualifying day D and no freezes: D+1 and D+2 are the two-day
 * grace period and the streak is PAUSED, not lost. D+3 is "the third day without
 * a qualifying action", and the reset happens at its END — so a qualifying action
 * taken at any point during D+3 still saves the streak, and from D+4 the streak
 * is zero. `graceDays` is 2 and the run resets when the third uncovered day has
 * ended, both stated as constants so the boundary is one place.
 *
 * ── THE TWO READINGS OF A FREEZE, AND WHICH ONE THIS IS ──────────────────────
 *
 * "The freeze is used automatically at the end of that day and the streak
 * continues" versus "resets at the end of the third day WITHOUT A QUALIFYING
 * ACTION". A frozen day is still a day without a qualifying action, so the two
 * sentences can be read as: (a) a freeze covers the day completely and the grace
 * counter restarts, or (b) a freeze keeps the streak alive but the day still
 * counts toward the three.
 *
 * This implements (a), for two reasons. "The streak continues" is the stronger of
 * the two phrasings, and under (b) a learner holding two freezes who misses four
 * days would lose the streak on the fourth despite having spent both freezes on
 * it, which makes a reward for completing a weekly quest into two-thirds of a
 * reward. The alternative is named here rather than left implicit, because it is
 * a choice and not a deduction.
 *
 * ── NOTHING IS SOLD ──────────────────────────────────────────────────────────
 *
 * There is no repair, no restore and no input by which a caller can add to
 * `days`. A freeze enters this file in exactly one way — `freezeGrantDays`, which
 * F-EN-3's weekly quest projects from the log — and leaves it in exactly one way,
 * automatically, at the end of a missed day.
 */

/** F-EN-1's "up to two can be held". */
export const MAX_FREEZES = 2;

/** F-EN-1's "a two-day grace period". */
export const GRACE_DAYS = 2;

/**
 * The number of consecutive uncovered days without a qualifying action at the end
 * of which the streak resets — the grace period plus the "third day".
 */
export const DAYS_TO_RESET = GRACE_DAYS + 1;

/** F-EN-1's milestones, ascending. */
export const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365] as const;

export type StreakStatus =
  /** No streak: nothing done yet, or the last one has already reset. */
  | 'none'
  /** A qualifying action has been taken today, so the streak includes today. */
  | 'extended-today'
  /** Alive, up to date, and nothing done today yet. */
  | 'at-risk'
  /** Inside the grace period: a day has been missed and no freeze covered it. */
  | 'paused';

export interface StreakInput {
  /** Local days with a qualifying action, any order, duplicates allowed. */
  qualifyingDays: readonly string[];
  /** Local days on which a streak freeze was earned, any order, duplicates allowed. */
  freezeGrantDays: readonly string[];
  /** The local day `now` falls on — `localDay(now)`, never a Date. */
  today: string;
}

export interface Streak {
  /** Days in the current run. Zero when there is no streak. */
  days: number;
  /**
   * The longest run this log has ever reached, including the current one.
   *
   * Tracked in the same walk rather than by a second pass: F-EN-5's "a 30-day
   * streak" is an achievement about a run the learner HAS HAD, and `days` forgets
   * it the moment the run resets — so an achievement keyed to `days` would be
   * taken away again, which is the one thing an achievement must never do.
   */
  bestDays: number;
  status: StreakStatus;
  /** The most recent qualifying day at or before `today`, or null. */
  lastQualifyingDay: string | null;
  /** Freezes held now, 0 to `MAX_FREEZES`. */
  freezes: number;
  /** The days a freeze was spent covering, ascending. Grows, never shrinks. */
  freezesSpentOn: string[];
  /** Consecutive uncovered days without a qualifying action so far, 0 to `GRACE_DAYS`. */
  graceDaysUsed: number;
  /**
   * The local day at the end of which this streak is lost if the learner does
   * nothing more and earns no further freeze. Null when there is no streak to
   * lose. A date the caller can print, never a duration to add.
   */
  loseAtEndOf: string | null;
  /**
   * The milestone reached BY TODAY'S action, or null. Non-null only on the day it
   * is reached and only when today was a qualifying day, because it is what
   * triggers F-EN-1's animation and shareable card and neither should fire on a
   * reload three days later.
   */
  milestoneToday: number | null;
  /** The next milestone above `days`, or null past the last one. */
  nextMilestone: number | null;
}

/** The value for a learner with no streak. Carries no day, because it is the same on every day. */
export function noStreak(): Streak {
  return {
    days: 0,
    bestDays: 0,
    status: 'none',
    lastQualifyingDay: null,
    freezes: 0,
    freezesSpentOn: [],
    graceDaysUsed: 0,
    loseAtEndOf: null,
    milestoneToday: null,
    nextMilestone: MILESTONES[0],
  };
}

/**
 * The streak as it stands on `today`.
 *
 * Pure: it takes the day, never a clock. Every boundary in F-EN-1 — the grace
 * day, the third day, a freeze consuming itself, two freezes, a day that crosses
 * a time-zone change — is a property of the day strings handed in, so every one
 * of them is reachable from a test without mocking time.
 */
export function streakOn(input: StreakInput): Streak {
  const today = input.today;

  const qualifying = new Set(input.qualifyingDays);
  const grants = new Map<string, number>();
  for (const d of input.freezeGrantDays) grants.set(d, (grants.get(d) ?? 0) + 1);
  if (qualifying.size === 0 && grants.size === 0) return noStreak();

  /*
   * DAYS AFTER `today` ARE EXCLUDED BY THE WALK, not by a filter.
   *
   * A device whose clock moved backwards, or a log synced from a device an hour
   * ahead, can hold a day later than `today`, and such a day must not credit a
   * streak the learner has not earned. An earlier version of this function
   * filtered both input lists for it. That filter could not fail: the walk below
   * runs from `first` to `today` inclusive, so a later day is never visited, and
   * every input that the filter changed produced an identical result — a guard
   * indistinguishable from its own absence, which no test can hold in place.
   *
   * The bound is the walk's own `span`, asserted directly by the test named "a
   * future day is ignored rather than trusted". Removing the filter also fixed a
   * case it got wrong: a freeze granted in the past, with only a future
   * qualifying day, used to disappear, because an all-future `qualifyingDays`
   * returned early before the grant was ever read.
   */


  /*
   * The walk starts at the earliest day either list mentions, not at the first
   * qualifying day. A grant that lands BEFORE the first qualifying action is
   * still a freeze the learner holds, and starting at the first action dropped
   * it — the freeze simply vanished. Nothing else changes: `days` stays 0 until
   * the first qualifying day, so no missed day before it can spend anything.
   */
  const first = [...qualifying, ...grants.keys()].sort((a, b) => a.localeCompare(b))[0];
  if (first === undefined) return noStreak();

  let days = 0;
  let bestDays = 0;
  let freezes = 0;
  const freezesSpentOn: string[] = [];
  let graceDaysUsed = 0;
  let lastQualifyingDay: string | null = null;

  const span = daysBetween(first, today);
  for (let i = 0; i <= span; i += 1) {
    const day = shiftDay(first, i);

    // Grants land before the end of the day they were earned on, so a freeze
    // earned today can cover tonight's miss. Capped at the moment of granting:
    // "up to two can be held" is a cap on holdings, so a third grant is lost
    // rather than banked.
    const granted = grants.get(day) ?? 0;
    if (granted > 0) freezes = Math.min(MAX_FREEZES, freezes + granted);

    if (qualifying.has(day)) {
      // One qualifying action a day extends the streak, whether the run was
      // unbroken or paused inside the grace period — resuming from a pause is
      // what the grace period is for.
      days += 1;
      bestDays = Math.max(bestDays, days);
      graceDaysUsed = 0;
      lastQualifyingDay = day;
      continue;
    }

    // A missed day is only settled at its END, so today — which has not ended —
    // never consumes a freeze and never spends a grace day. That is also why
    // `status` below can say "at-risk" rather than pretending the day is lost.
    if (day === today) break;

    if (days === 0) continue; // nothing to protect yet

    if (freezes > 0) {
      freezes -= 1;
      freezesSpentOn.push(day);
      // See the header: a covered day restarts the grace counter and does not add
      // to the streak. The streak is preserved, not extended.
      graceDaysUsed = 0;
      continue;
    }

    graceDaysUsed += 1;
    if (graceDaysUsed >= DAYS_TO_RESET) {
      days = 0;
      graceDaysUsed = 0;
      lastQualifyingDay = null;
    }
  }

  const extendedToday = qualifying.has(today);
  const status: StreakStatus =
    days === 0 ? 'none' : extendedToday ? 'extended-today' : graceDaysUsed > 0 ? 'paused' : 'at-risk';

  return {
    days,
    bestDays,
    status,
    lastQualifyingDay,
    freezes,
    freezesSpentOn,
    graceDaysUsed,
    loseAtEndOf: days === 0 ? null : lossDay(today, freezes, graceDaysUsed, extendedToday),
    milestoneToday: extendedToday && (MILESTONES as readonly number[]).includes(days) ? days : null,
    nextMilestone: MILESTONES.find((m) => m > days) ?? null,
  };
}

/**
 * The day at the end of which the streak is lost, given nothing more is done.
 *
 * Counted forward rather than derived from the last qualifying day: every held
 * freeze buys one whole day, and the grace days already used are days that have
 * been spent. A learner who has acted today still has today's own night intact,
 * so the count starts tomorrow.
 */
function lossDay(today: string, freezes: number, graceDaysUsed: number, extendedToday: boolean): string {
  const from = extendedToday ? shiftDay(today, 1) : today;
  const uncoveredDaysLeft = DAYS_TO_RESET - graceDaysUsed;
  return shiftDay(from, freezes + uncoveredDaysLeft - 1);
}

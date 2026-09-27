/**
 * F-TS-1's rate limit, verbatim:
 *
 * > "The daily plan (F-HM-2) swaps in a tailored session in place of the path's
 * > lesson at most twice a week, so the path still progresses."
 *
 * and F-HM-7, which says the same thing from the plan's side:
 *
 * > "This happens at most twice a week so the path keeps moving, and the learner
 * > can decline it and keep the path's plan."
 *
 * ── WHY A ROLLING SEVEN DAYS AND NOT A CALENDAR WEEK ─────────────────────────
 *
 * "Twice a week" has two readings and they are not equally honest. Under a
 * calendar week a learner can take a tailored session on Saturday, Sunday, Monday
 * and Tuesday — two in each of two weeks, four in four days, and the path has not
 * moved for four days, which is the exact outcome the clause exists to prevent. A
 * rolling window of the seven days ending today cannot be gamed that way, so it is
 * the reading that serves the stated purpose.
 *
 * The day is the LOCAL day, the same `localDay()` string the event log stores in
 * `deviceDay`, so the rule agrees with the day boundary the rest of the app shows
 * the learner.
 *
 * ── AND WHY ONE PER DAY IS A SEPARATE ANSWER ─────────────────────────────────
 *
 * A second swap on a day that already has one is refused with its own reason
 * rather than as a quota failure: the remedy differs (come back tomorrow versus
 * the path needs to move first), and F-TS-1's session IS the day's plan, so there
 * is nothing for a second one to replace.
 */

/** F-TS-1's "twice". */
export const SWAPS_PER_WEEK = 2;

/** The window "a week" means here, in days, counted inclusively from today. */
export const WINDOW_DAYS = 7;

export type SwapReason = 'allowed' | 'already-today' | 'quota-reached';

export interface SwapDecision {
  allowed: boolean;
  reason: SwapReason;
  /** Swaps inside the window, including today's. */
  used: number;
  /**
   * The local day on which a swap becomes possible again, or null when one is
   * possible now. A date the caller can print, never a duration to add.
   */
  nextEligibleDay: string | null;
}

/**
 * Local-day arithmetic on `YYYY-MM-DD` strings.
 *
 * Parsed at UTC noon, not at local midnight: a local-midnight `Date` shifts by an
 * hour across a daylight-saving boundary and `(a - b) / 86_400_000` then returns
 * 6.958 where six whole days passed, which truncates to 6 in one direction and 7
 * in the other. Noon keeps every real day exactly one day apart whatever the
 * offset, and the return value is whole days by construction.
 */
export function dayToUtcNoon(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtcNoon(to) - dayToUtcNoon(from)) / 86_400_000);
}

/** `day` shifted by `n` days, as a `YYYY-MM-DD` string. */
export function shiftDay(day: string, n: number): string {
  const t = new Date(dayToUtcNoon(day) + n * 86_400_000);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * May the plan swap in a tailored session today?
 *
 * `history` is the local days on which a tailored session was taken, in any order,
 * with or without duplicates. Days after `today` are ignored rather than trusted:
 * a device whose clock moved backwards would otherwise lock the learner out of the
 * feature for a week.
 */
export function swapAllowed(history: readonly string[], today: string): SwapDecision {
  // Duplicates collapse: two sessions recorded for one day were still one day on
  // which the path did not move, and the clause counts days.
  const days = [...new Set(history)].filter((d) => daysBetween(d, today) >= 0);
  const inWindow = days.filter((d) => daysBetween(d, today) < WINDOW_DAYS).sort((a, b) => b.localeCompare(a));

  if (inWindow.includes(today)) {
    return { allowed: false, reason: 'already-today', used: inWindow.length, nextEligibleDay: shiftDay(today, 1) };
  }
  if (inWindow.length >= SWAPS_PER_WEEK) {
    // The day the quota frees: when the SWAPS_PER_WEEK-th most recent swap falls
    // out of the window, one slot is open again.
    const blocking = inWindow[SWAPS_PER_WEEK - 1];
    return {
      allowed: false,
      reason: 'quota-reached',
      used: inWindow.length,
      nextEligibleDay: blocking === undefined ? null : shiftDay(blocking, WINDOW_DAYS),
    };
  }
  return { allowed: true, reason: 'allowed', used: inWindow.length, nextEligibleDay: null };
}

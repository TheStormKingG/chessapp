import type { LearnerEvent } from '@/data/events';

/**
 * F-ON-8, the GATE only.
 *
 * > "Notification permission is requested only after the learner has completed
 * > two days of activity, and only in response to a tap on a 'remind me'
 * > control."
 *
 * WHAT IS HERE AND WHAT IS DELIBERATELY NOT. This file is the rule, as a pure
 * function with a test. There is no "remind me" control, no service-worker
 * subscription, no scheduling and no copy, because the engagement layer that
 * owns all four (PRD 8.5, F-EN) is not built. A notification permission prompt
 * is the least reversible thing this app can do to a learner — a denial is
 * permanent in every browser and cannot be asked again — so the half of the
 * feature worth shipping first is the half that refuses.
 *
 * The caller that will one day ask is F-EN's reminder control. When it arrives
 * it calls `mayRequestNotificationPermission` and requests only on
 * `{ allowed: true }`; until then the rule has no caller, which is a stated
 * absence rather than a hidden one.
 */

/** F-ON-8: "two days of activity". */
export const ACTIVITY_DAYS_BEFORE_REMINDERS = 2;

/**
 * The distinct local days on which the learner did anything, ascending.
 *
 * Read off `deviceDay`, which every event already carries in the device's own
 * time zone (`data/events.ts`) — not off `createdAt`, whose UTC date can put an
 * evening session on the following day and turn one day of activity into two.
 *
 * The projection is no use here: `Progress` keeps `lastEventAt` and no per-day
 * history, which is the same reason `path/progress.ts` records for not showing a
 * day streak. Two days of activity is a question about the log, so it is asked
 * of the log.
 */
export function activityDays(events: readonly LearnerEvent[]): string[] {
  return [...new Set(events.map((e) => e.deviceDay))].sort();
}

export interface ReminderRequest {
  /** Distinct days of activity so far — `activityDays(...).length`. */
  activeDays: number;
  /**
   * True only when this call is the direct result of the learner tapping a
   * "remind me" control. An effect, a mount, a timer and a page load are all
   * false; there is no "probably a tap".
   */
  fromTap: boolean;
}

export type ReminderDecision =
  | { allowed: true }
  | { allowed: false; reason: 'too-few-days' | 'not-a-tap' };

/**
 * Whether the browser's permission prompt may be raised right now.
 *
 * The two conditions are independent and both must hold, so the refusal names
 * which one failed — a single boolean would make a caller that was denied for
 * the wrong reason indistinguishable from one that was denied for the right
 * one. Activity is checked first because it is the condition a caller cannot
 * fix by trying again.
 *
 * The browser's own permission state is not an input. `Notification.permission`
 * is enforced by the browser whatever this function says, and reading it here
 * would make the rule impure for a check that is already unavoidable.
 */
export function mayRequestNotificationPermission(r: ReminderRequest): ReminderDecision {
  if (r.activeDays < ACTIVITY_DAYS_BEFORE_REMINDERS) return { allowed: false, reason: 'too-few-days' };
  if (!r.fromTap) return { allowed: false, reason: 'not-a-tap' };
  return { allowed: true };
}

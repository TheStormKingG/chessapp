/**
 * The three answers onboarding collects (PRD 8.1 F-ON-1, F-ON-2, F-ON-3).
 *
 * Each option list is declared once, here, and both the screen and the store
 * read it: a screen that rendered its own labels and a store that validated its
 * own set is the shape in which the two drift, and the drift is invisible
 * because each half is internally consistent.
 */

/** F-ON-1: "Why chess?", six answers. */
export type WhyChess =
  | 'beat_a_friend'
  | 'online_play'
  | 'for_fun'
  | 'club_or_tournament'
  | 'help_a_child'
  | 'curious';

export interface Option<T> {
  value: T;
  /** What the learner reads and taps. */
  label: string;
}

/**
 * F-ON-1 asks for "four to six answers" and names six, so all six ship. The
 * order is the PRD's own.
 */
export const WHY_OPTIONS: readonly Option<WhyChess>[] = [
  { value: 'beat_a_friend', label: 'Beat a friend or family member' },
  { value: 'online_play', label: 'Get better at online play' },
  { value: 'for_fun', label: 'Just for fun' },
  { value: 'club_or_tournament', label: 'Play in a club or tournament' },
  { value: 'help_a_child', label: 'Help a child learn' },
  { value: 'curious', label: 'Just curious' },
];

/**
 * F-ON-2: the learner's level, four options, each mapped to a starting point.
 *
 * `plays_online` is the one that routes to import (F-IM-5). Import is not
 * built; see `levelRoute` in `route.ts` for the single seam where it attaches.
 */
export type LearnerLevel = 'new' | 'know_rules' | 'casual' | 'plays_online';

export const LEVEL_OPTIONS: readonly Option<LearnerLevel>[] = [
  { value: 'new', label: 'New to chess' },
  { value: 'know_rules', label: 'I know the rules' },
  { value: 'casual', label: 'I play casually' },
  { value: 'plays_online', label: 'I play online already' },
];

/**
 * What each level answer means for where the learner starts, in the learner's
 * own words. Shown under the option so the consequence of the answer is stated
 * before it is given rather than discovered afterwards.
 */
export const LEVEL_DETAIL: Record<LearnerLevel, string> = {
  new: 'Start at the very beginning, with the board and the pieces.',
  know_rules: 'A five-question check on the rules, then straight past them.',
  casual: 'A short placement test finds the right place to start.',
  plays_online: 'A short placement test finds the right place to start.',
};

/** F-ON-3: the daily goal, in minutes. */
export type DailyGoal = 5 | 10 | 15 | 20;

export const GOAL_OPTIONS: readonly Option<DailyGoal>[] = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
];

/** The default the goal screen opens on, and what an unanswered store reports. */
export const DEFAULT_DAILY_GOAL: DailyGoal = 10;

export function isDailyGoal(n: number): n is DailyGoal {
  return GOAL_OPTIONS.some((o) => o.value === n);
}

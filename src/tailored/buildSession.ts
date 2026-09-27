import type { DailyGoal } from '@/onboarding/types';
import { MAX_SET, MIN_SET } from './practiceSet';
import { type SwapDecision, swapAllowed } from './schedule';
import type { TakenSession } from './store';
import { takenDays } from './store';

/**
 * F-TS-1, "What a tailored session is", verbatim:
 *
 * > "A one-off session built from the profile rather than from the path, sized to the
 * > learner's daily goal. It contains one tailored lesson (F-TS-3), a practice set of
 * > six to ten puzzles (F-TS-4), one targeted game or mini-game (F-TS-5), and the
 * > review of that game. It is offered whenever the profile changes materially (a new
 * > weakness enters the top three, or an import completes) and on demand from the
 * > profile screen with 'Train on this'. The daily plan (F-HM-2) swaps in a tailored
 * > session in place of the path's lesson at most twice a week, so the path still
 * > progresses."
 *
 * ── WHICH CLAUSE THE TWICE-A-WEEK CAP GOVERNS ────────────────────────────────
 *
 * The sentence is specific: it is the DAILY PLAN that swaps one in at most twice a
 * week. "Train on this" is the learner asking, from the profile screen, and nothing
 * in F-TS-1 or F-HM-7 caps that. So the cap gates the automatic swap, an on-demand
 * session is always allowed, and an on-demand session is still RECORDED — so it
 * counts against the next automatic swap, which is what keeps the path moving.
 *
 * That reading is stated because the other one is defensible too, and a reader
 * finding an uncapped path into the feature should find the argument here rather
 * than conclude the rule was forgotten.
 *
 * ── AND WHAT THE DAILY PLAN ACTUALLY IS TODAY ────────────────────────────────
 *
 * F-HM-2's daily plan is not built. src/screens/TodayScreen.tsx shows the path's
 * active node, the unit's progress and recently finished lessons; there is no plan
 * object with a lesson, puzzle and game item for a session to replace. So the swap
 * this module decides on is applied at the one place a session can be entered from
 * today — the offer on Today and the profile screen's "Train on this" — and F-HM-7's
 * "the plan's lesson, puzzle and game items are replaced" has nothing to replace
 * yet. The rule is implemented and tested; the surface it governs is smaller than
 * the requirement's, and that is a gap in F-HM-2, not a stub here.
 */

/** How a session is sized to F-ON-3's daily goal, in minutes. */
export interface SessionSize {
  puzzles: number;
  /**
   * `optional` at the smallest goal: a bot game and its review do not fit in five
   * minutes, and the honest thing is to offer it rather than to promise it and
   * overrun the learner's own stated budget by a factor of three.
   */
  game: 'included' | 'optional';
}

export function sizeFor(goal: DailyGoal): SessionSize {
  switch (goal) {
    case 5:
      return { puzzles: MIN_SET, game: 'optional' };
    case 10:
      return { puzzles: 7, game: 'included' };
    case 15:
      return { puzzles: 9, game: 'included' };
    case 20:
      return { puzzles: MAX_SET, game: 'included' };
  }
}

export type OfferReason =
  /** The profile changed materially since the learner last saw it. */
  | 'profile-changed'
  /** The learner asked, from the profile screen. */
  | 'on-demand'
  | 'no-target'
  /** F-TS-7: too few games for a first session. */
  | 'too-early'
  /** The learner turned this same offer down. */
  | 'declined'
  /** F-TS-1's twice a week. */
  | 'quota-reached'
  | 'already-today'
  /** Nothing has changed since the last session, so there is nothing new to offer. */
  | 'unchanged';

export interface Offer {
  offered: boolean;
  reason: OfferReason;
  /** The swap decision behind it, for a screen that wants to say when. */
  swap: SwapDecision;
}

export interface OfferInput {
  /** `profileSignature(profile)` — the same test Today's "it has changed" link uses. */
  signature: string;
  /** The signature of the offer the learner declined, if any. */
  declined: string | null;
  taken: readonly TakenSession[];
  today: string;
  /** Whether F-TS-7's gate has opened. */
  firstSessionDue: boolean;
  /** Whether `chooseTarget` found a weakness in band. */
  hasTarget: boolean;
  /** True when the learner pressed "Train on this". */
  onDemand?: boolean;
}

/**
 * Whether to offer a session, and why not when not.
 *
 * Every refusal has its own reason. A screen that could only say "no session today"
 * would be unable to tell a learner whose weaknesses are all later on the path from
 * one who has simply had two this week, and those need different sentences.
 */
export function offerDecision(input: OfferInput): Offer {
  const swap = swapAllowed(takenDays(input.taken), input.today);
  const no = (reason: OfferReason): Offer => ({ offered: false, reason, swap });

  if (!input.hasTarget) return no('no-target');
  // F-TS-7's gate is checked BEFORE the on-demand branch, deliberately. "The first
  // tailored session is offered after the learner's tenth in-app game" is a rule about
  // when the feature exists for a learner, not about which button reached it: a
  // session built from three games would rank a weakness on three games' evidence,
  // which F-SW-6 already refuses to draw comparisons from.
  if (!input.firstSessionDue) return no('too-early');
  if (input.onDemand === true) {
    // The learner asked. What still stops them is having already done one today — the
    // session IS the day's work, and a second would replace itself. The weekly cap does
    // not: F-TS-1 puts that cap on the daily plan's swap, not on this button.
    return swap.reason === 'already-today'
      ? no('already-today')
      : { offered: true, reason: 'on-demand', swap };
  }
  if (input.declined === input.signature) return no('declined');
  // Nothing new since the last session: the same weaknesses, the same games. Offering
  // again would be the notice that is always on, which src/profile/seen.ts argues is
  // not a notice.
  if (input.taken.some((t) => t.signature === input.signature)) return no('unchanged');
  if (!swap.allowed) return no(swap.reason === 'already-today' ? 'already-today' : 'quota-reached');
  return { offered: true, reason: 'profile-changed', swap };
}

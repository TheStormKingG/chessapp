/**
 * F-ON-4 and F-ON-7, the POLICY only.
 *
 * > F-ON-4 "The learner completes a first lesson or the placement test before
 * > any sign-up prompt. Progress is stored locally as a guest."
 * > F-ON-7 "A soft sign-up prompt appears after the first daily plan is
 * > completed and again at the first checkpoint, and explains that an account
 * > keeps progress safe across devices. Sign-up is never required to keep
 * > learning."
 *
 * WHY THERE IS NO PROMPT COMPONENT HERE. Two of F-ON-7's three moving parts do
 * not exist in this build:
 *
 *   - There is no daily plan. PRD 8.2 (F-HM) owns it, nothing in `src/` mentions
 *     it, and "after the first daily plan is completed" therefore has nothing to
 *     fire on. It is an INPUT to this function rather than something derived
 *     here, so the missing dependency is visible in the signature instead of
 *     being quietly replaced by "after the first lesson", which is a different
 *     and easier condition.
 *   - There is no sign-up surface. `sync/AuthContext.tsx` and `sync/flush.ts`
 *     implement everything that happens AFTER a sign-in, and nothing anywhere
 *     starts one; F-AC owns that screen. A panel that explains an account keeps
 *     progress safe and then leads nowhere is worse than no panel, for the same
 *     reason a permission prompt wired to nothing is worse than a tested rule
 *     with no caller.
 *
 * So this is the rule, tested, with the one thing it can be sure of: the gate
 * that F-ON-4 asks for. When F-AC's sign-in screen lands, the component that
 * offers it calls `signupPromptDue` and shows nothing on `null`.
 */

/** The two occasions F-ON-7 names. Each is offered at most once. */
export type SignupOccasion = 'first_plan' | 'first_checkpoint';

export interface SignupPromptInput {
  /**
   * F-ON-4's gate: a first lesson completed, or the placement test finished.
   * Until this is true nothing may be offered, whatever else is.
   */
  firstActivityDone: boolean;
  /**
   * F-ON-7's first occasion. Supplied by the daily plan (PRD 8.2 F-HM), which is
   * not built — so today's only honest value is `false`.
   */
  dailyPlanCompleted: boolean;
  /** F-ON-7's second occasion: the learner has passed a checkpoint. */
  firstCheckpointPassed: boolean;
  /** Occasions the learner has already been offered and waved away. */
  dismissed: readonly SignupOccasion[];
  /** An account already exists, so there is nothing to offer. */
  signedIn: boolean;
}

/**
 * Which soft prompt is due, or null for none.
 *
 * Never throws and never returns an occasion twice: "soft" in F-ON-7 means the
 * learner can decline it and keep learning, and a prompt that returns after
 * being declined is not soft. The plan occasion is checked first because it is
 * the earlier of the two; a learner who reaches a checkpoint without ever
 * having been offered the plan prompt is offered the plan one, so neither
 * occasion is lost to the order they happen in.
 */
export function signupPromptDue(i: SignupPromptInput): SignupOccasion | null {
  if (i.signedIn) return null;
  // F-ON-4. This is the condition that makes the other two safe to evaluate.
  if (!i.firstActivityDone) return null;
  const offered = new Set(i.dismissed);
  if (i.dailyPlanCompleted && !offered.has('first_plan')) return 'first_plan';
  if (i.firstCheckpointPassed && !offered.has('first_checkpoint')) return 'first_checkpoint';
  return null;
}

/**
 * The one line F-ON-7 asks the prompt to explain. Stated here rather than in a
 * screen so the copy and the rule ship together, and so the day F-AC renders it
 * the sentence is not written again from memory.
 */
export const SIGNUP_BENEFIT = 'An account keeps your progress safe and carries it to your other devices.';

/** F-ON-7: "Sign-up is never required to keep learning." */
export const SIGNUP_IS_OPTIONAL = true;

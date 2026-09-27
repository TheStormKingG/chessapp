/**
 * PRD F-ER-7, the PRESENTATION RULE ONLY.
 *
 * > "If a server-side recomputation changes a rating, a streak or a checkpoint
 * > result, the change is shown as a normal update with a one-line reason, never
 * > as an error."
 *
 * ── THIS REQUIREMENT IS BLOCKED, AND THIS FILE IS WHAT CAN HONESTLY SHIP ─────
 *
 * There is no server-side recomputation in this app, and there is no server that
 * could do one. Measured against the repository on 2026-09-27:
 *
 *   • `supabase/migrations/` holds ONE function, `handle_new_user()`, a trigger
 *     that inserts a profile row when an auth user is created. It computes
 *     nothing about a rating, a streak or a checkpoint.
 *   • There are no edge functions, no scheduled jobs, no RPCs. `src/sync/` is
 *     two files of substance: `flush.ts` pushes and pulls rows of
 *     `public.events`, and `merge.ts` combines two event logs by id. Neither
 *     computes a figure; the server is a bucket of the learner's own events.
 *   • Every figure F-ER-7 names is derived ON THE DEVICE from that log —
 *     `puzzles/rating.ts` for the rating, `engagement/streak.ts` for the streak,
 *     `checkpoint/CheckpointMachine.ts` for a checkpoint result — by
 *     `data/reduce.ts`, which runs in the browser.
 *
 * So the trigger the clause describes cannot fire. Adding a message about it
 * would be a message for an event that has no producer, and the file it lived in
 * would read as coverage.
 *
 * ── WHY THE RULE SHIPS ANYWAY, WITH NO CALLER ────────────────────────────────
 *
 * Because the rule is the part with a wrong answer available, and it is the part
 * a later change gets wrong under pressure. The figure most likely to be
 * recomputed is one that goes DOWN — a rating corrected downward, a streak
 * recounted shorter — and the reflex when writing that screen is to reach for the
 * vocabulary of a failure, because a number falling feels like one. F-ER-7 exists
 * precisely to forbid that, and a rule with a test forbids it in a way a sentence
 * in a PRD does not.
 *
 * This is the shape `onboarding/notifications.ts` used for F-ON-8's gate: the
 * rule, as a pure function with a test, and a stated absence of a caller rather
 * than a hidden one. That gate has since acquired its caller
 * (`engagement/reminders.ts`) without its rule changing.
 *
 * THE CALLER THAT WILL ONE DAY ARRIVE. Whatever pulls a recomputed figure down
 * from a server — and it will arrive through `sync/flush.ts`, since that is the
 * only thing that talks to one — calls `recomputeNotice` and renders the result
 * with whatever the app's ordinary update affordance is at the time. It must not
 * render it through an error component, and `tone` is there so that a component
 * which takes a tone cannot be handed anything else.
 *
 * NOT TO BE CONFUSED WITH A CLIENT-SIDE RECOMPUTE. Figures already change on
 * this device when `merge.ts` brings in another device's events and
 * `data/reduce.ts` replays the merged log — the rating genuinely moves, with no
 * server having computed anything. That is a real event this app produces today
 * and F-ER-7 does not cover it: the clause is about a SERVER's recomputation. The
 * rule below is written so it would serve that case too if the app ever decided
 * to narrate it, which is why `reason` includes `'another-device'`.
 */

/** The three figures F-ER-7 names, and nothing else. */
export type RecomputedFigure = 'puzzle-rating' | 'day-streak' | 'checkpoint';

/**
 * Why the figure moved. A CLOSED set, because "a one-line reason" that is free
 * text is a reason somebody writes at the keyboard, and the keyboard is where
 * "something went wrong" gets typed.
 */
export type RecomputeReason =
  /** Activity arrived from another device the learner is signed in on. */
  | 'another-device'
  /** The figure was worked out again over the learner's whole history. */
  | 'recount'
  /** The underlying record was corrected — a puzzle's answer, a checkpoint's marking. */
  | 'correction';

export interface Recomputation {
  figure: RecomputedFigure;
  /** The figure the learner last saw. */
  before: number;
  /** The figure now. */
  after: number;
  reason: RecomputeReason;
}

export interface RecomputeNotice {
  /** The one line. */
  text: string;
  /**
   * Always `'update'`. It is a field rather than an implicit convention so that a
   * component which renders by tone cannot be handed this notice as an error —
   * the type makes the wrong rendering unrepresentable rather than merely
   * discouraged.
   */
  tone: 'update';
}

const FIGURE: Record<RecomputedFigure, string> = {
  'puzzle-rating': 'Your puzzle rating',
  'day-streak': 'Your streak',
  checkpoint: 'Your checkpoint score',
};

/**
 * The reason, as a clause that completes "… is now N, <reason>".
 *
 * Each one states a CAUSE and nothing about quality. "after a recount" is a fact;
 * "after correcting an error" would be a confession, and the learner did not make
 * one.
 */
const REASON: Record<RecomputeReason, string> = {
  'another-device': 'now that your games from your other device have come in',
  recount: 'after adding up your whole history again',
  correction: 'now that the puzzle behind it has been put right',
};

const UNIT: Record<RecomputedFigure, (n: number) => string> = {
  'puzzle-rating': (n) => String(n),
  'day-streak': (n) => `${String(n)} day${n === 1 ? '' : 's'}`,
  checkpoint: (n) => String(n),
};

/**
 * F-ER-7's sentence.
 *
 * ONE line, the new figure, and the reason. Deliberately NOT here: the word
 * "error", any apology, any exclamation, and any celebration. A figure that went
 * up is not a reward the app is handing out — it is a correction that happens to
 * favour the learner — and dressing it up would make the same event read
 * differently depending on its direction, which is the asymmetry F-ER-7's "never
 * as an error" is the other half of.
 *
 * The OLD figure is stated too. A learner who is told their streak "is now 4
 * days" and remembers 6 is left doing the subtraction and wondering whether they
 * misremembered; saying both numbers is what makes the line an update rather than
 * a puzzle.
 */
export function recomputeNotice(r: Recomputation): RecomputeNotice {
  const unit = UNIT[r.figure];
  return {
    text: `${FIGURE[r.figure]} has moved from ${unit(r.before)} to ${unit(r.after)}, ${REASON[r.reason]}.`,
    tone: 'update',
  };
}

/**
 * Whether there is anything to say at all.
 *
 * A recomputation that lands on the figure the learner already has is not an
 * update and must be silent: F-ER-7 asks for a change to be SHOWN, and a
 * notification about a number that did not move is a notification about nothing.
 * It is also the common case once a server exists — most recomputations agree
 * with the client — so a caller that skipped this check would narrate every sync.
 */
export function isWorthShowing(r: Recomputation): boolean {
  return r.before !== r.after;
}

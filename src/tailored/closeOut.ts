import { plural } from '@/app/plural';
import type { Review } from '@/review/types';
import { shiftDay } from './schedule';

/**
 * F-TS-6, "Closing the loop", verbatim:
 *
 * > "The session ends with the review of the game, a one-line verdict on the weakness
 * > ('two forks seen, one missed, better than last week'), and the next check date,
 * > when the app will look at whether the weakness has moved. The result is written
 * > back to the profile so the next session targets the next thing."
 *
 * ── "WRITTEN BACK TO THE PROFILE" NEEDS NO WRITE ─────────────────────────────
 *
 * The profile is a projection (src/profile/buildProfile.ts): a pure function of the
 * cached reviews plus the dates behind them, re-derived on every read. So reviewing
 * the session's game IS the write-back — the new errors enter the error log, the cost
 * ranking moves, and the next session targets whatever is costliest then. There is
 * no tailored-session row to keep in step with it, and adding one would be a third
 * copy of a truth that already has two derivations and one source.
 *
 * ── WHAT THE VERDICT CAN HONESTLY SAY ────────────────────────────────────────
 *
 * The requirement's example is "two forks seen, one missed". "Seen" is a count of
 * chances the learner TOOK, and nothing records it: `Review.errors` records the
 * mistakes made, not the opportunities met. Counting a "seen" would mean counting
 * every position in which the motif was available and the learner handled it, which
 * is a tagger pass over every ply of the game that src/tagger/ does not do.
 *
 * So the verdict says the half that is recorded — how often the weakness happened in
 * this game, against the rate the learner was running before it — and says it in
 * those terms. That is the same discipline `ErrorEntry.typical` is documented with:
 * a number the data supports, not the number the example sentence would like.
 */

/** How long until the app looks again. A week: long enough for games to happen. */
export const CHECK_DAYS = 7;

export interface Closing {
  /** F-TS-6's one line. */
  line: string;
  /** F-TS-6's next check date, as a local day. */
  nextCheckDay: string;
}

/** How often a theme occurred in one game's review. */
export function occurrencesIn(review: Review, theme: string): number {
  return review.errors.filter((e) => e.theme === theme).length;
}

export function closingVerdict(input: {
  /** The learner-facing name of the weakness, from the profile. */
  name: string;
  /** Occurrences in the session's game. */
  inThisGame: number;
  /**
   * The learner's occurrences per game before this session, or null when there is no
   * history to compare against — the honest answer for a first session.
   */
  previousPerGame: number | null;
  today: string;
  days?: number;
}): Closing {
  const nextCheckDay = shiftDay(input.today, input.days ?? CHECK_DAYS);
  const subject = input.name.toLowerCase();
  const happened =
    input.inThisGame === 0
      ? `No sign of ${subject} in that game`
      : `${capitalise(subject)} still happened ${plural(input.inThisGame, 'time')} in that game`;

  if (input.previousPerGame === null) {
    // No comparison, and none implied. A first session has nothing to be better than.
    return { line: `${happened}. This is the first check, so there is nothing to compare it with yet.`, nextCheckDay };
  }
  const before = input.previousPerGame;
  // A tenth of an occurrence per game is inside the noise of a handful of games, so
  // the wording does not claim a direction for it.
  const moved = input.inThisGame - before;
  const comparison =
    Math.abs(moved) < 0.1
      ? `about the same as your ${before.toFixed(1)} a game before it`
      : moved < 0
        ? `better than your ${before.toFixed(1)} a game before it`
        : `worse than your ${before.toFixed(1)} a game before it`;
  return { line: `${happened} — ${comparison}.`, nextCheckDay };
}

function capitalise(s: string): string {
  return s.length === 0 ? s : `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`;
}

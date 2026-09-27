import type { EventPayload, LearnerEvent } from '@/data/events';

/**
 * F-EN-2, the award table, verbatim:
 *
 * > "Lesson 10 to 20 by length, puzzle 2 to 5 weighted by difficulty,
 * > checkpoint 50, story game 20, bot game 10 regardless of result, review of
 * > any game 15, review of a loss 25, drill 5 to 10. XP is never paid for a win
 * > alone and never deducted."
 *
 * WHY THIS IS A SEPARATE FILE FROM `data/reduce.ts`. The rates were spread
 * across four `case` arms of the projection, three of them wrong against the
 * table above, and there was no single place to read the answer to "what does
 * this action pay?" — so the table could not be tested as a table. Here it is
 * one pure function of one event plus the small amount of log context the rate
 * depends on, and `reduceProgress` supplies that context from the state it is
 * already carrying. The projection keeps owning WHEN an award happens (once per
 * game, once per unit); this file owns HOW MUCH.
 *
 * ── WHAT THE LOG CAN AND CANNOT PAY FOR ──────────────────────────────────────
 *
 * Six of the eight rates are payable from events this app already appends. The
 * two that are not are stated as constants with no caller rather than left out,
 * because a missing rate reads as an oversight and a rate with no event source
 * reads as what it is:
 *
 *   - STORY GAME 20. There is no story-game event and no story-game content:
 *     PRD 7.5's annotated guess-the-move games are Beta-phase content (PRD
 *     §"2. Beta"), and `EventPayload` has no member that could carry one. The
 *     rate is declared and `xpForEvent` has no arm that returns it.
 *
 *   - DRILL 5 TO 10, paid at the floor. A completed fix-it drill is recorded as
 *     `game_reviewed.drillCompleted`, a boolean, so the log says a drill was
 *     finished and not how long it was. F-EN-2's range is a function of length
 *     (three to five positions, `review/fixIt.ts`), so the only honest value
 *     available from the log is the bottom of the band. Widening
 *     `game_reviewed` with the drill's length is what would make the range
 *     real; it is a schema change and is not made here.
 *
 * ── THE INVARIANT ────────────────────────────────────────────────────────────
 *
 * "XP is never paid for a win alone and never deducted" is the only sentence in
 * F-EN-2 that is a rule rather than a number, so it is the one worth a test of
 * its own (`xp.test.ts`). It has two halves and they are checked differently:
 *
 *   - NEVER DEDUCTED. `xpForEvent` returns a non-negative integer for every
 *     member of `EventPayload`, so no arm can subtract and no caller has to
 *     clamp.
 *
 *   - NEVER FOR A WIN ALONE. Every award is invariant under the RESULT of the
 *     action that earned it: a won bot game and a lost bot game both pay 10, a
 *     solved puzzle and a failed one both pay the same for that puzzle, and a
 *     failed checkpoint pays nothing whether it was close or not. The one place
 *     the result is read at all is the review of a LOSS, which pays MORE — the
 *     opposite direction, and the direction F-EN-2 asks for.
 *
 * Paying a puzzle regardless of whether it was solved is a decision, not an
 * oversight: F-EN-2 states "regardless of result" for the bot game and states no
 * result condition anywhere else, and the layer's stated purpose (PRD 8.9) is
 * that "XP rewards learning actions and never wins alone". An attempt is the
 * learning action; the solve is the outcome.
 */

/** The rates, as F-EN-2 writes them. */
export const XP_RATES = {
  /** Paid from the lesson's own authored `xp`, which content holds at 10 to 20. */
  lessonMin: 10,
  lessonMax: 20,
  puzzleMin: 2,
  puzzleMax: 5,
  checkpoint: 50,
  /**
   * Declared for completeness. No event carries a story game, so nothing pays
   * it — see the header. When story games land, the rate is already here.
   */
  storyGame: 20,
  botGame: 10,
  review: 15,
  reviewOfALoss: 25,
  /** F-EN-2's "drill 5 to 10", paid at the floor. See the header. */
  drill: 5,
} as const;

/**
 * The rating range the shipped puzzle packs cover (`puzzles/types.ts`:
 * `'600-900' | '900-1200' | '1200-1500'`).
 */
export const PUZZLE_RATING_FLOOR = 600;
export const PUZZLE_RATING_CEILING = 1500;

/**
 * F-EN-2's "puzzle 2 to 5 weighted by difficulty".
 *
 * The weighting interpolates across the range the packs actually ship rather
 * than across invented thresholds, so the boundaries the rest of the app already
 * uses (`puzzles/packs.ts`, `bandFor`) fall inside the steps: 600 pays 2, 900
 * pays 3, 1200 pays 4, and the top of the 1200-1500 pack pays 5. All four values
 * are reachable from ratings the packs contain, which a four-way threshold over
 * three bands would not have been — the top step would have needed a rating no
 * pack holds.
 *
 * Clamped at both ends: an imported or hand-set rating outside the range pays
 * the nearest rate rather than escaping the band F-EN-2 fixes.
 */
export function xpForPuzzle(puzzleRating: number): number {
  const span = PUZZLE_RATING_CEILING - PUZZLE_RATING_FLOOR;
  const t = Math.min(1, Math.max(0, (puzzleRating - PUZZLE_RATING_FLOOR) / span));
  const steps = XP_RATES.puzzleMax - XP_RATES.puzzleMin;
  return XP_RATES.puzzleMin + Math.round(t * steps);
}

/**
 * What the projection knows that the event itself does not.
 *
 * Every field answers a question the payload cannot: three of them are "has this
 * already been paid for?", which is the projection's business, and one is "what
 * happened in the game this review is of?", which lives in a different event.
 */
export interface XpContext {
  /** This `gameId` has already banked a review, so the award has been paid. */
  alreadyReviewed: boolean;
  /** This unit was already passed, so F-PA-7's bonus has been paid. */
  unitAlreadyPassed: boolean;
  /**
   * The result of the game a `game_reviewed` event refers to, from the
   * `game_finished` event that carries it — or null when the log holds no such
   * event.
   *
   * Null is the ordinary case for an IMPORTED game: F-IM banks the same
   * `game_reviewed` event for a game that was played elsewhere, and no
   * `game_finished` exists for it. A review whose result is unknown pays the
   * "review of any game" rate, which is the rate F-EN-2 states for a review
   * with no loss attached to it. That is a real limitation and it is the safe
   * direction: the alternative is guessing at 25.
   */
  reviewedGameResult: 'win' | 'loss' | 'draw' | null;
}

export function emptyXpContext(): XpContext {
  return { alreadyReviewed: false, unitAlreadyPassed: false, reviewedGameResult: null };
}

/**
 * The XP one event pays. Always a non-negative integer; never reads a clock.
 *
 * A `switch` over the whole union with no `default`, so a new event type is a
 * type error here rather than a silent zero — the union is the list of things a
 * learner can do, and every addition to it is a decision about whether it pays.
 */
export function xpForEvent(payload: EventPayload, ctx: XpContext = emptyXpContext()): number {
  switch (payload.type) {
    case 'lesson_completed':
      // The lesson's own authored value (content holds 10 to 20), halved on a
      // replay. Halving is not a deduction: the award itself is smaller, and the
      // total never goes down.
      return payload.replay ? Math.floor(payload.xp / 2) : payload.xp;

    case 'checkpoint_attempted':
      // F-PA-7: a retake of an already-passed checkpoint does not re-award it.
      return payload.passed && !ctx.unitAlreadyPassed ? XP_RATES.checkpoint : 0;

    case 'game_finished':
      // "regardless of result" — `payload.result` is deliberately not read.
      return XP_RATES.botGame;

    case 'game_reviewed': {
      if (ctx.alreadyReviewed) return 0;
      const review = ctx.reviewedGameResult === 'loss' ? XP_RATES.reviewOfALoss : XP_RATES.review;
      return review + (payload.drillCompleted ? XP_RATES.drill : 0);
    }

    case 'puzzle_attempted':
      return xpForPuzzle(payload.puzzleRating);

    // The rest are records of state, not of work done: starting a lesson or a
    // game pays for the finishing event, an import is not practice, and a
    // setting is not an action. Each is listed rather than folded into a
    // `default` so that adding an event type cannot inherit "pays nothing".
    //
    // `unit_tested_out` pays nothing for a reason worth writing down. It is
    // appended from two places (`checkpoint/CheckpointRoute.tsx` and
    // `onboarding/PlacementRoute.tsx`). In the first it accompanies a passed
    // `checkpoint_attempted`, which has already paid the 50 — paying here too
    // would pay twice for one checkpoint. In the second the onboarding placement
    // appends ONE PER UNIT below the placement point, so a rate here would pay a
    // learner hundreds of XP for units they were placed past and never sat.
    case 'lesson_started':
    case 'challenge_attempted':
    case 'unit_tested_out':
    case 'game_started':
    case 'games_imported':
    case 'settings_changed':
      return 0;
  }
}

/**
 * The XP earned on each local day, keyed by `YYYY-MM-DD`.
 *
 * F-EN-3's "earn 50 XP" quest is a question about a DAY, and `Progress.xp` is a
 * running total with no per-day breakdown, so the walk is repeated here.
 *
 * REPEATED, NOT REDEFINED. This function applies the same rates through the same
 * `xpForEvent` and rebuilds the same three context flags in the same order as
 * `data/reduce.ts`, and `xp.test.ts` asserts that the sum of these days equals
 * `reduceProgress(...).xp` on a log that exercises every one of them. Two places
 * computing XP is a drift risk; that assertion is what holds them together, and
 * it is the reason the equality is a test rather than a comment.
 *
 * Only the event's own `deviceDay` is used, so an award always lands on the day
 * the action happened in the device's own time zone (F-EN-1's rule, applied to
 * XP for the same reason).
 */
export function xpByDay(events: readonly LearnerEvent[]): Map<string, number> {
  const byDay = new Map<string, number>();
  const reviewed = new Set<string>();
  const lost = new Set<string>();
  const passedUnits = new Set<string>();
  const seen = new Set<string>();

  for (const e of [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const x = e.payload;
    const amount = xpForEvent(x, {
      alreadyReviewed: x.type === 'game_reviewed' && reviewed.has(x.gameId),
      unitAlreadyPassed: x.type === 'checkpoint_attempted' && passedUnits.has(x.unit),
      reviewedGameResult: x.type === 'game_reviewed' && lost.has(x.gameId) ? 'loss' : null,
    });
    if (amount > 0) byDay.set(e.deviceDay, (byDay.get(e.deviceDay) ?? 0) + amount);

    if (x.type === 'game_reviewed') reviewed.add(x.gameId);
    if (x.type === 'game_finished' && x.result === 'loss') lost.add(x.gameId);
    if (x.type === 'checkpoint_attempted' && x.passed) passedUnits.add(x.unit);
    if (x.type === 'unit_tested_out') passedUnits.add(x.unit);
  }
  return byDay;
}

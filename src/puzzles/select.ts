import { expected } from './rating';
import type { Puzzle, PuzzleRating } from './types';

/** F-PZ-1: "predicted success 70-85%". The two edges of that band. */
const P_MAX = 0.85;
const P_MIN = 0.7;

/**
 * How far BELOW the learner a puzzle must sit for the predicted success to be
 * `p`, found on `rating.ts`'s own curve by bisection rather than written down.
 *
 * Written down, the two numbers are 147 and 302 — correct only while the scale
 * constant in `rating.ts` stays 400. Derived, the window keeps meaning 70-85
 * per cent whatever the curve becomes, which is the whole point: a hardcoded
 * window does not stop being a number when it stops being true.
 *
 * `expected(r, r - d)` does not depend on `r`, so 0 is as good a base as any.
 */
function offsetFor(p: number): number {
  let lo = 0;
  let hi = 4000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (expected(0, -mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface RatingWindow {
  min: number;
  max: number;
}

/**
 * The puzzle ratings whose predicted success for this learner is 70-85%.
 *
 * Harder puzzles are rated HIGHER, and a higher rating means a lower predicted
 * success, so the 85% edge is the lower bound and the 70% edge the upper one.
 */
export function windowFor(rating: number): RatingWindow {
  return { min: rating - offsetFor(P_MAX), max: rating - offsetFor(P_MIN) };
}

export interface Pick {
  puzzle: Puzzle | null;
  /**
   * True when nothing was in window and the closest available puzzle was
   * returned instead — the learner has outgrown the pack. The screen may want
   * to say so; it must not be left to infer it from the rating.
   */
  widened: boolean;
  /** True when there was nothing left to return at all. Distinct from `widened`. */
  exhausted: boolean;
}

/**
 * The next rated puzzle (F-PZ-1, spec §3.2).
 *
 * Three outcomes, all of which the caller needs and none of which collapse
 * into the others: an in-window pick, a widened pick, and exhaustion. A bare
 * `Puzzle | null` would make the last two indistinguishable, and the screen
 * would render an empty board for one of them.
 *
 * In window, the lowest-rated unseen puzzle wins. It is deterministic — a pure
 * function with a random tiebreak is not testable and not reproducible — and
 * because `seen` grows, successive calls walk up through the window rather
 * than returning the same puzzle. Every candidate is inside the 70-85% band by
 * construction, so "lowest" is not "easiest than intended".
 *
 * `confidence` is deliberately not consumed: spec §3.2 makes predicted success
 * a function of the rating gap alone. It is in the signature because the
 * caller holds a `PuzzleRating` and splitting it here would invite the two
 * halves to drift apart.
 */
export function pickNext(
  pool: readonly Puzzle[],
  rating: PuzzleRating,
  seen: ReadonlySet<string>,
): Pick {
  const unseen = pool.filter((p) => !seen.has(p.id));
  if (unseen.length === 0) return { puzzle: null, widened: false, exhausted: true };

  const w = windowFor(rating.rating);
  const inWindow = unseen.filter((p) => p.rating >= w.min && p.rating <= w.max);
  if (inWindow.length > 0) {
    const best = inWindow.reduce((a, b) => (b.rating < a.rating ? b : a));
    return { puzzle: best, widened: false, exhausted: false };
  }

  // Nothing in window is a real case, not an error: the learner is at the top
  // (or the bottom) of the shipped band. Return the closest puzzle to the
  // window and SAY it was widened, so the screen can tell the learner why the
  // next one feels off.
  const distance = (p: Puzzle) => (p.rating < w.min ? w.min - p.rating : p.rating - w.max);
  const closest = unseen.reduce((a, b) => (distance(b) < distance(a) ? b : a));
  return { puzzle: closest, widened: true, exhausted: false };
}

import type { PuzzleRating } from './types';

/** F-PZ-1: start at 800 with high uncertainty. */
export const START: PuzzleRating = { rating: 800, confidence: 0 };

const MIN = 400;
const MAX = 3000;
/** The step at zero confidence. Large, so the first dozen attempts find the level fast. */
const MAX_STEP = 64;
/** The step at full confidence. Small, so a settled rating drifts rather than jumps. */
const MIN_STEP = 8;
/** How fast confidence accrues. 1/24 means roughly 24 attempts to be mostly settled. */
const CONFIDENCE_PER_ATTEMPT = 1 / 24;

/**
 * Expected score on the logistic curve, the same shape Elo and Glicko use.
 * 400 is the scale constant: a 400-point gap is about a 91 per cent expectation.
 */
export function expected(rating: number, puzzleRating: number): number {
  return 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
}

/**
 * One attempt's update.
 *
 * The surprise term `(actual - expected)` is what makes a hard solve worth more
 * than an easy one without a second rule: beating a 1200 from 800 has a large
 * surprise, beating a 600 has almost none.
 *
 * Pure and total. Swapping in Glicko-2 later replaces this function and nothing
 * else, because the persisted shape already carries a confidence.
 */
export function nextRating(
  current: PuzzleRating,
  puzzleRating: number,
  solved: boolean,
): PuzzleRating {
  const step = MAX_STEP - (MAX_STEP - MIN_STEP) * current.confidence;
  const surprise = (solved ? 1 : 0) - expected(current.rating, puzzleRating);
  const rating = Math.round(
    Math.min(MAX, Math.max(MIN, current.rating + step * surprise)),
  );
  const confidence = Math.min(1, current.confidence + CONFIDENCE_PER_ATTEMPT);
  return { rating, confidence };
}

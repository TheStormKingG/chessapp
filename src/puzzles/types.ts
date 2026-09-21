/**
 * The puzzle vocabulary. Every other puzzle module imports from here, so this
 * file has no imports of its own beyond the rules types and adds no behaviour.
 *
 * `RatingBand`, not `Band`: src/review/types.ts already owns `Band` for the
 * move-label bands of PRD Appendix C, which is an unrelated concept.
 */

/** A Lichess puzzle theme, restricted to the eight PRD Appendix B assigns to Sections 1 and 2. */
export type Theme =
  | 'backRankMate'
  | 'mateIn1'
  | 'smotheredMate'
  | 'mateIn2'
  | 'attackingF2F7'
  | 'skewer'
  | 'fork'
  | 'discoveredAttack';

/** The rating bands the packs are split into. Half-open: `[min, max)`. */
export type RatingBand = '600-900' | '900-1200' | '1200-1500';

/** Where an attempt came from. Load-bearing: themed practice must not move the rating. */
export type PuzzleSource = 'rated' | 'themed' | 'daily' | 'fix';

/**
 * One puzzle as shipped in a pack.
 *
 * `fen` is the position BEFORE the opponent's last move is replayed, matching
 * the Lichess dump's own convention: the first move of `solution` is the
 * opponent's, and the learner moves second. Getting this backwards silently
 * asks the learner to play the wrong side, and every position still looks
 * legal, so no verifier catches it. Task 4 asserts the side to move.
 */
export interface Puzzle {
  id: string;
  fen: string;
  /** UCI moves. `solution[0]` is the opponent's move; the learner plays `solution[1]`. */
  solution: string[];
  rating: number;
  themes: Theme[];
}

/** The learner's puzzle rating: a number and how certain we are of it (spec §1.3). */
export interface PuzzleRating {
  rating: number;
  /** 0 = no evidence, 1 = settled. Monotonically non-decreasing. */
  confidence: number;
}

/** One finished attempt, as the session reducer reports it. */
export interface AttemptResult {
  puzzleId: string;
  solved: boolean;
  hinted: boolean;
  misses: number;
  ms: number;
  source: PuzzleSource;
  /** PRD 6.4 mastery: no hint and no miss. */
  mastered: boolean;
  /** False for themed practice and for any solve after a hint (F-PZ-4). */
  ratingCounts: boolean;
}

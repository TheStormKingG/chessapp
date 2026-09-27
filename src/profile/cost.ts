import { recencyWeight } from './recency';

/**
 * F-SW-3's ranking, verbatim:
 *
 * > "the three weaknesses that cost the most, ranked by how often they occur
 * > multiplied by how much expected score they lose, with recent games weighted
 * > more heavily"
 *
 * ── THE ARITHMETIC, STATED ONCE ──────────────────────────────────────────────
 *
 * "How much expected score it loses" is already banked. `ReviewedMove.drop` is a
 * fall in win per cent, and PRD §10.6's curve is the Lichess one, in which win
 * per cent IS expected score on a 0–100 scale. So an occurrence that dropped 30
 * win per cent lost 0.30 of a game, and no new engine work is needed to know it.
 *
 * "How often it occurs multiplied by how much it loses, recency-weighted" has two
 * readings, and they are the same number:
 *
 *     Σᵢ wᵢ · lossᵢ   ≡   (Σᵢ wᵢ) · ( Σᵢ wᵢ·lossᵢ / Σᵢ wᵢ )
 *                          └ weighted count ┘ └ weighted mean loss ┘
 *
 * The left side is one pass; the right side is the sentence's product form. They
 * are algebraically identical, so there is nothing to choose between them and one
 * computation satisfies both. Both factors are returned separately anyway,
 * because F-SW-3 asks the screen to print the count beside the ranking and
 * because a single opaque score cannot be checked against the games it came from.
 *
 * The UNWEIGHTED count is also returned and is what the screen prints. "9 times
 * in 20 games" is a fact about the learner's history; a weighted count is an
 * artefact of the ranking, and printing "6.3 times" would be a number no learner
 * could verify by scrolling their own game list.
 */

/** One occurrence of a weakness, with the game it came from. */
export interface Occurrence {
  /** 0 = most recent game. See recency.ts for why this is a rank, not a date. */
  gameRank: number;
  /**
   * Expected score lost by this occurrence, 0…1.
   *
   * Clamped into range by `costOf`, not here, so a caller can hand over a raw
   * `drop / 100` without pre-conditioning it and a value outside range is
   * corrected in exactly one place.
   */
  expectedScoreLost: number;
}

export interface Cost {
  /** The F-SW-3 product. Units: expected score, i.e. games. */
  cost: number;
  /** Σ wᵢ — the first factor. */
  weightedOccurrences: number;
  /** The second factor, 0…1. Zero when there are no occurrences. */
  meanExpectedScoreLost: number;
  /** Raw count, which is what the screen prints (F-SW-3's "9 times"). */
  occurrences: number;
}

/**
 * The cost of one weakness.
 *
 * An empty list yields an all-zero Cost rather than throwing, because "this theme
 * never happened" is a real and common answer and the caller ranks over every
 * theme including the ones with nothing in them.
 */
export function costOf(occurrences: readonly Occurrence[]): Cost {
  let weighted = 0;
  let total = 0;
  for (const o of occurrences) {
    const w = recencyWeight(o.gameRank);
    // Clamped in one place. A `drop` above 100 cannot happen (it is a difference
    // of two percentages, each 0…100, floored at 0 by buildReview) but a loss
    // above one whole game would make the ranking meaningless if it ever did.
    const loss = Math.min(1, Math.max(0, o.expectedScoreLost));
    weighted += w;
    total += w * loss;
  }
  return {
    cost: total,
    weightedOccurrences: weighted,
    meanExpectedScoreLost: weighted === 0 ? 0 : total / weighted,
    occurrences: occurrences.length,
  };
}

/**
 * Expected score lost by a move, from the win-per-cent drop the review banked.
 *
 * A named function rather than an inline `/ 100` so that the one place the units
 * change is the one place a reader looks for it, and so the two callers cannot
 * disagree about the scale.
 */
export function expectedScoreLostFromDrop(dropWinPercent: number): number {
  return Math.min(1, Math.max(0, dropWinPercent / 100));
}

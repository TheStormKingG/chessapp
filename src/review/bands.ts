import type { Band } from './types';

/**
 * PRD Appendix C, "Move label thresholds", reproduced as code.
 *
 * Each number is the EXCLUSIVE upper bound of its label in win per cent
 * dropped. Appendix C's wording is "Excellent: under 3; Good: 3 to 8", so a
 * drop of exactly 3 is Good, which is why every comparison in labels.ts is `<`.
 *
 * Sections 1 and 2 share one column in the PRD table. They are kept as two
 * band values rather than collapsed, because the PRD's section structure has
 * four sections and a future tuning pass (Appendix C: "Thresholds are to be
 * tuned in beta") may well separate them.
 */
export interface Thresholds {
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
}

const TABLE: Record<Band, Thresholds> = {
  1: { excellent: 3, good: 8, inaccuracy: 15, mistake: 25 },
  2: { excellent: 3, good: 8, inaccuracy: 15, mistake: 25 },
  3: { excellent: 2.5, good: 6, inaccuracy: 12, mistake: 22 },
  4: { excellent: 2, good: 5, inaccuracy: 10, mistake: 20 },
};

export function thresholdsFor(band: Band): Thresholds {
  return { ...TABLE[band] };
}

/**
 * A drop this small is Best. The engine's own evaluation is not stable to
 * better than a fraction of a win per cent between two searches of adjacent
 * positions, so an exact zero test would label a genuinely best move Excellent
 * on float noise alone.
 */
export const BEST_EPSILON = 0.05;

/**
 * The learner's band from the furthest unit they have reached. Unit ids are
 * `<section>.<unit>` (src/path/curriculum.ts).
 *
 * Only Section 1 exists in the curriculum today, so every live learner is in
 * band 1 and bands 2 to 4 are unreachable in the shipped app. They are
 * implemented and tested because Appendix C specifies them and because the
 * alternative — adding them later — is the version where nobody notices that a
 * Section 3 learner is being judged by Section 1 thresholds.
 *
 * An unparseable id falls back to band 1: the failure mode of guessing too
 * generous is a learner told they played well, and of guessing too strict is a
 * beginner told they blundered. Only one of those is worth risking.
 */
export function bandForUnit(unitId: string): Band {
  const section = Number(unitId.split('.')[0]);
  if (!Number.isFinite(section) || section < 1) return 1;
  if (section >= 4) return 4;
  return section as Band;
}

/**
 * PRD Appendix C, Brilliant: "from a position that was not already clearly
 * winning". The PRD gives no number. Inverting the shipped curve, win per cent
 * 80 is +376 centipawns — close to a whole extra rook. Design spec section 9.3.
 * Beta tuning is a change to this line.
 */
export const BRILLIANT_MAX_WIN_BEFORE = 80;

import type { Band, MoveLabel } from './types';
import { thresholdsFor, BEST_EPSILON } from './bands';

/**
 * PRD F-RV-2, 10.6 and Appendix C.
 *
 * Every formula this depends on lives in src/engine/winPercent.ts and is not
 * restated here. This module decides a label from a drop, nothing more.
 *
 * `Great` and `Brilliant` are NOT decided here: both need a second-best line,
 * i.e. MultiPV >= 2, which the whole-game pass cannot afford (design spec
 * section 1.4). They are applied to key moments only, by upgradeKeyMoment().
 */

export interface LabelInput {
  band: Band;
  /** Win per cent lost, for the mover. Never negative. */
  drop: number;
  /** The move played is the engine's first line. */
  playedIsBest: boolean;
  /** The position after the move is in the bundled book, within its ply cap. */
  book: boolean;
  /** The opponent's previous move was a Mistake, Miss or Blunder (F-RV-2, "Miss"). */
  opponentPreviousWasBadMove: boolean;
  /** Win per cent for the mover before the move. */
  winBefore: number;
  /** Win per cent for the mover after the move played. */
  winAfterPlayed: number;
  /** The move played hands the opponent a forced mate that was not there before. */
  mateAllowed: boolean;
  /** The mover had a forced mate before the move. */
  moverWasMating: boolean;
  /** The mover still has a forced mate after the move. */
  stillMating: boolean;
}

/**
 * PRD 10.6: "allowing a forced mate is a blunder unless the position was
 * already lost by a wide margin". "A wide margin" gets a number here, once.
 */
const HOPELESS_WIN_PERCENT = 20;

function numericLabel(drop: number, band: Band, playedIsBest: boolean): MoveLabel {
  if (playedIsBest || drop < BEST_EPSILON) return 'Best';
  const t = thresholdsFor(band);
  if (drop < t.excellent) return 'Excellent';
  if (drop < t.good) return 'Good';
  if (drop < t.inaccuracy) return 'Inaccuracy';
  if (drop < t.mistake) return 'Mistake';
  return 'Blunder';
}

export function isBadMove(label: MoveLabel): boolean {
  return label === 'Mistake' || label === 'Blunder' || label === 'Miss';
}

export function labelMove(input: LabelInput): MoveLabel {
  // 1. Book wins over everything. A book move's "drop" is the engine
  //    disagreeing with theory, which is not the learner's error.
  if (input.book) return 'Book';

  // 2. Mate already in hand, mate still in hand: no penalty for taking longer.
  //    PRD 10.6, "delaying a mate carries no label".
  if (input.moverWasMating && input.stillMating) return 'Best';

  // 3. Handing over a forced mate is a Blunder unless it was already lost wide.
  if (input.mateAllowed && input.winBefore >= HOPELESS_WIN_PERCENT) return 'Blunder';

  const label = numericLabel(input.drop, input.band, input.playedIsBest);

  // 4. Miss: "a mistake or worse played when the opponent's previous move was a
  //    mistake or worse". It replaces Mistake and Blunder and nothing else.
  if (input.opponentPreviousWasBadMove && (label === 'Mistake' || label === 'Blunder')) {
    return 'Miss';
  }
  return label;
}

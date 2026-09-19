import type { Band, MoveLabel } from './types';
import { thresholdsFor, BEST_EPSILON, BRILLIANT_MAX_WIN_BEFORE } from './bands';

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

/**
 * PRD F-RV-2 and Appendix C, Great and Brilliant.
 *
 * These are applied ONLY to key moments, because both need a second-best line
 * and therefore MultiPV >= 2, which costs 2.6x a MultiPV-1 pass in the browser
 * (design spec section 1.2) and does not fit F-RV-1's 60-second budget over a
 * whole game. Design spec section 1.5, consequence C2.
 */
export interface UpgradeInput {
  band: Band;
  /** The label the whole-game pass assigned. */
  label: MoveLabel;
  /** Win per cent for the mover before the move. */
  winBefore: number;
  /** Win per cent for the mover if the SECOND-best move had been played. Null when forced. */
  secondWin: number | null;
  /** Points of material given up by the move, by PIECE_VALUE. */
  materialSacrificed: number;
  /** Points regained within the engine's principal variation. */
  materialRegained: number;
}

export function upgradeKeyMoment(input: UpgradeInput): MoveLabel {
  if (input.label === 'Book') return input.label;
  if (input.label !== 'Best' && input.label !== 'Excellent') return input.label;
  if (input.secondWin === null) return input.label;

  const secondDrop = input.winBefore - input.secondWin;
  // Appendix C: Great is "the only move that keeps the evaluation from dropping
  // by a mistake or more", so the test is the band's MISTAKE FLOOR. In
  // Thresholds each field is the exclusive upper bound of the label it names,
  // so the first drop that is a Mistake is `t.inaccuracy` (15 in band 1) and
  // `t.mistake` (25) is where Blunder starts. Do not "correct" this to
  // `.mistake`: that is the Blunder floor and it contradicts Appendix C.
  // `Great turns on the band's Mistake floor exactly` in labels.test.ts pins it.
  const onlyMove = input.label === 'Best' && secondDrop >= thresholdsFor(input.band).inaccuracy;

  // Appendix C: "a sound sacrifice (material given up and not immediately
  // regained) that is best or excellent, from a position that was not already
  // clearly winning". The first two clauses are the guards above; the third has
  // no number in the PRD and is BRILLIANT_MAX_WIN_BEFORE (design spec 9.3).
  const sacrifice = input.materialSacrificed - input.materialRegained;
  const brilliant = sacrifice > 0 && input.winBefore < BRILLIANT_MAX_WIN_BEFORE;

  if (brilliant) return 'Brilliant';
  if (onlyMove) return 'Great';
  return input.label;
}

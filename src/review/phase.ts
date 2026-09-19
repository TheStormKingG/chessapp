import { PIECE_VALUE, piecesOf } from '@/rules';
import type { Phase } from './types';

/**
 * The PRD names three phases (F-RV-3 "the phase in which the game turned",
 * F-RV-6 "phase") and defines none of them. These are the definitions, in one
 * place, so that the summary and the error log cannot drift apart.
 */

/** Twenty plies is the PRD's "first ten moves" (Appendix C, Book). */
export const OPENING_PLIES = 20;

/**
 * Both sides' non-king material in PIECE_VALUE points. The start position is 78.
 * Below this, it is an endgame: 26 is roughly "a rook and a couple of pawns each",
 * which is where king activity starts to be the main idea.
 */
export const ENDGAME_MATERIAL = 26;

export function nonKingMaterial(fen: string): number {
  let n = 0;
  for (const c of ['w', 'b'] as const) {
    for (const { piece } of piecesOf(fen, c)) {
      if (piece.type !== 'k') n += PIECE_VALUE[piece.type];
    }
  }
  return n;
}

export function phaseOf(at: { ply: number; fen: string; inBook: boolean }): Phase {
  if (at.inBook || at.ply < OPENING_PLIES) return 'opening';
  if (nonKingMaterial(at.fen) <= ENDGAME_MATERIAL) return 'endgame';
  return 'middlegame';
}

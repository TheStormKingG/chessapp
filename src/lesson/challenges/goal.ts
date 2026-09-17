import { gameStatus, piecesOf, type Color, type PieceType } from '@/rules';
import type { Challenge } from '../types';

export type PlayItOut = Extract<Challenge, { type: 'play_it_out' }>;

const PROMOTABLE: PieceType[] = ['q', 'r', 'b', 'n'];

function count(fen: string, color: Color, type: PieceType): number {
  return piecesOf(fen, color).filter((p) => p.piece.type === type).length;
}

/**
 * True when `color` has more of some promotable piece than it did in `from`.
 * Counting beats "a queen stands on the back rank": it survives the new queen
 * moving away, and it catches under-promotions.
 */
export function hasPromoted(from: string, fen: string, color: Color): boolean {
  return PROMOTABLE.some((t) => count(fen, color, t) > count(from, color, t));
}

/**
 * Has the drill's goal been met? `true` met, `false` failed, `null` still running.
 * Pure, so the outcome rule is testable without a board or an engine.
 */
export function goalMet(
  c: PlayItOut,
  fen: string,
  learner: Color,
  learnerMoves: number,
): boolean | null {
  const st = gameStatus(fen);
  const enemy: Color = learner === 'w' ? 'b' : 'w';
  switch (c.goal.kind) {
    case 'mate_in':
      if (st.over && st.result === 'checkmate' && st.winner === learner) return true;
      if (st.over || learnerMoves >= c.goal.moves) return false;
      return null;
    case 'promote':
      if (hasPromoted(c.fen, fen, learner)) return true;
      if (st.over || learnerMoves >= c.goal.moves) return false;
      return null;
    case 'capture_all':
      if (piecesOf(fen, enemy).every((p) => p.piece.type === 'k')) return true;
      if (st.over || learnerMoves >= c.goal.moves) return false;
      return null;
    case 'hold':
      // Holding means surviving the required number of moves. Letting a pawn
      // through loses the drill even though nobody has been mated yet: the
      // knight-versus-pawns endgame is exactly this, and a run that continued
      // past a new enemy queen would call a loss a pass.
      if (hasPromoted(c.fen, fen, enemy)) return false;
      if (st.over && st.result === 'checkmate' && st.winner !== learner) return false;
      if (st.over) return true; // any draw is a hold
      if (learnerMoves >= c.goal.moves) return true;
      return null;
  }
}

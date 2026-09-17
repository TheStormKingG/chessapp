import { applyMove, legalMoves, type Square } from '@/rules';
import type { BoardMode, BoardMove } from './types';

/**
 * Pure drop resolver used by Board's onPieceDrop. Returns the resulting
 * move, or null when the drop must be rejected (off-board target, illegal
 * move, disabled board, or a non-play mode). Promotion is always to a
 * queen in Phase 0.
 */
export function handleDrop(
  fen: string,
  mode: BoardMode,
  disabled: boolean | undefined,
  sourceSquare: Square,
  targetSquare: Square | null,
): BoardMove | null {
  if (disabled || mode !== 'play' || !targetSquare) return null;
  const lm = legalMoves(fen, sourceSquare).find((m) => m.to === targetSquare);
  if (!lm) return null;
  const uci = lm.promotion ? `${sourceSquare}${targetSquare}q` : lm.uci;
  const r = applyMove(fen, uci);
  return { from: sourceSquare, to: targetSquare, uci: r.uci, san: r.san };
}

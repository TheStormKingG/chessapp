import { pieceAt, type Square } from '@/rules';

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

/** Spoken description of a square for the aria-live status and the board label. */
export function describeSquare(fen: string, sq: Square): string {
  const p = pieceAt(fen, sq);
  return p ? `${sq}, ${p.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[p.type]}` : `${sq}, empty`;
}

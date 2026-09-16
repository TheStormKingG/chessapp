export type Square = `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece {
  type: PieceType;
  color: Color;
}
export interface MoveResult {
  fen: string;
  san: string;
  uci: string;
  capture: boolean;
  captured?: PieceType;
  promotion?: PieceType;
  check: boolean;
}
export interface LegalMove {
  from: Square;
  to: Square;
  san: string;
  uci: string;
  promotion?: PieceType;
  capture: boolean;
}
export type GameStatus =
  | { over: false }
  | { over: true; result: 'checkmate'; winner: Color }
  | { over: true; result: 'stalemate' | 'insufficient' | 'repetition' | 'fifty'; winner: null };

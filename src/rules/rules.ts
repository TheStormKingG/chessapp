import { Chess, type Move, type Square as CjSquare } from 'chess.js';
import type { Color, GameStatus, LegalMove, MoveResult, Piece, PieceType, Square } from './types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function load(fen: string): Chess {
  return new Chess(fen);
}

function isCapture(m: Move): boolean {
  return m.flags.includes('c') || m.flags.includes('e');
}

function uciOf(m: Move): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function turn(fen: string): Color {
  return load(fen).turn();
}

export function legalMoves(fen: string, from?: Square): LegalMove[] {
  const c = load(fen);
  const moves = from ? c.moves({ verbose: true, square: from as CjSquare }) : c.moves({ verbose: true });
  return moves.map((m) => ({
    from: m.from as Square,
    to: m.to as Square,
    san: m.san,
    uci: uciOf(m),
    ...(m.promotion ? { promotion: m.promotion as PieceType } : {}),
    capture: isCapture(m),
  }));
}

const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function applyMove(fen: string, move: string): MoveResult {
  const c = load(fen);
  let m: Move;
  try {
    const parsed = UCI.exec(move);
    m = parsed
      ? c.move({ from: parsed[1] ?? '', to: parsed[2] ?? '', ...(parsed[3] ? { promotion: parsed[3] } : {}) })
      : c.move(move);
  } catch {
    throw new Error(`Illegal move ${move} in ${fen}`);
  }
  return {
    fen: c.fen(),
    san: m.san,
    uci: uciOf(m),
    capture: isCapture(m),
    ...(m.captured ? { captured: m.captured as PieceType } : {}),
    ...(m.promotion ? { promotion: m.promotion as PieceType } : {}),
    check: c.inCheck(),
  };
}

export function toSan(fen: string, uci: string): string {
  return applyMove(fen, uci).san;
}
export function toUci(fen: string, san: string): string {
  return applyMove(fen, san).uci;
}
export function isCheck(fen: string): boolean {
  return load(fen).inCheck();
}
export function isCheckmate(fen: string): boolean {
  return load(fen).isCheckmate();
}
export function isStalemate(fen: string): boolean {
  return load(fen).isStalemate();
}

export function gameStatus(fen: string): GameStatus {
  const c = load(fen);
  if (c.isCheckmate()) return { over: true, result: 'checkmate', winner: c.turn() === 'w' ? 'b' : 'w' };
  if (c.isStalemate()) return { over: true, result: 'stalemate', winner: null };
  if (c.isInsufficientMaterial()) return { over: true, result: 'insufficient', winner: null };
  if (c.isThreefoldRepetition()) return { over: true, result: 'repetition', winner: null };
  if (c.isDrawByFiftyMoves()) return { over: true, result: 'fifty', winner: null };
  return { over: false };
}

const FILES = 'abcdefgh';

/**
 * Read the placement field of a FEN without chess.js.
 *
 * chess.js validates legality on load and rejects any position without both
 * kings, but the board-vision teaching boards of unit 1.1 are legitimately
 * kingless (the content verifier allows kingless FENs for which_square,
 * name_square and colour_square). Those lessons only ever ask what sits on a
 * square, never what may move, so the read-only accessors parse the placement
 * field themselves. The move functions -- legalMoves, applyMove, gameStatus
 * and the rest -- keep going through chess.js and still reject a kingless
 * position rather than pretend it is playable.
 */
function readPlacement(fen: string): Map<Square, Piece> {
  const board = new Map<Square, Piece>();
  const ranks = fen.trim().split(/\s+/)[0]?.split('/') ?? [];
  if (ranks.length !== 8) throw new Error(`Invalid FEN placement: ${fen}`);
  ranks.forEach((rankStr, i) => {
    const rank = 8 - i;
    let file = 0;
    for (const ch of rankStr) {
      if (ch >= '1' && ch <= '8') { file += Number(ch); continue; }
      if (!/[pnbrqk]/i.test(ch)) throw new Error(`Invalid FEN placement: ${fen}`);
      if (file > 7) throw new Error(`Invalid FEN placement: ${fen}`);
      board.set(`${FILES[file]}${rank}` as Square, {
        type: ch.toLowerCase() as PieceType,
        color: ch === ch.toUpperCase() ? 'w' : 'b',
      });
      file += 1;
    }
    if (file !== 8) throw new Error(`Invalid FEN placement: ${fen}`);
  });
  return board;
}

export function pieceAt(fen: string, sq: Square): Piece | null {
  return readPlacement(fen).get(sq) ?? null;
}

export function attackersOf(fen: string, sq: Square, by: Color): Square[] {
  return load(fen).attackers(sq as CjSquare, by) as Square[];
}

export function piecesOf(fen: string, color: Color): { square: Square; piece: Piece }[] {
  const out: { square: Square; piece: Piece }[] = [];
  for (const [square, piece] of readPlacement(fen)) {
    if (piece.color === color) out.push({ square, piece });
  }
  return out;
}

/** Same position but the other side to move; used by tagger-lite to ask "what could the opponent take". */
export function withTurn(fen: string, color: Color): string {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-';
  return parts.join(' ');
}

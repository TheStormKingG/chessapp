import {
  applyMove,
  attackersOf,
  isCheck,
  isCheckmate,
  legalMoves,
  pieceAt,
  piecesOf,
  withTurn,
  turn,
  PIECE_VALUE,
  type Color,
  type PieceType,
  type Square,
} from '@/rules';

export interface HangingPiece {
  square: Square;
  piece: PieceType;
  value: number;
}

export interface CaptureFact {
  san: string;
  uci: string;
  gain: number;
  target: Square;
}

export interface Threats {
  captures: CaptureFact[];
  mate: string | null;
}

export interface Facts {
  inCheck: boolean;
  mateInOne: string | null;
  captures: CaptureFact[];
  myHanging: HangingPiece[];
  theirHanging: HangingPiece[];
  threats: Threats;
}

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function lowestAttackerValue(fen: string, sq: Square, by: Color): number | null {
  const values = attackersOf(fen, sq, by)
    .map((a) => pieceAt(fen, a))
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => PIECE_VALUE[p.type]);
  return values.length === 0 ? null : Math.min(...values);
}

/** Pieces of `color` that are attacked and either undefended or attacked by something cheaper. Kings excluded. */
export function hangingPieces(fen: string, color: Color): HangingPiece[] {
  const enemy = other(color);
  const out: HangingPiece[] = [];
  for (const { square, piece } of piecesOf(fen, color)) {
    if (piece.type === 'k') continue;
    const atk = lowestAttackerValue(fen, square, enemy);
    if (atk === null) continue;
    const defended = attackersOf(fen, square, color).length > 0;
    const value = PIECE_VALUE[piece.type];
    if (!defended || atk < value) out.push({ square, piece: piece.type, value });
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Captures for the side to move that win material by a one-ply exchange estimate. */
export function winningCaptures(fen: string): CaptureFact[] {
  const me = turn(fen);
  const out: CaptureFact[] = [];
  for (const m of legalMoves(fen).filter((x) => x.capture)) {
    const victim = pieceAt(fen, m.to);
    const victimValue = victim ? PIECE_VALUE[victim.type] : PIECE_VALUE.p; // en passant: target square is empty
    const mover = pieceAt(fen, m.from);
    if (!mover) continue;
    const after = applyMove(fen, m.uci).fen;
    const recaptured = attackersOf(after, m.to, other(me)).length > 0;
    const gain = recaptured ? victimValue - PIECE_VALUE[mover.type] : victimValue;
    if (gain > 0) out.push({ san: m.san, uci: m.uci, gain, target: m.to });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** SAN of a move that checkmates immediately, or null. */
export function mateInOne(fen: string): string | null {
  for (const m of legalMoves(fen)) {
    if (isCheckmate(applyMove(fen, m.uci).fen)) return m.san;
  }
  return null;
}

/** True when a SAN string is a castling move (with or without check/mate suffix). */
export function justCastled(san: string): boolean {
  return san.startsWith('O-O');
}

/** Would the opponent, if it were their move, have a winning capture or mate? */
export function threatsAgainst(fen: string): Threats {
  // If the side to move is in check, handing the move to the opponent produces an
  // illegal position (their first "move" could capture the king, and chess.js then
  // throws on the kingless FEN), so report no threats rather than nonsense.
  if (isCheck(fen)) return { captures: [], mate: null };
  const flipped = withTurn(fen, other(turn(fen)));
  return { captures: winningCaptures(flipped), mate: mateInOne(flipped) };
}

/** Verified facts about a position for the side to move; the coach and bot read these, never guess them. */
export function facts(fen: string): Facts {
  const me = turn(fen);
  return {
    inCheck: isCheck(fen),
    mateInOne: mateInOne(fen),
    captures: winningCaptures(fen),
    myHanging: hangingPieces(fen, me),
    theirHanging: hangingPieces(fen, other(me)),
    threats: threatsAgainst(fen),
  };
}

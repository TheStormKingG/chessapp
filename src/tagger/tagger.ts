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

/**
 * Pieces of `color` that are attacked and either undefended or attacked by something cheaper.
 * Kings excluded.
 *
 * Two attack models, chosen by whose turn it is, because the two callers can afford
 * different errors (PRD F-CO-4: the coach may never state something the engine has not
 * verified):
 *
 * - `color` is NOT the side to move (the coach's `theirHanging`): a piece counts as
 *   attacked only when some move in `legalMoves(fen)` actually lands on its square.
 *   `attackersOf` delegates to chess.js `attackers()`, which ignores pins, so a pinned
 *   attacker would otherwise produce a "free piece" claim no legal move can cash — the
 *   one error direction that makes the coach lie.
 * - `color` IS the side to move (`myHanging`): it is the opponent's pieces that would
 *   have to move, and no legal-move list exists for them here, so the attacker-based
 *   answer stands. Its error direction is over-warning the learner about a piece that
 *   is in fact safe, which is harmless.
 */
export function hangingPieces(fen: string, color: Color): HangingPiece[] {
  const enemy = other(color);
  // Only meaningful when `enemy` is the side to move; unused otherwise.
  const landingSquares = enemy === turn(fen) ? new Set<string>(legalMoves(fen).map((m) => m.to)) : null;
  const out: HangingPiece[] = [];
  for (const { square, piece } of piecesOf(fen, color)) {
    if (piece.type === 'k') continue;
    if (landingSquares !== null && !landingSquares.has(square)) continue;
    const atk = lowestAttackerValue(fen, square, enemy);
    if (atk === null) continue;
    const defended = attackersOf(fen, square, color).length > 0;
    const value = PIECE_VALUE[piece.type];
    if (!defended || atk < value) out.push({ square, piece: piece.type, value });
  }
  return out.sort((a, b) => b.value - a.value);
}

/**
 * Captures for the side to move that win material by a one-ply exchange estimate.
 *
 * The estimate is deliberately pessimistic: if ANY enemy piece attacks the target square
 * after the capture, the full value of the moving piece (the promoted piece, when the
 * capture promotes) is charged, even when the recapture would itself lose material or be
 * illegal. It therefore under-reports winning captures rather than over-reporting them,
 * so a coach template built on this list can never over-claim (PRD F-CO-4).
 *
 * `gain` includes the promotion delta (promoted piece minus pawn), and promotion
 * captures are sorted so the queen promotion always precedes the underpromotions of the
 * same move — chess.js emits all four, and a caller reading `captures[0]` must not be
 * handed a knight underpromotion.
 */
export function winningCaptures(fen: string): CaptureFact[] {
  const me = turn(fen);
  const out: (CaptureFact & { promotionValue: number })[] = [];
  for (const m of legalMoves(fen).filter((x) => x.capture)) {
    const victim = pieceAt(fen, m.to);
    const victimValue = victim ? PIECE_VALUE[victim.type] : PIECE_VALUE.p; // en passant: target square is empty
    const mover = pieceAt(fen, m.from);
    if (!mover) continue;
    const promotionValue = m.promotion ? PIECE_VALUE[m.promotion] : 0;
    const promotionDelta = m.promotion ? promotionValue - PIECE_VALUE.p : 0;
    // A recapture takes the piece that ends up on the square: the promoted piece, not the pawn.
    const moverValue = m.promotion ? promotionValue : PIECE_VALUE[mover.type];
    const after = applyMove(fen, m.uci).fen;
    const recaptured = attackersOf(after, m.to, other(me)).length > 0;
    const gain = victimValue + promotionDelta - (recaptured ? moverValue : 0);
    if (gain > 0) out.push({ san: m.san, uci: m.uci, gain, target: m.to, promotionValue });
  }
  return out
    .sort((a, b) => b.gain - a.gain || b.promotionValue - a.promotionValue || a.san.localeCompare(b.san))
    .map(({ promotionValue: _promotionValue, ...fact }) => fact);
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

/**
 * Would the opponent, if it were their move, have a winning capture or mate?
 *
 * NOTE: when the side to move is in check this returns no threats, and that empty result
 * is an "unknown", not a verified "nothing to worry about" — a caller must not render it
 * as reassurance (PRD F-CO-4).
 */
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

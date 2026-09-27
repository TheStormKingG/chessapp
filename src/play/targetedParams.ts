import { legalMoves } from '@/rules';

/**
 * F-TS-5's URL parameters, validated.
 *
 * A FEN is accepted only when it is a position the rules module can play from and
 * somebody has a legal move in it: `legalMoves` throwing or returning nothing means
 * a board the learner could never move on. A line is accepted only as UCI-shaped
 * tokens — `BotService.bookMove` matches them against the legal moves at the time,
 * so an unreachable move is simply never played, but a token that is not a move at
 * all would sit in the book for ever.
 */
export function targetedFrom(fen: string | null, line: string | null): { fen?: string; line?: string[] } {
  const out: { fen?: string; line?: string[] } = {};
  if (fen !== null && fen !== '') {
    try {
      if (legalMoves(fen).length > 0) out.fen = fen;
    } catch {
      /* not a position: fall back to a normal game rather than a dead board */
    }
  }
  if (line !== null && line !== '') {
    const moves = line.split(' ').filter((m) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
    if (moves.length > 0) out.line = moves;
  }
  return out;
}

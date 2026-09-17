import type { EngineClient } from '@/engine';
import { applyMove, legalMoves, pieceAt, piecesOf, turn, PIECE_VALUE, type Square } from '@/rules';
import { hangingPieces, mateInOne } from '@/tagger';
import { pickMove } from './errorModel';
import type { Complexity, MoveKind, Persona } from './types';

const ENGINE_DEPTH = 8;
const ENGINE_MULTI_PV = 6;
/** Last fullmove number the opening preference may still fire on. */
const OPENING_LAST_FULLMOVE = 8;

function fullmoveOf(fen: string): number {
  const n = Number(fen.split(' ')[5]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export class BotService {
  constructor(
    readonly persona: Persona,
    private readonly engine: Pick<EngineClient, 'analyse'>,
    private readonly rng: () => number = Math.random,
  ) {}

  /**
   * The persona's opening preference (PRD F-PL-1), as the first listed move that is legal now.
   * Indexing the list by move number would break the moment the learner transposes, so the book
   * is matched by legality instead and is only consulted while the game is still in the opening.
   */
  private bookMove(fen: string): string | null {
    if (fullmoveOf(fen) > OPENING_LAST_FULLMOVE) return null;
    const book = turn(fen) === 'w' ? this.persona.opening.white : this.persona.opening.black;
    if (fullmoveOf(fen) > book.length) return null;
    const legal = new Set(legalMoves(fen).map((m) => m.uci));
    return book.find((mv) => legal.has(mv)) ?? null;
  }

  private complexity(fen: string): Complexity {
    const legal = legalMoves(fen);
    const captures = legal.filter((m) => m.capture).length;
    const checks = legal.filter((m) => applyMove(fen, m.uci).check).length;
    const pieces = piecesOf(fen, 'w').length + piecesOf(fen, 'b').length;
    const fullmove = fullmoveOf(fen);
    return { captures, checks, phase: fullmove <= OPENING_LAST_FULLMOVE ? 'opening' : pieces <= 10 ? 'endgame' : 'middlegame' };
  }

  /** How a move reads at the board, for the persona's style weights. */
  private kindOf(fen: string, uci: string): MoveKind {
    const res = applyMove(fen, uci);
    if (res.capture) {
      const mover = pieceAt(fen, res.uci.slice(0, 2) as Square);
      const taken = res.captured;
      if (mover && taken && PIECE_VALUE[taken] === PIECE_VALUE[mover.type]) return 'trade';
      return 'capture';
    }
    if (res.check) return 'check';
    return 'quiet';
  }

  async chooseMove(fen: string): Promise<string> {
    const book = this.bookMove(fen);
    if (book) return book;
    const analysis = await this.engine.analyse({ fen, depth: ENGINE_DEPTH, multiPv: ENGINE_MULTI_PV });
    const me = turn(fen);
    const tag = (uci: string): string | null => {
      const after = applyMove(fen, uci).fen;
      if (mateInOne(after)) return 'missMate';
      if (hangingPieces(after, me).length > 0) return 'hang';
      return null;
    };
    return pickMove(this.persona, analysis.lines, this.complexity(fen), this.rng, tag, (uci) => this.kindOf(fen, uci));
  }
}

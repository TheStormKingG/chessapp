import { applyMove, type Square } from '@/rules';
import type { Challenge } from './types';

export type Attempt =
  | { kind: 'move'; uci: string }
  | { kind: 'squares'; squares: Square[] }
  | { kind: 'square'; square: Square }
  | { kind: 'option'; option: number }
  | { kind: 'safe'; safe: boolean; reason: number }
  | { kind: 'goal'; met: boolean };

export type Verdict =
  | { correct: true }
  | { correct: false; authored?: string; missing?: Square[]; extra?: Square[] };

/** SAN of `move` (SAN or UCI) in `fen`, or null when it is not legal there. */
function sanOf(fen: string, move: string): string | null {
  try {
    return applyMove(fen, move).san;
  } catch {
    return null;
  }
}

function authoredFor(
  wrong: Record<string, string> | undefined,
  san: string | null,
): string | undefined {
  if (!wrong || san === null) return undefined;
  return wrong[san];
}

function wrongMiss(authored: string | undefined): Verdict {
  return authored === undefined ? { correct: false } : { correct: false, authored };
}

export function checkAnswer(c: Challenge, a: Attempt): Verdict {
  switch (c.type) {
    case 'find_the_move':
    case 'guess_the_move': {
      if (a.kind !== 'move') return { correct: false };
      const san = sanOf(c.fen, a.uci);
      const solutions = c.answer.moves.map((m) => sanOf(c.fen, m));
      if (san !== null && solutions.includes(san)) return { correct: true };
      return wrongMiss(authoredFor(c.type === 'find_the_move' ? c.wrong : undefined, san));
    }
    case 'find_the_sequence': {
      // The player checks one ply at a time against answer.line via sequenceReply;
      // a full attempt here is the first move of the line.
      if (a.kind !== 'move') return { correct: false };
      const first = c.answer.line[0];
      const san = sanOf(c.fen, a.uci);
      if (san !== null && first !== undefined && sanOf(c.fen, first) === san) return { correct: true };
      return wrongMiss(authoredFor(c.wrong, san));
    }
    case 'find_them_all': {
      if (a.kind !== 'squares') return { correct: false };
      const want = new Set<Square>(c.answer.squares);
      const got = new Set<Square>(a.squares);
      const missing = [...want].filter((s) => !got.has(s));
      const extra = [...got].filter((s) => !want.has(s));
      return missing.length === 0 && extra.length === 0
        ? { correct: true }
        : { correct: false, missing, extra };
    }
    case 'which_square':
      return a.kind === 'square' && a.square === c.answer.square ? { correct: true } : { correct: false };
    case 'name_the_pattern':
      return a.kind === 'option' && a.option === c.answer.option ? { correct: true } : { correct: false };
    case 'is_it_safe':
      return a.kind === 'safe' && a.safe === c.answer.safe && a.reason === c.answer.reason
        ? { correct: true }
        : { correct: false };
    case 'play_it_out':
      return a.kind === 'goal' && a.met ? { correct: true } : { correct: false };
  }
}

/**
 * For find_the_sequence: the authored reply after the learner's i-th correct move,
 * or null when the line is complete.
 */
export function sequenceReply(
  c: Extract<Challenge, { type: 'find_the_sequence' }>,
  learnerMoveIndex: number,
): string | null {
  const replyIdx = learnerMoveIndex * 2 + 1;
  return c.answer.line[replyIdx] ?? null;
}

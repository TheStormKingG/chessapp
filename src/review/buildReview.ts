import { moveAccuracy } from '@/engine';
import { toSan, turn } from '@/rules';
import type { Color } from '@/rules';
import type { AnalysedPosition, Band, MoveLabel, Phase, Review, ReviewedMove, ReviewSource } from './types';
import { isBadMove, labelMove } from './labels';
import { positionsOf } from './gameSource';
import { phaseOf } from './phase';
import { errorsFrom } from './errorLog';
import { selectKeyMoments } from './keyMoments';

/**
 * Turns a first pass into a Review (PRD F-RV-3).
 *
 * The one piece of arithmetic worth stating plainly: the engine reports a score
 * from the side-to-move's view, and the Lichess curve is symmetric about 50, so
 * the mover's standing AFTER their move is `100 - win(nextPosition)`. That is
 * why one search per position is enough — design spec section 1.5, C1.
 */

export interface JudgeInput {
  positions: AnalysedPosition[];
  sans: string[];
  band: Band;
  /** `bookPlies[i]` — was the position after ply i still in the book. */
  bookPlies: boolean[];
}

export function judgeMoves(input: JudgeInput): ReviewedMove[] {
  const { fens, ucis } = positionsOf(input.sans);
  const out: ReviewedMove[] = [];
  let previousWasBad = false;

  // A move needs the position before it AND the position after it. A partial
  // pass has one fewer judgeable move than it has analysed positions.
  const judgeable = Math.max(0, Math.min(input.positions.length - 1, input.sans.length));

  for (let ply = 0; ply < judgeable; ply += 1) {
    const before = input.positions[ply];
    const after = input.positions[ply + 1];
    const fenBefore = fens[ply];
    const fenAfter = fens[ply + 1];
    const uci = ucis[ply];
    const san = input.sans[ply];
    // `judgeable` already bounds every one of these, so this guard is a type
    // narrowing rather than a behaviour: under noUncheckedIndexedAccess an
    // index read is `T | undefined` whatever the loop bound proves.
    if (!before || !after || fenBefore === undefined || fenAfter === undefined || uci === undefined || san === undefined) {
      break;
    }
    const mover = turn(fenBefore);
    const winBefore = before.win;
    const winAfterPlayed = 100 - after.win;
    const drop = Math.max(0, winBefore - winAfterPlayed);
    const book = input.bookPlies[ply] === true;

    const label: MoveLabel = labelMove({
      band: input.band,
      drop,
      playedIsBest: uci === before.bestUci,
      book,
      opponentPreviousWasBadMove: previousWasBad,
      winBefore,
      winAfterPlayed,
      // Mate detection from the curve: scoreToWinPercent collapses mate to
      // 100/0, so a mover sitting at exactly 0 after their move, from a
      // position that was not already 0, has allowed one.
      mateAllowed: winAfterPlayed === 0 && winBefore > 0,
      moverWasMating: winBefore === 100,
      stillMating: winAfterPlayed === 100,
    });

    out.push({
      ply,
      san,
      uci,
      fenBefore,
      fenAfter,
      mover,
      best: { uci: before.bestUci, san: safeSan(fenBefore, before.bestUci) },
      winBefore,
      winAfterPlayed,
      drop,
      accuracy: moveAccuracy(drop),
      label,
      book,
      phase: phaseOf({ ply, fen: fenBefore, inBook: book }),
    });
    previousWasBad = isBadMove(label);
  }
  return out;
}

/**
 * The engine's best move should always be legal, but a partial info line or a
 * synthetic fallback (EngineClient emits `{ move: best, pv: [best] }` when no
 * info arrived) can produce something toSan rejects. Showing the UCI is honest;
 * throwing away the whole review is not.
 */
function safeSan(fen: string, uci: string): string {
  try {
    return toSan(fen, uci);
  } catch {
    return uci;
  }
}

export interface BuildInput {
  source: ReviewSource;
  positions: AnalysedPosition[];
  band: Band;
  book: { name: string | null; leftBookAtPly: number | null; bookPlies: boolean[] };
  depth: number;
  partial: boolean;
  now: string;
}

export function buildReview(input: BuildInput): Review {
  const moves = judgeMoves({
    positions: input.positions,
    sans: input.source.sans,
    band: input.band,
    bookPlies: input.book.bookPlies,
  });

  const counts: Partial<Record<MoveLabel, number>> = {};
  for (const m of moves) counts[m.label] = (counts[m.label] ?? 0) + 1;

  const meanFor = (c: Color): number | null => {
    const mine = moves.filter((m) => m.mover === c && !m.book);
    if (mine.length === 0) return null;
    return Number((mine.reduce((n, m) => n + m.accuracy, 0) / mine.length).toFixed(1));
  };

  return {
    gameId: input.source.gameId,
    learner: input.source.learner,
    depth: input.depth,
    partial: input.partial,
    moves,
    accuracy: { w: meanFor('w'), b: meanFor('b') },
    counts,
    opening: input.book.name === null ? null : { name: input.book.name, leftBookAtPly: input.book.leftBookAtPly },
    turningPhase: turningPhaseOf(moves, input.source.learner),
    keyMoments: selectKeyMoments(moves, input.source.learner),
    errors: errorsFrom(moves, {
      gameId: input.source.gameId,
      learner: input.source.learner,
      timeControl: input.source.timeControl,
      now: input.now,
    }),
    createdAt: input.now,
  };
}

/**
 * PRD F-RV-3, "the phase in which the game turned". Null when nothing crossed
 * the line — a game that stayed level never turned, and naming a phase anyway
 * would be a claim about a thing that did not happen.
 */
export function turningPhaseOf(moves: ReviewedMove[], learner: Color): Phase | null {
  const crossings = moves.filter(
    (m) => m.mover === learner && !m.book && m.winBefore > 50 && m.winAfterPlayed < 50,
  );
  if (crossings.length === 0) return null;
  return crossings.reduce((a, b) => (b.drop > a.drop ? b : a)).phase;
}

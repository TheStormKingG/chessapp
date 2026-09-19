import { scoreToWinPercent } from '@/engine';
import type { EventPayload } from '@/data';
import { PIECE_VALUE, applyMove, piecesOf } from '@/rules';
import type { Color } from '@/rules';
import { AnalysisService, type AnalysisEngine } from './AnalysisService';
import { buildReview, withMoves } from './buildReview';
import { positionsOf } from './gameSource';
import { upgradeKeyMoment } from './labels';
import type { Band, KeyMoment, Review, ReviewSource } from './types';

/**
 * Orchestration for one review. No React in this file — it is a .ts module so
 * that eslint's react-refresh rule stays out of the way and so the whole flow
 * is testable without rendering anything.
 */

export interface ReviewTable {
  get(gameId: string): Promise<Review | undefined>;
  put(review: Review): Promise<unknown>;
}

export interface BookLookup {
  name: string | null;
  leftBookAtPly: number | null;
  bookPlies: boolean[];
}

export interface ReviewRun {
  review: Review;
  fromCache: boolean;
}

export async function reviewFor(args: {
  source: ReviewSource;
  table: ReviewTable;
  engine: AnalysisEngine;
  band: Band;
  book: BookLookup | null;
  onProgress?: (done: number, total: number) => void;
  service?: AnalysisService;
  now?: () => string;
}): Promise<ReviewRun> {
  const cached = await args.table.get(args.source.gameId);
  // A partial review is a promise the app has not kept yet, so it is re-run
  // rather than served. A complete one is derived data and never goes stale:
  // the same moves at the same depth give the same review.
  if (cached && !cached.partial) return { review: cached, fromCache: true };

  const { fens } = positionsOf(args.source.sans);
  const service = args.service ?? new AnalysisService(args.engine, { onProgress: args.onProgress });
  const run = await service.run(fens);

  const book: BookLookup = args.book ?? {
    name: null,
    leftBookAtPly: 0,
    bookPlies: args.source.sans.map(() => false),
  };

  const review = buildReview({
    source: args.source,
    positions: run.positions,
    band: args.band,
    book,
    depth: run.depth,
    partial: run.partial || run.cancelled || run.failed,
    now: (args.now ?? (() => new Date().toISOString()))(),
  });

  await args.table.put(review);
  return { review, fromCache: false };
}

/**
 * PRD F-RV-1: "Key moments are then re-analysed at a higher depth." Runs after
 * the summary is on screen, so it is outside the 60-second budget entirely
 * (design spec section 1.5, C2).
 */
export async function deepenMoments(
  review: Review,
  engine: AnalysisEngine,
  depth: number,
  band: Band,
): Promise<Review> {
  const service = new AnalysisService(engine);
  const moments: KeyMoment[] = [];
  const moves = [...review.moves];

  for (const m of review.keyMoments) {
    const move = moves[m.ply];
    if (!move) {
      moments.push(m);
      continue;
    }
    try {
      const a = await service.deepen(move.fenBefore, depth);
      const first = a.lines[0];
      const second = a.lines[1];
      // No first line at all is not a deeper result. It should not happen, but
      // `undefined.score` would be caught below and silently look identical to
      // a dead engine, so it is named here instead.
      if (!first) {
        moments.push(m);
        continue;
      }
      const deeper = {
        depth,
        bestWin: scoreToWinPercent(first.score),
        // One legal move means no second line. Null says so; a fabricated
        // number would turn every forced move into a "Great" find.
        secondWin: second ? scoreToWinPercent(second.score) : null,
        bestUci: first.move,
        secondUci: second?.move ?? null,
      };
      moments.push({ ...m, deeper });

      // THIS is where Great and Brilliant are applied. Without it,
      // upgradeKeyMoment is dead code and two of Appendix C's labels never
      // appear, which no test of labels.ts alone would notice.
      const sacrifice = materialSwing(move.fenBefore, move.fenAfter, move.mover);
      moves[m.ply] = {
        ...move,
        label: upgradeKeyMoment({
          band,
          label: move.label,
          winBefore: move.winBefore,
          secondWin: deeper.secondWin,
          materialSacrificed: Math.max(0, -sacrifice),
          materialRegained: regainedInPv(move.fenAfter, first.pv, move.mover),
        }),
      };
    } catch {
      // The deeper pass is an enhancement. If the engine is gone, the moment
      // still renders from the first pass, without Great or Brilliant.
      moments.push(m);
    }
  }
  // `moves` now carries Great and Brilliant that `buildReview` never saw, so
  // every field derived from it is rebuilt rather than left describing the
  // first pass. `keyMoments` is passed through, not recomputed — see
  // `derivedFrom`.
  return { ...withMoves(review, moves), keyMoments: moments };
}

/** Change in the mover's material, in PIECE_VALUE points, across one move. */
export function materialSwing(fenBefore: string, fenAfter: string, mover: Color): number {
  return balance(fenAfter, mover) - balance(fenBefore, mover);
}

function balance(fen: string, mover: Color): number {
  const other: Color = mover === 'w' ? 'b' : 'w';
  const side = (c: Color) =>
    piecesOf(fen, c).reduce((n, { piece }) => (piece.type === 'k' ? n : n + PIECE_VALUE[piece.type]), 0);
  return side(mover) - side(other);
}

/**
 * How much of a sacrifice the engine's own line gives straight back. Appendix C
 * says Brilliant needs material "given up and not immediately regained", so
 * "immediately" gets a number: the next four plies of the principal variation.
 */
export function regainedInPv(fenAfter: string, pv: string[], mover: Color): number {
  let fen = fenAfter;
  const start = balance(fen, mover);
  for (const uci of pv.slice(0, 4)) {
    try {
      fen = applyMove(fen, uci).fen;
    } catch {
      break;
    }
  }
  return Math.max(0, balance(fen, mover) - start);
}

/**
 * PRD 2.2 and F-RV-7c. Returns the event payload to append, or null when the
 * review must not count.
 *
 * The CALLER appends this before rendering any "done" heading — a screen that
 * states a fact must have banked the state that makes it true. Design spec
 * section 8.
 */
export function bankReview(review: Review, drillCompleted: boolean): EventPayload | null {
  if (review.partial) return null;
  const mine = review.learner === 'w' ? review.accuracy.w : review.accuracy.b;
  return {
    type: 'game_reviewed',
    gameId: review.gameId,
    accuracy: mine ?? 0,
    blunders: review.counts.Blunder ?? 0,
    mistakes: review.counts.Mistake ?? 0,
    drillCompleted,
    partial: false,
  };
}

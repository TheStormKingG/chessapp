import { Chess } from 'chess.js';
import { legalMoves, pieceAt, type Color, type LegalMove, type Square } from '@/rules';
import { attackerCensus } from './census';
import { rng, type Rng } from './rng';
import { MODE_TITLE, type VisionMode, type VisionQuestion } from './types';

/**
 * The three question generators of F-PR-2.
 *
 * ── EVERY QUESTION IS DERIVED FROM A BOARD, NEVER FROM A LIST ────────────────
 *
 * No authored question exists anywhere in this feature, and that is a
 * correctness decision rather than a convenience one. A hand-written "d5 is
 * attacked twice" is a claim nothing can check, it is wrong the moment someone
 * edits the position beside it, and there is no way to tell a typo from a
 * lesson. Here:
 *
 *  - the square in `find-square` is one of the 64, enumerated;
 *  - the move in `find-destination` comes from `legalMoves`, and its SAN is
 *    written by chess.js, so the notation and the destination cannot disagree;
 *  - the count in `count-attackers` comes from `attackerCensus`, which is
 *    battery-aware and validated against known positions in census.test.ts.
 *
 * ── AND EVERY POSITION IS TOO ───────────────────────────────────────────────
 *
 * Positions are played out from the opening position with seeded random legal
 * moves. That gives real, legal, varied middlegames with no position file to
 * maintain and nothing hand-entered to be wrong — and `content/` is untouched,
 * which matters because the drills in src/practice/ read it and this feature
 * must not add a second, unverified corpus beside the verified one.
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** All 64, enumerated from the coordinate system itself. */
export const ALL_SQUARES: readonly Square[] = FILES.flatMap((f) => RANKS.map((r) => `${f}${r}` as Square));

/**
 * The board `find-square` is asked on: the two kings and nothing else.
 *
 * Near-empty rather than empty, because an empty board is not a legal FEN
 * ("missing white king") and every board-reading helper in src/rules loads a
 * position strictly. Near-empty rather than populated, because the mode tests
 * coordinate literacy and pieces are a different skill measured by the other
 * two modes.
 */
export const BARE_BOARD = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

/** How many counts the answer buttons offer, so a generated answer must fit. */
export const MAX_COUNT_ANSWER = 6;

/**
 * A legal position, played out from the start.
 *
 * Between 12 and 30 plies: long enough that the position is not an opening book
 * line the learner may recognise, short enough that material is still on the
 * board for the other two modes to ask about. A game that ends early yields the
 * final position, which is legal and answerable like any other.
 */
export function playedPosition(r: Rng): string {
  const game = new Chess();
  const plies = 12 + r.int(19);
  for (let i = 0; i < plies; i++) {
    const moves = game.moves();
    if (moves.length === 0) break;
    game.move(r.pick(moves));
  }
  return game.fen();
}

/** F-PR-2 mode one: a coordinate is named, the learner taps it. */
function findSquare(r: Rng): VisionQuestion {
  const square = r.pick(ALL_SQUARES);
  return {
    mode: 'find-square',
    prompt: `Where is ${square}?`,
    fen: BARE_BOARD,
    subject: null,
    answer: { kind: 'square', square },
    because: `${square} is file ${square[0]!}, rank ${square[1]!}.`,
  };
}

/**
 * F-PR-2 mode two: a move is written in notation, the learner taps where the
 * piece lands.
 *
 * ── CASTLING IS EXCLUDED, DELIBERATELY ──────────────────────────────────────
 *
 * "O-O" moves two men, so "where does the piece land" has two defensible
 * answers, and a learner who taps the rook's square is not wrong — they are
 * answering a different question from the one being marked. Rather than mark
 * them wrong or accept both and teach nothing, the mode does not ask.
 *
 * The rule lives in `askableMoves` rather than inline here, because a filter
 * buried in a generator can only be tested THROUGH the generator — and the
 * generator draws one move out of thirty-odd, so sixty seeds can easily never
 * draw a castling move at all. Measured, not assumed: with the filter deleted, a
 * sixty-seed test asserting "no question names O-O" went on passing, and a
 * positive control showing castling was AVAILABLE in those positions passed too.
 * Availability in the population is not reachability through the draw. As its own
 * function the rule is checked directly and deterministically.
 */

/**
 * The moves `find-destination` may ask about: every legal move except castling.
 *
 * Exported so the exclusion can be tested without going through the random draw.
 */
export function askableMoves(fen: string): LegalMove[] {
  return legalMoves(fen).filter((m) => !m.san.startsWith('O-O'));
}

function findDestination(r: Rng): VisionQuestion {
  // Retry the position, not the move: a position can be all-castling only if it
  // has exactly one legal move, which no position reached in 12+ plies has.
  for (let attempt = 0; attempt < 8; attempt++) {
    const fen = playedPosition(r);
    const candidates = askableMoves(fen);
    if (candidates.length === 0) continue;
    const move = r.pick(candidates);
    const mover = pieceAt(fen, move.from);
    return {
      mode: 'find-destination',
      prompt: `${move.san} — where does it land?`,
      fen,
      subject: null,
      answer: { kind: 'square', square: move.to },
      because: `${move.san} moves the ${mover ? NAME[mover.type] : 'piece'} from ${move.from} to ${move.to}.`,
    };
  }
  /* c8 ignore next 2 -- eight independent positions with no non-castling move. */
  throw new Error('no position with a non-castling legal move');
}

const NAME: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/**
 * F-PR-2 mode three: count the men attacking a square.
 *
 * The count comes from `attackerCensus`, so a doubled rook counts twice — see
 * census.ts for why the rules module's own `attackersOf` cannot be used here and
 * what a learner would be marked wrong for if it were.
 *
 * Squares are FILTERED, not invented: every square on the board is censused and
 * the question is drawn from those whose answer is between 1 and
 * `MAX_COUNT_ANSWER`. Zero is excluded because "nothing attacks h8" is a
 * question a learner passes by not looking, and the ceiling is there because the
 * answer has to be one of the buttons on the screen.
 */
function countAttackers(r: Rng): VisionQuestion {
  for (let attempt = 0; attempt < 8; attempt++) {
    const fen = playedPosition(r);
    const by: Color = r.next() < 0.5 ? 'w' : 'b';
    const answerable = ALL_SQUARES.map((square) => ({ square, census: attackerCensus(fen, square, by) })).filter(
      (c) => c.census.length >= 1 && c.census.length <= MAX_COUNT_ANSWER,
    );
    if (answerable.length === 0) continue;
    const { square, census } = r.pick(answerable);
    const side = by === 'w' ? 'White' : 'Black';
    return {
      mode: 'count-attackers',
      prompt: `How many ${side.toLowerCase()} men attack ${square}?`,
      fen,
      subject: square,
      answer: { kind: 'count', count: census.length },
      // The squares, not just the number: a learner who said 1 where the answer
      // is 2 needs to be shown the man they did not see.
      because: `${side} attacks ${square} with ${census.length === 1 ? 'one man' : `${String(census.length)} men`}: ${census.join(', ')}.`,
    };
  }
  /* c8 ignore next 2 -- eight positions in which no square has 1..6 attackers. */
  throw new Error('no position with an answerable square');
}

const GENERATORS: Record<VisionMode, (r: Rng) => VisionQuestion> = {
  'find-square': findSquare,
  'find-destination': findDestination,
  'count-attackers': countAttackers,
};

/**
 * One question for `mode`, determined entirely by `seed`.
 *
 * The seed is the round's seed plus the question's index, so a round is a
 * reproducible sequence and a test can name the question it means.
 */
export function visionQuestion(mode: VisionMode, seed: number): VisionQuestion {
  return GENERATORS[mode](rng(seed));
}

/** The heading a mode is shown under. Re-exported so screens need one import. */
export function modeTitle(mode: VisionMode): string {
  return MODE_TITLE[mode];
}

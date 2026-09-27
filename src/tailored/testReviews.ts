import { START_FEN, applyMove, toUci } from '@/rules';
import type { Color } from '@/rules';
import type { ErrorEntry, Phase, Review, ReviewedMove } from '@/review/types';
import type { OwnGame } from './ownPositions';

/**
 * Synthetic reviews over REAL positions, for the tailored-session tests.
 *
 * ── WHY NOT src/profile/testGames.ts ─────────────────────────────────────────
 *
 * That fixture sets every `fenBefore` to `START_FEN` and every `bestUci` to
 * `b1c3`, which is right for what it was built for: the profile's arithmetic never
 * looks at a board, so a fixture that invented one would be testing chess.js.
 *
 * This feature is the opposite. It asks an engine whether a position has a single
 * answer, turns positions into challenges whose answers must be LEGAL there, and
 * replays the opponent's move that produced them. Every one of those breaks or,
 * worse, silently passes against a fixture whose positions are all the starting
 * position with a knight move as the answer. So this walks a real move list, and
 * the FENs and UCIs are computed from it rather than written down.
 *
 * NOT exported from the barrel and not shipped, for the reason src/profile/index.ts
 * gives about `testGames.ts`: a barrel export is one import away from a screen
 * rendering invented chess at a learner.
 */

export interface ErrorSpec {
  /** Index into `sans`. Must be a move by the learner. */
  ply: number;
  theme: string;
  /** The engine's move in that position, in SAN. Must be legal there. */
  bestSan: string;
  label?: 'Mistake' | 'Blunder' | 'Miss';
  /** Which phase the mistake fell in. F-TS-5 branches on it. */
  phase?: Phase;
}

export interface ReviewSpec {
  gameId?: string;
  learner?: Color;
  /** The game, in SAN. Walked with the real rules, so it must be a legal game. */
  sans: string[];
  errors?: ErrorSpec[];
  playedAt?: string;
  opponent?: string | null;
  opening?: { name: string; leftBookAtPly: number | null } | null;
}

export function aReview(spec: ReviewSpec): Review {
  const gameId = spec.gameId ?? 'g1';
  const learner: Color = spec.learner ?? 'w';
  const moves: ReviewedMove[] = [];
  let fen = START_FEN;
  spec.sans.forEach((san, ply) => {
    const r = applyMove(fen, san);
    moves.push({
      ply,
      san: r.san,
      uci: r.uci,
      fenBefore: fen,
      fenAfter: r.fen,
      mover: ply % 2 === 0 ? 'w' : 'b',
      best: { uci: r.uci, san: r.san },
      winBefore: 50,
      winAfterPlayed: 50,
      drop: 0,
      accuracy: 90,
      label: 'Good',
      book: false,
      phase: 'middlegame',
    });
    fen = r.fen;
  });

  const errors: ErrorEntry[] = (spec.errors ?? []).map((e) => {
    const move = moves[e.ply];
    if (!move) throw new Error(`no ply ${String(e.ply)} in a ${String(moves.length)}-move game`);
    if (move.mover !== learner) {
      // A fixture that filed one of the opponent's moves as the learner's mistake
      // would make every own-position drill ask the learner to play the wrong side,
      // and every board would still look legal.
      throw new Error(`ply ${String(e.ply)} is ${move.mover}'s move, not the learner's`);
    }
    // Recomputed, not stated: a `bestUci` that was not legal in `fenBefore` is the
    // one fixture error that produces a plausible-looking broken challenge.
    const bestUci = toUci(move.fenBefore, e.bestSan);
    // The drop is what marks the move as an error for anything that reads `moves`.
    move.drop = 30;
    move.label = e.label ?? 'Mistake';
    return {
      gameId,
      ply: e.ply,
      fenBefore: move.fenBefore,
      playedSan: move.san,
      bestSan: e.bestSan,
      bestUci,
      label: e.label ?? 'Mistake',
      theme: e.theme,
      phase: e.phase ?? 'middlegame',
      clockMs: null,
      lessonId: null,
      typical: true,
      createdAt: spec.playedAt ?? '2026-09-20T12:00:00.000Z',
    };
  });

  return {
    gameId,
    learner,
    depth: 14,
    partial: false,
    moves,
    accuracy: { w: null, b: null },
    myCounts: {},
    opening: spec.opening ?? null,
    turningPhase: null,
    keyMoments: [],
    errors,
    createdAt: spec.playedAt ?? '2026-09-20T12:00:00.000Z',
  };
}

export function anOwnGame(spec: ReviewSpec): OwnGame {
  return {
    gameId: spec.gameId ?? 'g1',
    playedAt: spec.playedAt ?? '2026-09-20T12:00:00.000Z',
    opponent: spec.opponent === undefined ? 'Rosa' : spec.opponent,
    review: aReview(spec),
  };
}

/**
 * A short real game in which White's 4th move hangs a knight, and the answer to
 * the position before it is a capture.
 *
 * Italian: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 — after 4.Ng5 Black can play 4...Nxe4
 * or d5; before it White should have played d3 or Nc3 or O-O. The fixture does not
 * claim the engine agrees with any particular move: the SAN it names as best is
 * legal and that is all a fixture can honestly assert. Positions are verified by
 * the engine at runtime, and the tests that care about a verdict supply it.
 */
export const ITALIAN_SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'];

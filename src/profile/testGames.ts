import { START_FEN } from '@/rules';
import type { Color } from '@/rules';
import type { ErrorEntry, MoveLabel, Phase, Review, ReviewedMove } from '@/review/types';
import { THEME_LESSON, type Theme } from '@/review/errorLog';
import type { ProfileGame } from './types';

/**
 * Synthetic `ProfileGame`s for the profile's tests.
 *
 * ── WHY THIS IS A MODULE AND NOT INLINE IN EACH TEST FILE ────────────────────
 *
 * The rest of src/ builds its fixtures inline, and for a single test file that is
 * right. Five test files need a `Review` here, and a `Review` has fourteen fields
 * of which the profile reads eleven. Five hand-built copies of that would drift,
 * and the drift would be silent: a per-file fixture that happened to set
 * `mover: 'w'` on every move while the review's `learner` was `'b'` would make
 * every count zero, and a test asserting zero would pass.
 *
 * So the fixture is built ONCE, from a compact spec, and the defaults are stated
 * here where a reader checking a surprising test result will look for them.
 *
 * NOT A TEST FILE and not shipped: vitest collects `src/**\/*.test.ts` only, and
 * nothing in the app imports this, so it is tree-shaken out of the build. It is
 * typechecked and linted like everything else, which is the point of keeping it
 * in src/ rather than beside the tests.
 *
 * NO ENGINE. Every number is stated by the spec, so the tests exercise the
 * profile's arithmetic and not Stockfish's. A fixture that ran the analysis path
 * would be testing three features at once and would be slow enough that nobody
 * would run it.
 */

export interface MoveSpec {
  /** Defaults to the game's learner: these are the learner's moves. */
  mover?: Color;
  label?: MoveLabel;
  /** Per-move accuracy, 0–100. Defaults to something consistent with `label`. */
  accuracy?: number;
  phase?: Phase;
  /** Win per cent for the mover before the move. Defaults to 50. */
  winBefore?: number;
  drop?: number;
  san?: string;
  /** The engine's best move, in SAN. Matters for `isForcing`. */
  bestSan?: string;
  book?: boolean;
}

export interface ErrorSpec {
  theme: Theme;
  label?: 'Mistake' | 'Blunder' | 'Miss';
  ply?: number;
}

export interface GameSpec {
  gameId?: string;
  /** ISO 8601. Tests that care about order set this explicitly. */
  playedAt?: string;
  result?: 'win' | 'loss' | 'draw';
  learner?: Color;
  speed?: ProfileGame['speed'];
  moves?: MoveSpec[];
  errors?: ErrorSpec[];
  opening?: { name: string; leftBookAtPly: number | null } | null;
  /** How many key moments are of kind `found` (F-RV-4). */
  found?: number;
  partial?: boolean;
}

/**
 * A default accuracy per label, so a spec that names a label without an accuracy
 * still produces numbers that hang together. The values are indicative, not
 * PRD §10.6's curve — a test that cares about the curve states the accuracy.
 */
const ACCURACY_FOR: Record<MoveLabel, number> = {
  Brilliant: 100,
  Great: 99,
  Best: 98,
  Excellent: 92,
  Good: 84,
  Book: 100,
  Inaccuracy: 68,
  Mistake: 45,
  Miss: 40,
  Blunder: 20,
};

let counter = 0;

export function aGame(spec: GameSpec = {}): ProfileGame {
  counter += 1;
  const gameId = spec.gameId ?? `g${String(counter)}`;
  const learner: Color = spec.learner ?? 'w';
  const moveSpecs = spec.moves ?? [];

  const moves: ReviewedMove[] = moveSpecs.map((m, i) => {
    const label: MoveLabel = m.label ?? 'Good';
    const winBefore = m.winBefore ?? 50;
    const drop = m.drop ?? 0;
    return {
      ply: i,
      san: m.san ?? 'Nf3',
      uci: 'g1f3',
      fenBefore: START_FEN,
      fenAfter: START_FEN,
      mover: m.mover ?? learner,
      best: { uci: 'g1f3', san: m.bestSan ?? 'Nf3' },
      winBefore,
      winAfterPlayed: Math.max(0, winBefore - drop),
      drop,
      accuracy: m.accuracy ?? ACCURACY_FOR[label],
      label,
      book: m.book ?? false,
      phase: m.phase ?? 'middlegame',
    };
  });

  const errors: ErrorEntry[] = (spec.errors ?? []).map((e, i) => ({
    gameId,
    ply: e.ply ?? i,
    fenBefore: START_FEN,
    playedSan: 'Nf3',
    bestSan: 'Nc3',
    bestUci: 'b1c3',
    label: e.label ?? 'Mistake',
    theme: e.theme,
    phase: 'middlegame',
    clockMs: null,
    lessonId: THEME_LESSON[e.theme],
    typical: e.theme !== 'unclassified',
    createdAt: spec.playedAt ?? '2026-01-01T00:00:00.000Z',
  }));

  const review: Review = {
    gameId,
    learner,
    depth: 14,
    partial: spec.partial ?? false,
    moves,
    // Whole-game accuracy is not read by the profile — it computes its own per
    // phase — so it is left null rather than given a number that could be taken
    // for a source of truth.
    accuracy: { w: null, b: null },
    counts: {},
    opening: spec.opening === undefined ? null : spec.opening,
    turningPhase: null,
    keyMoments: Array.from({ length: spec.found ?? 0 }, (_, i) => ({
      ply: i,
      kind: 'found' as const,
      deeper: null,
      explanation: null,
      lessonId: null,
    })),
    errors,
    createdAt: spec.playedAt ?? '2026-01-01T00:00:00.000Z',
  };

  return {
    gameId,
    playedAt: spec.playedAt ?? '2026-01-01T00:00:00.000Z',
    result: spec.result ?? 'draw',
    speed: spec.speed ?? 'rapid',
    review,
  };
}

/**
 * `n` games, newest first, each `spec` — with `playedAt` descending so the caller
 * does not have to invent forty dates to test a sample-size boundary.
 *
 * Day 500 counting DOWN, so index 0 is the most recent. A helper that numbered
 * them upwards would put the oldest game first and quietly invert every recency
 * test built on it.
 *
 * ── `offset`, AND WHY IT IS NOT OPTIONAL IN PRACTICE ─────────────────────────
 *
 * Every call without an offset produces the SAME dates and the SAME game IDs, so
 * `[...games(20, a), ...games(20, b)]` is forty games occupying twenty days and
 * twenty ids. `buildProfile` sorts by date, ties break by id, and the two blocks
 * interleave — so a test meaning "twenty recent games then twenty older ones" gets
 * an alternating mixture and F-SW-7's windows contain both.
 *
 * That is exactly what happened, and the test it broke failed loudly, which is the
 * good case. The quiet case is a test whose assertion happens to hold under
 * interleaving. So: any caller concatenating two blocks passes the running total
 * as `offset`, and the ids carry it too, which makes a collision impossible rather
 * than merely unlikely.
 */
export function games(n: number, spec: (i: number) => GameSpec = () => ({}), offset = 0): ProfileGame[] {
  return Array.from({ length: n }, (_, i) => {
    const rank = offset + i;
    const day = 500 - rank;
    return aGame({
      gameId: `seq-${String(rank)}`,
      playedAt: new Date(Date.UTC(2026, 0, 1) + day * 86_400_000).toISOString(),
      ...spec(i),
    });
  });
}

/** A game with one mistake of `theme`, and nothing else notable. */
export function gameWithTheme(theme: Theme, over: GameSpec = {}): ProfileGame {
  return aGame({
    moves: [{ label: 'Mistake', drop: 20, winBefore: 60 }],
    errors: [{ theme }],
    ...over,
  });
}

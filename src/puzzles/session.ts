import type { AttemptResult, Puzzle, PuzzleSource } from './types';

/**
 * One puzzle attempt, as a pure reducer in the shape `LessonMachine` settled
 * into: an explicit state, an action union, no React and no side effects.
 *
 * This module owns F-PZ-4 (spec §3.3). The hint-accounting table lives here and
 * nowhere else, because a rule with two homes has two versions of itself the
 * moment one is edited.
 */

export interface SessionState {
  puzzle: Puzzle;
  source: PuzzleSource;
  /**
   * The index in `puzzle.solution` the learner must play now. Their moves are
   * every other ply from `firstLearnerPly`; the plies between are the
   * opponent's and are replayed, not asked for.
   */
  ply: number;
  /** The UCI the learner must play now, or null once the puzzle is over. */
  expected: string | null;
  hinted: boolean;
  misses: number;
  solved: boolean;
  done: boolean;
  startedAt: number;
  endedAt: number | null;
}

export type SessionAction =
  | { type: 'move'; uci: string; at?: number }
  | { type: 'hint'; at?: number }
  | { type: 'giveUp'; at?: number };

export interface SessionOptions {
  /** The clock the caller reads. Defaulted so a test need not supply one. */
  now?: number;
  /**
   * Which ply of `solution` the learner plays first. 1 for a pack puzzle —
   * `solution[0]` is the opponent's move, per the convention in `types.ts`.
   * 0 for a drill built from the learner's own error position, where there is
   * no opponent move to replay and they are already to move.
   *
   * Explicit rather than inferred from the solution's length: a wrong guess
   * here asks the learner to play the wrong side, and every position still
   * looks legal, so no verifier and no rules check would catch it.
   */
  firstLearnerPly?: 0 | 1;
}

export function initial(
  puzzle: Puzzle,
  source: PuzzleSource,
  opts: SessionOptions = {},
): SessionState {
  const ply = opts.firstLearnerPly ?? 1;
  return {
    puzzle,
    source,
    ply,
    expected: puzzle.solution[ply] ?? null,
    hinted: false,
    misses: 0,
    solved: false,
    done: false,
    startedAt: opts.now ?? 0,
    endedAt: null,
  };
}

export function reduce(s: SessionState, a: SessionAction): SessionState {
  if (s.done) return s;
  switch (a.type) {
    case 'hint':
      return s.hinted ? s : { ...s, hinted: true };

    case 'giveUp':
      return { ...s, done: true, solved: false, expected: null, endedAt: a.at ?? s.startedAt };

    case 'move': {
      if (a.uci !== s.expected) return { ...s, misses: s.misses + 1 };
      // Correct. Skip the opponent's reply and ask for the next learner move;
      // if there is none, the puzzle is solved.
      const next = s.ply + 2;
      const expected = s.puzzle.solution[next] ?? null;
      if (expected === null) {
        return { ...s, ply: next, expected: null, solved: true, done: true, endedAt: a.at ?? s.startedAt };
      }
      return { ...s, ply: next, expected };
    }
  }
}

/**
 * The F-PZ-4 table, spec §3.3:
 *
 * | Sequence               | solved | mastered | ratingCounts |
 * |------------------------|--------|----------|--------------|
 * | Correct, no hint       | true   | true     | true         |
 * | Correct, after a hint  | true   | false    | false        |
 * | Failed, after a hint   | false  | false    | true         |
 * | Correct, after a miss  | true   | false    | true         |
 * | Any, source `themed`   | -      | -        | false        |
 *
 * `mastered` is `hints === 0 && misses === 0`. NOT `misses <= 1`: the
 * checkpoint machine admitted one prior miss, which meant a learner guessing
 * twice could not fail. Do not reintroduce a tolerance.
 *
 * `ratingCounts` is the SAME expression as the projection's guard in
 * `src/data/reduce.ts` — deliberate duplication of one rule across a module
 * boundary, because the projection cannot import a session it never saw. If
 * the rule changes, change both; a test in Task 18 asserts they agree across
 * every combination.
 */
export function result(s: SessionState): AttemptResult {
  return {
    puzzleId: s.puzzle.id,
    solved: s.solved,
    hinted: s.hinted,
    misses: s.misses,
    ms: (s.endedAt ?? s.startedAt) - s.startedAt,
    source: s.source,
    mastered: s.solved && !s.hinted && s.misses === 0,
    ratingCounts: s.source !== 'themed' && !(s.solved && s.hinted),
  };
}

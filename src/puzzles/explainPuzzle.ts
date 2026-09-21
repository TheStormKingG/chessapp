import type { CoachEvent, CoachService } from '@/coach';
import { toSan } from '@/rules';
import type { Theme } from './types';

/**
 * F-PZ-5, "explain on miss" (design spec §5.4).
 *
 * `src/review/explain.ts` is reused UNMODIFIED — it is not imported here
 * because a puzzle miss is not a `ReviewedMove` and forcing one into that shape
 * would mean inventing an engine evaluation nobody ran. What is reused is its
 * discipline, verbatim: the only sentences this can produce are the ones in
 * `content/coach/templates.json`, filled from facts the caller can verify, and
 * a missing fact yields null rather than a plausible sentence.
 *
 * THE OTHER HALF OF THAT LESSON IS THE ONE THAT BIT. `explain.ts`'s honesty
 * rule worked perfectly while its only call site supplied no facts at all, so
 * the two commonest themes rendered with NO explanation — silence that looked
 * like discipline and was a defect. So this module supplies its facts, and
 * `explainPuzzle.test.ts` asserts that a real miss produces real text. The
 * null test alone is satisfied by a function that always returns null.
 *
 * What licenses each sentence:
 *
 * - `{playedSan}` — the move the learner actually played, converted from the
 *   position they were actually asked about. If it will not convert it is not
 *   a move in that position, and nothing is said.
 * - `{bestSan}` — `puzzle.solution`'s learner ply. `verify-puzzles.mjs` has
 *   already agreed with Stockfish at depth 14, MultiPV 2, that it is the unique
 *   best by at least 100 cp, so calling it "the answer" is a verified claim.
 * - The MOTIF NAMED IN EACH TEMPLATE — the theme tag the Lichess dump carries
 *   and `build-puzzles.mjs` filtered on. That is what licenses "the answer here
 *   is a fork"; no template says anything about the position beyond its own
 *   theme and the two moves.
 *
 * A puzzle with no theme gets no explanation, and that is the common case for a
 * fix-my-mistakes drill: the review tagger classifies four of PRD §10.3's
 * sixteen motifs, so most of the learner's own errors carry no motif at all.
 * There is nothing verified to name, so nothing is named.
 */

/** The complete set of facts this module ever supplies to a template. */
export const PUZZLE_FACTS = ['playedSan', 'bestSan'] as const;

/** One template per shipped theme. A theme with no entry would render nothing. */
export const PUZZLE_EVENT: Record<Theme, CoachEvent> = {
  backRankMate: 'puzzleBackRankMate',
  mateIn1: 'puzzleMateIn1',
  smotheredMate: 'puzzleSmotheredMate',
  mateIn2: 'puzzleMateIn2',
  attackingF2F7: 'puzzleAttackingF2F7',
  skewer: 'puzzleSkewer',
  fork: 'puzzleFork',
  discoveredAttack: 'puzzleDiscoveredAttack',
};

/** The puzzle templates, all of them. Nothing else in the bank is ours. */
export const PUZZLE_EVENTS = Object.values(PUZZLE_EVENT) as readonly CoachEvent[];

export interface PuzzleExplainInput {
  /**
   * The position the learner was ASKED about — not `puzzle.fen`, which is the
   * position before the opponent's move is replayed. Converting either move
   * against the wrong position gives a wrong SAN or no SAN at all, and a wrong
   * SAN is the one failure this module's whole design exists to prevent.
   */
  fen: string;
  playedUci: string;
  bestUci: string;
  /** The puzzle's primary theme, or null when it has none. */
  theme: Theme | null;
}

export function explainPuzzle(coach: CoachService, input: PuzzleExplainInput): string | null {
  if (input.theme === null) return null;

  // A muted coach still explains: `muted` is the in-game chatter setting, and a
  // learner who turned that off did not ask for a wordless puzzle. Restored on
  // every path, including the throw.
  const wasMuted = coach.muted;
  coach.muted = false;
  try {
    return coach.line(PUZZLE_EVENT[input.theme], {
      playedSan: toSan(input.fen, input.playedUci),
      bestSan: toSan(input.fen, input.bestUci),
    });
  } catch {
    // Either a move did not fit the position or a template needed a fact
    // nobody verified. Say nothing rather than something (F-CO-4).
    return null;
  } finally {
    coach.muted = wasMuted;
  }
}

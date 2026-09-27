import { legalMoves, toSan } from '@/rules';
import type { AnalyseRequest, Analysis, AnalysisLine } from '@/engine';
import type { Score } from '@/engine/uci';

/**
 * F-TS-3's engine gate, at runtime.
 *
 * > "The challenges are drawn first from the learner's own games (the position
 * > before the mistake, with the opponent's move replayed, **verified by the engine
 * > to have a single clear answer**), then from the concept bank at the learner's
 * > difficulty."
 *
 * and F-TS-4's consequence for a position that fails it:
 *
 * > "Positions that the engine cannot verify as single-answer are shown as 'play it
 * > out' drills instead."
 *
 * ── THE RULE IS THE CORPUS'S RULE, DELIBERATELY UNCHANGED ────────────────────
 *
 * scripts/verify-content.mjs is what decides whether an AUTHORED `find_the_move`
 * has one answer, and it is this, at MultiPV 2 and depth 14:
 *
 *   - the engine's best move must be the solution;
 *   - `scoreCp(best) - scoreCp(runnerUp)` must be at least 100 centipawns, where a
 *     mate score collapses to ±10000.
 *
 * Reimplemented here rather than relaxed, because the two gates have to mean the
 * same thing. A learner cannot be shown a tailored challenge that the corpus would
 * have rejected and an authored one that it accepted and be expected to read them
 * as the same kind of question.
 *
 * That includes keeping the rule's two known blind spots rather than quietly
 * fixing them, and naming them in the verdict instead:
 *
 *  - **Mate saturates.** Best mate in one against runner-up mate in six both score
 *    +10000, so the margin is 0 and the position is refused although its answer is
 *    perfectly clear. Comparing mate DISTANCES would accept it — and would then
 *    accept positions the corpus refuses, which is the divergence this file exists
 *    to avoid. It is reported as `mate-saturated` so the count is visible and the
 *    fallback can be the right one (a mate position makes a good "play it out"
 *    drill, which is exactly F-TS-4's instruction).
 *  - **The gate measures the RUNNER-UP, not the mistake.** In a quiet position the
 *    second-best move is merely slower, so a decisive key move can still measure
 *    under 100cp. A learner's real mistakes sit in such positions more often than
 *    not, so a low pass rate here is the expected result and not a defect — the
 *    fallback is the design, not the exception.
 *
 * ── AND THE SEARCH IS A CLEAN ONE ────────────────────────────────────────────
 *
 * `fresh: true`. The verify script's own comment records what happens without it:
 * a position's verdict depends on everything analysed before it, the same corpus
 * was green in one walk order and red in the reverse, and an inherited hash table
 * lifted a 99cp margin over the 100cp bar. A learner-facing verdict must be a
 * property of the position, not of what they happened to look at first.
 */

/** PRD 9.2's depth, and the verify script's. */
export const VERIFY_DEPTH = 14;

/** The verify script's margin, in centipawns. */
export const MARGIN_CP = 100;

/** What a mate score is worth, exactly as `scoreCp` in scripts/verify-content.mjs. */
export const MATE_CP = 10_000;

export function scoreCp(s: Score): number {
  return 'mate' in s ? (s.mate > 0 ? MATE_CP : -MATE_CP) : s.cp;
}

export type UnverifiedReason =
  /** Only one legal move: there is nothing to choose, so it is not a challenge. */
  | 'one-legal-move'
  /** The fresh search disagrees with the move the review recorded as best. */
  | 'engine-disagrees'
  /** Both lines are mates of the same sign, so the margin cannot express the gap. */
  | 'mate-saturated'
  /** A real margin, and it is under the bar. */
  | 'runner-up-too-close'
  /** MultiPV 2 returned fewer than two lines in a position with several legal moves. */
  | 'no-runner-up'
  | 'engine-unavailable';

export type Verdict =
  | { verified: true; bestUci: string; marginCp: number }
  | { verified: false; reason: UnverifiedReason; marginCp: number | null; engineBest: string | null };

function no(reason: UnverifiedReason, marginCp: number | null = null, engineBest: string | null = null): Verdict {
  return { verified: false, reason, marginCp, engineBest };
}

/**
 * The gate itself: pure over the search result, so every branch is testable without
 * an engine and the rule can be read in one place.
 *
 * `expectedUci` is the answer the challenge would claim — for an own position, the
 * `bestUci` the review recorded. The engine must still agree with it: a review run
 * at a shallower depth can name a move a depth-14 search does not, and a challenge
 * whose stated answer is not the engine's best is exactly what the corpus gate
 * refuses.
 */
export function judge(input: {
  expectedUci: string;
  legalMoveCount: number;
  lines: readonly AnalysisLine[];
}): Verdict {
  if (input.legalMoveCount <= 1) return no('one-legal-move');
  const [best, runnerUp] = input.lines;
  if (!best) return no('no-runner-up');
  if (best.move !== input.expectedUci) return no('engine-disagrees', null, best.move);
  if (!runnerUp) {
    // Several legal moves but one line back. The engine was asked for two, so this
    // is a fact about the search and not about the position: refused rather than
    // treated as an unbeatable best move.
    return no('no-runner-up', null, best.move);
  }
  const saturated = 'mate' in best.score && 'mate' in runnerUp.score && Math.sign(best.score.mate) === Math.sign(runnerUp.score.mate);
  const marginCp = scoreCp(best.score) - scoreCp(runnerUp.score);
  if (saturated) return no('mate-saturated', marginCp, best.move);
  if (marginCp < MARGIN_CP) return no('runner-up-too-close', marginCp, best.move);
  return { verified: true, bestUci: best.move, marginCp };
}

/** Just enough of `EngineClient` to verify, so a test can pass a fake. */
export interface Analyser {
  analyse(req: AnalyseRequest): Promise<Analysis>;
}

/**
 * Run the gate against one position.
 *
 * An engine that cannot run is not a finding about the position: it returns
 * `engine-unavailable`, which the callers treat as "fall back", never as "this
 * position is ambiguous". The same distinction scripts/verify-content.mjs draws
 * between a content failure and an instrument fault.
 */
export async function verifyPosition(engine: Analyser, at: { fen: string; expectedUci: string }): Promise<Verdict> {
  const legalMoveCount = legalMoves(at.fen).length;
  if (legalMoveCount <= 1) return no('one-legal-move');
  let analysis: Analysis;
  try {
    analysis = await engine.analyse({ fen: at.fen, depth: VERIFY_DEPTH, multiPv: 2, fresh: true });
  } catch {
    return no('engine-unavailable');
  }
  return judge({ expectedUci: at.expectedUci, legalMoveCount, lines: analysis.lines });
}

/** SAN for a verified answer, or null when the move is not legal in the position. */
export function sanOf(fen: string, uci: string): string | null {
  try {
    return toSan(fen, uci);
  } catch {
    return null;
  }
}

export interface PassRate {
  checked: number;
  verified: number;
  /** Counted per reason, so a low rate can be attributed rather than guessed at. */
  reasons: Partial<Record<UnverifiedReason, number>>;
}

/** The pass rate over a set of verdicts. Reported, never rounded away. */
export function passRate(verdicts: readonly Verdict[]): PassRate {
  const reasons: Partial<Record<UnverifiedReason, number>> = {};
  let verified = 0;
  for (const v of verdicts) {
    if (v.verified) verified += 1;
    else reasons[v.reason] = (reasons[v.reason] ?? 0) + 1;
  }
  return { checked: verdicts.length, verified, reasons };
}

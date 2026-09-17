import type { AnalysisLine } from '@/engine';
import { scoreToWinPercent } from '@/engine';
import type { Complexity, MoveKind, Persona } from './types';

/** A line this far below the best is an error rather than a near-best alternative. */
const NEAR_BEST_DROP = 5;
/** A drop past this is a blunder no persona in these bands plays on purpose. */
const MAX_ERROR_DROP = 60;
/** A line leaving the persona at or below this win per cent is an instant loss (PRD F-PL-2). */
const LOST_WIN_PERCENT = 10;

/**
 * Base rate for the persona's rating, scaled by phase and by how busy the position is
 * (PRD 10.7). Bounded so no persona is a random-mover.
 */
export function errorProbability(p: Persona, c: Complexity): number {
  const phase = c.phase === 'opening' ? p.error.openingFactor : c.phase === 'endgame' ? p.error.endgameFactor : 1;
  return Math.min(0.9, p.error.base * phase * (1 + p.error.complexity * (c.captures + 2 * c.checks)));
}

function styleWeight(p: Persona, kind: MoveKind): number {
  return p.style[kind];
}

/** Weighted pick over `items`, using exactly one rng draw. */
function sample<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  const first = items[0]!;
  if (!(total > 0)) return first;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/**
 * Choose a move from the engine's multi-pv lines the way this persona would (PRD F-PL-2, 10.7).
 *
 * `rng` returns [0,1) and is the only source of randomness, so the result is deterministic for a
 * given sequence. `tag(move)` names the refutation kind if the tagger can name one, else null;
 * when erring, lines whose refutation is nameable are preferred so the coach can explain it.
 * `kindOf(move)` classifies a move for the persona's style weights; without it every move counts
 * as quiet and the sample is uniform.
 */
export function pickMove(
  p: Persona,
  lines: AnalysisLine[],
  c: Complexity,
  rng: () => number,
  tag: (move: string) => string | null,
  kindOf?: (move: string) => MoveKind,
): string {
  const best = lines[0];
  if (!best) throw new Error('no lines');
  const bestWp = scoreToWinPercent(best.score);
  const rated = lines.map((l) => {
    const wp = scoreToWinPercent(l.score);
    return { line: l, wp, drop: bestWp - wp };
  });
  // "Never an instant loss above its band": both a huge drop and an already-lost result count.
  const viable = rated.filter((d) => d.drop <= MAX_ERROR_DROP && d.wp > LOST_WIN_PERCENT);
  // Trivially forced: at most one move that is not an instant loss — play it, never err.
  if (viable.length <= 1) return viable[0]?.line.move ?? best.move;

  const nearBest = viable.filter((d) => d.drop <= NEAR_BEST_DROP);
  const errCandidates = viable.filter((d) => d.drop > NEAR_BEST_DROP);
  if (errCandidates.length > 0 && rng() < errorProbability(p, c)) {
    const nameable = errCandidates.filter((d) => tag(d.line.move) !== null);
    const pool = nameable.length > 0 ? nameable : errCandidates;
    return sample(pool, pool.map(() => 1), rng).line.move;
  }
  const pool = nearBest.length > 0 ? nearBest : viable;
  const weights = pool.map((d) => styleWeight(p, kindOf ? kindOf(d.line.move) : 'quiet'));
  return sample(pool, weights, rng).line.move;
}

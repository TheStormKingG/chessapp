import type { Color } from '@/rules';
import type { KeyMoment, MomentKind, ReviewedMove } from './types';

/**
 * PRD F-RV-4: "Three to five moments chosen by the size of the swing in
 * expected score, with at least one of each kind where present, a good move the
 * learner found, a chance the learner missed, and the mistake that decided the
 * game."
 *
 * Only the learner's moves are candidates. The opponent is a bot; its blunders
 * are not the learner's moments.
 *
 * "At least one of each kind where present" is guaranteed structurally, not by
 * hope, in two steps:
 *
 * 1. The three named kinds are claimed BEFORE the swing-ranked fill runs, so a
 *    bigger swing elsewhere can never crowd a kind out of the list.
 * 2. Each kind takes the biggest candidate **not already claimed by an earlier
 *    kind**. One move can qualify for two kinds (a Miss that also crossed 50 is
 *    both the missed chance and the mistake that decided the game) and can only
 *    be listed once; without the fallback the second kind would be dropped even
 *    though another qualifying move existed, which is exactly what F-RV-4 b
 *    forbids. A kind goes unrepresented only when it genuinely has no other
 *    candidate — that is "where present" doing its work.
 *
 * Claim order is missed, decided, found. It matters only for a move that
 * qualifies for two kinds and has no alternative; the `Miss` case is the one
 * the design calls out, because a Miss says the opponent had just erred, which
 * is the sharper and more teachable version of the idea.
 */

export const MAX_MOMENTS = 5;
export const MIN_MOMENTS = 3;

/** Below this, a "swing" is engine noise rather than a moment. */
const MIN_SWING = 3;
/** "A chance the learner missed": a position that was close to won. */
const WINNING_WIN_PERCENT = 80;

export function selectKeyMoments(moves: ReviewedMove[], learner: Color): KeyMoment[] {
  const mine = moves.filter((m) => m.mover === learner && !m.book);
  const chosen = new Map<number, MomentKind>();

  /** The biggest candidate this kind can still have, or undefined. */
  const biggestFree = (
    pool: ReviewedMove[],
    score: (m: ReviewedMove) => number,
  ): ReviewedMove | undefined =>
    pool
      .filter((m) => !chosen.has(m.ply))
      .reduce<ReviewedMove | undefined>(
        (best, m) => (best === undefined || score(m) > score(best) ? m : best),
        undefined,
      );

  const claim = (
    kind: MomentKind,
    pool: ReviewedMove[],
    score: (m: ReviewedMove) => number,
  ): void => {
    const m = biggestFree(pool, score);
    if (m) chosen.set(m.ply, kind);
  };

  const byDrop = (m: ReviewedMove) => m.drop;

  // 1. A chance missed. A Miss label is the sharper version of the idea, so the
  //    Miss pool is used whenever it has a free candidate.
  const misses = mine.filter((m) => m.label === 'Miss');
  const fromWinning = mine.filter(
    (m) =>
      m.winBefore >= WINNING_WIN_PERCENT &&
      m.winAfterPlayed < WINNING_WIN_PERCENT &&
      m.drop >= MIN_SWING,
  );
  claim('missed', biggestFree(misses, byDrop) !== undefined ? misses : fromWinning, byDrop);

  // 2. The mistake that decided the game: the biggest drop that took a position
  //    the learner was not losing into one they were.
  claim(
    'decided',
    mine.filter((m) => m.winBefore > 50 && m.winAfterPlayed < 50 && m.drop >= MIN_SWING),
    byDrop,
  );

  // 3. A good move the learner found: the biggest improvement in the learner's
  //    own standing, among moves that were actually good.
  claim(
    'found',
    mine.filter(
      (m) => (m.label === 'Best' || m.label === 'Excellent') && m.winAfterPlayed > m.winBefore,
    ),
    (m) => m.winAfterPlayed - m.winBefore,
  );

  // 4. Fill to MAX_MOMENTS by descending swing.
  const bySwing = [...mine].filter((m) => m.drop >= MIN_SWING).sort((a, b) => b.drop - a.drop);
  for (const m of bySwing) {
    if (chosen.size >= MAX_MOMENTS) break;
    if (!chosen.has(m.ply)) chosen.set(m.ply, 'swing');
  }

  return [...chosen.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_MOMENTS)
    .map(([ply, kind]) => ({ ply, kind, deeper: null, explanation: null, lessonId: null }));
}

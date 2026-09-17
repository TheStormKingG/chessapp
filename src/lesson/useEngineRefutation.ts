import { useEffect } from 'react';
import { applyMove, toSan, type Square } from '@/rules';
import { getEngine } from '@/engine';
import { facts } from '@/tagger';
import { CoachService } from '@/coach';
import type { Action, LessonState } from './LessonMachine';
import type { Challenge } from './types';
import type { WrongMove } from './challenges/Sequence';

/**
 * The lesson's own answer for this wrong move, when it has one. Mirrors
 * `authoredWrong` in LessonMachine: only the two move-playing challenge types
 * carry a `wrong` map, and it is keyed by SAN.
 */
function hasAuthoredFeedback(c: Challenge, san: string): boolean {
  if (c.type !== 'find_the_move' && c.type !== 'find_the_sequence') return false;
  return c.wrong?.[san] !== undefined;
}

/**
 * F-PA-6: when a wrong move has no authored answer, ask the engine what the
 * refutation is and let the coach say it, with the refuting move drawn on the
 * board. Silent when the engine is unavailable (F-ER-1) or the coach is muted.
 */
export function useEngineRefutation(
  s: LessonState,
  lastWrong: WrongMove | null,
  dispatch: (a: Action) => void,
  coach: CoachService,
): void {
  const phase = s.phase;
  const challenges = s.lesson.challenges;
  useEffect(() => {
    if (phase.kind !== 'challenge' || phase.status !== 'retry' || !lastWrong) return;
    const c = challenges[phase.index];
    if (!c) return;
    if (c.type !== 'find_the_move' && c.type !== 'find_the_sequence') return;
    if (hasAuthoredFeedback(c, lastWrong.san)) return;
    if (coach.muted) return;
    let cancelled = false;
    void (async () => {
      try {
        const after = applyMove(lastWrong.fen, lastWrong.uci).fen;
        const reply = await getEngine().bestMove({ fen: after, depth: 10 });
        if (cancelled) return;
        const f = facts(applyMove(after, reply).fen);
        const lost = f.myHanging[0];
        const consequence = f.mateInOne
          ? 'you are about to be mated'
          : lost
            ? `your ${CoachService.pieceName(lost.piece)} on ${lost.square} is lost`
            : 'your idea no longer works';
        const text = coach.line('wrongEngine', { refutationSan: toSan(after, reply), consequence });
        if (cancelled || text === null) return;
        dispatch({
          type: 'engineRefutation',
          from: reply.slice(0, 2) as Square,
          to: reply.slice(2, 4) as Square,
          text,
        });
      } catch {
        // Engine unavailable: the generic retry line already stands (F-ER-1).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, lastWrong, challenges, dispatch, coach]);
}

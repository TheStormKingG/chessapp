import { useEffect, useRef } from 'react';
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
 * board. Silent when the engine is unavailable (F-ER-1).
 *
 * Mute (F-PL-3) is a setting about what the coach *says*: neither the arrow nor
 * the replay (D1) is speech, so both happen either way and only the line is
 * dropped. The machine's
 * `engineRefutation` action always carries a text, so the muted case re-sends
 * the feedback already on screen -- the retry line stays, and nothing the coach
 * would have said is added. (CoachBubble renders nothing for an empty text, so
 * a challenge with no feedback yet stays bubble-less.)
 */
export function useEngineRefutation(
  s: LessonState,
  lastWrong: WrongMove | null,
  dispatch: (a: Action) => void,
  coach: CoachService,
): void {
  const phase = s.phase;
  const challenges = s.lesson.challenges;
  // Read at dispatch time, not a dependency: the feedback this effect leaves
  // behind must not be what re-runs it.
  const feedback = s.feedback;
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
  useEffect(() => {
    if (phase.kind !== 'challenge' || phase.status !== 'retry' || !lastWrong) return;
    const c = challenges[phase.index];
    if (!c) return;
    if (c.type !== 'find_the_move' && c.type !== 'find_the_sequence') return;
    if (hasAuthoredFeedback(c, lastWrong.san)) return;
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
        const san = toSan(after, reply);
        const text = coach.line('wrongEngine', { refutationSan: san, consequence });
        if (cancelled) return;
        dispatch({
          type: 'engineRefutation',
          from: reply.slice(0, 2) as Square,
          to: reply.slice(2, 4) as Square,
          text: text ?? (feedbackRef.current ?? ''),
          // D1: the board replays the learner's move and then the answer to
          // it, from the position they played it in. Everything the replay
          // needs is already in hand here, so the board is handed a finished
          // line rather than the means to reconstruct one.
          replay: { fen: lastWrong.fen, moves: [lastWrong.uci, reply], san },
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

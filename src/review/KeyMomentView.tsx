import { useState } from 'react';
import { Board } from '@/board';
import type { BoardMove, Square } from '@/board';
import { CoachBubble } from '@/coach';
import { btn } from '@/app/Button';
import type { Color } from '@/rules';
import { LabelChip } from './LabelChip';
import type { KeyMoment, ReviewedMove } from './types';

/**
 * PRD F-RV-4 and Wireframes screen 15.
 *
 * "At each moment the position is shown before the learner's move and the
 * learner is asked to find the better move (retry before reveal). 'Show me'
 * reveals the answer."
 *
 * The board is the SHARED Board: its keyboard cursor, its single live region
 * and its one tab stop. Nothing here adds a second of any of those — the
 * outcome of a try is spoken through the board's own `announce` prop rather
 * than through a region of this screen's own.
 */

export function KeyMomentView({
  move,
  moment,
  learner,
  ask,
  index,
  total,
  onNext,
  onLesson,
}: {
  move: ReviewedMove;
  moment: KeyMoment;
  learner: Color;
  ask: string | null;
  index: number;
  total: number;
  onNext: () => void;
  onLesson: (lessonId: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [tries, setTries] = useState(0);
  const [announce, setAnnounce] = useState<string | undefined>(undefined);

  const onMove = (m: BoardMove) => {
    if (revealed) return;
    if (m.uci === move.best.uci) {
      setRevealed(true);
      setAnnounce(`${m.san} — that is the move.`);
      return;
    }
    setTries((n) => n + 1);
    setAnnounce(`${m.san} is not it. Try again, or choose Show me.`);
  };

  return (
    <div className="mx-auto w-full max-w-xl p-4">
      <p className="t-label text-content-dim">
        Moment {String(index + 1)} of {String(total)}
      </p>

      <Board
        testId="review-board"
        fen={move.fenBefore}
        orientation={learner}
        mode={revealed ? 'static' : 'play'}
        onMove={onMove}
        announce={announce}
        highlights={revealed ? { [move.best.uci.slice(2, 4) as Square]: 'accent' } : undefined}
      />

      <CoachBubble text={revealed ? moment.explanation : ask} />

      {revealed ? (
        <>
          <p className="t-body mt-3">
            The move was <strong>{move.best.san}</strong>. You played {move.san}.
          </p>
          <p className="mt-1">
            <LabelChip label={move.label} />
          </p>
          {moment.lessonId !== null && (
            <button
              type="button"
              className={`${btn.secondary} mt-3 w-full`}
              onClick={() => { onLesson(moment.lessonId as string); }}
            >
              Replay the lesson
            </button>
          )}
          <button type="button" className={`${btn.primary} mt-3 w-full`} onClick={onNext}>
            {index + 1 === total ? 'Finish' : 'Next moment'}
          </button>
        </>
      ) : (
        <>
          {tries > 0 && <p className="t-caption mt-2 text-content-dim">Not that one. Have another go.</p>}
          <button type="button" className={`${btn.secondary} mt-3 w-full`} onClick={() => { setRevealed(true); }}>
            Show me
          </button>
        </>
      )}
    </div>
  );
}

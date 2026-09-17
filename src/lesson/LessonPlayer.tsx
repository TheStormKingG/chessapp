import { useMemo, useReducer, useState } from 'react';
import { Board } from '@/board';
import { CoachBubble, CoachService } from '@/coach';
import type { Square } from '@/rules';
import { useSettings } from '@/app/settings';
import { initLesson, reduce, currentChallenge, type Highlights, type LessonState } from './LessonMachine';
import { ChallengeView } from './challenges/ChallengeView';
import type { WrongMove } from './challenges/Sequence';
import { useEngineRefutation } from './useEngineRefutation';
import type { Lesson } from './types';

export interface LessonOutcome {
  lessonId: string;
  stars: 1 | 2 | 3;
  xp: number;
  results: LessonState['results'];
}

/** F-PZ-4, stated where the learner decides, not only in the rules. */
const HINT_COST = 'A move after a hint still earns progress, but no mastery credit.';

export function LessonPlayer({
  lesson,
  onComplete,
  onExit,
  textEntry: forceText,
  hintsAllowed = true,
  title,
}: {
  lesson: Lesson;
  onComplete: (o: LessonOutcome) => void;
  onExit: () => void;
  textEntry?: boolean;
  hintsAllowed?: boolean;
  title?: string;
}) {
  const coachMuted = useSettings((s) => s.coachMuted);
  const settingTextEntry = useSettings((s) => s.textEntry);
  const textEntry = forceText ?? settingTextEntry;
  const coach = useMemo(() => {
    const c = new CoachService();
    c.muted = coachMuted;
    return c;
  }, [coachMuted]);
  const [s, dispatch] = useReducer(reduce, lesson, (l) => initLesson(l, hintsAllowed));
  const [lastWrong, setLastWrong] = useState<WrongMove | null>(null);
  useEngineRefutation(s, lastWrong, dispatch, coach);

  const c = currentChallenge(s);
  const ph = s.phase;
  const hintLabel = s.hintLevel === 0 ? 'Hint' : s.hintLevel === 1 ? 'Second hint' : 'No more hints';
  const busy = ph.kind === 'challenge' && ph.status !== 'attempting' && ph.status !== 'retry';

  return (
    <section className="flex min-h-full flex-col p-4">
      <header className="flex items-center justify-between">
        <button type="button" className="tap" aria-label="Exit lesson" onClick={onExit}>
          ✕
        </button>
        <h1 className="text-sm text-ink-muted">{title ?? `${lesson.id} · ${lesson.title}`}</h1>
        <span className="text-sm text-ink-muted">
          {ph.kind === 'challenge' ? `${ph.index + 1} of ${lesson.challenges.length}` : ''}
        </span>
      </header>

      {ph.kind === 'card' && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">{lesson.title}</h2>
          <p className="mt-3">{lesson.card.idea}</p>
          {lesson.card.habit && (
            <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm">Habit: {lesson.card.habit}</p>
          )}
          {lesson.card.diagrams[0] && (
            <div className="mt-4">
              <Board fen={lesson.card.diagrams[0]} orientation="w" mode="static" />
            </div>
          )}
          <button
            type="button"
            className="tap mt-6 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white"
            onClick={() => dispatch({ type: 'next' })}
          >
            Start
          </button>
        </div>
      )}

      {ph.kind === 'explain' &&
        (() => {
          const e = lesson.explain[ph.index];
          if (!e) return null;
          const highlights: Highlights = {};
          for (const sq of e.highlights ?? []) highlights[sq] = 'accent';
          return (
            <div className="mt-4">
              <Board
                fen={e.fen}
                orientation="w"
                mode="static"
                arrows={(e.arrows ?? []).map(([from, to]: [Square, Square]) => ({ from, to }))}
                highlights={highlights}
              />
              <CoachBubble text={e.text} />
              <button
                type="button"
                className="tap mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white"
                onClick={() => dispatch({ type: 'next' })}
              >
                Next
              </button>
            </div>
          );
        })()}

      {ph.kind === 'challenge' && c && (
        <div className="mt-4">
          <p className="font-semibold">{c.prompt}</p>
          <ChallengeView
            key={c.id}
            c={c}
            highlights={s.highlights}
            refutation={s.refutation}
            busy={busy}
            textEntry={textEntry}
            dispatch={dispatch}
            onWrongMove={setLastWrong}
          />
          <CoachBubble text={s.feedback} tone={s.feedbackTone} />
          <div className="mt-4 flex gap-2">
            {!busy && s.hintsAllowed && (
              <>
                <button
                  type="button"
                  className="tap flex-1 rounded-lg border border-line px-3 py-2 disabled:opacity-60"
                  onClick={() => dispatch({ type: 'hint' })}
                  disabled={s.hintLevel >= 2}
                  title={HINT_COST}
                  aria-describedby="hint-cost"
                >
                  {hintLabel}
                </button>
                {/* The cost is announced, not only hovered (F-AX-1). */}
                <p id="hint-cost" className="sr-only">
                  {HINT_COST}
                </p>
              </>
            )}
            {!busy && (
              <button
                type="button"
                className="tap flex-1 rounded-lg border border-line px-3 py-2"
                onClick={() => dispatch({ type: 'reveal' })}
              >
                Show me
              </button>
            )}
            {busy && (
              <button
                type="button"
                className="tap flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-white"
                onClick={() => dispatch({ type: 'next' })}
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}

      {ph.kind === 'close' && (
        <div className="mt-6 text-center">
          <p className="text-3xl" aria-hidden>
            {'★'.repeat(ph.stars)}
            {'☆'.repeat(3 - ph.stars)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {ph.stars} stars · {s.totalHints} hints · {s.totalMisses} misses
          </p>
          <h2 className="mt-4 text-xl font-semibold">Lesson done</h2>
          <p className="mt-3 rounded-lg bg-accent-soft p-3">{lesson.takeaway}</p>
          <p className="mt-3 text-ink-muted">+{ph.xp} XP</p>
          <button
            type="button"
            className="tap mt-6 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white"
            onClick={() =>
              onComplete({ lessonId: lesson.id, stars: ph.stars, xp: ph.xp, results: s.results })
            }
          >
            Back to the path
          </button>
        </div>
      )}
    </section>
  );
}

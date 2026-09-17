import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Board } from '@/board';
import { CoachBubble, CoachService } from '@/coach';
import type { Square } from '@/rules';
import { useSettings } from '@/app/settings';
import { initLesson, reduce, currentChallenge, type Highlights, type LessonState } from './LessonMachine';
import { ChallengeView } from './challenges/ChallengeView';
import type { WrongMove } from './challenges/Sequence';
import { useEngineRefutation } from './useEngineRefutation';
import type { Lesson } from './types';
import type { LessonResume } from '@/data/resume';

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
  exitLabel = 'Exit lesson',
  closeHeading = 'Lesson done',
  closeAction = 'Back to the path',
  showXp = true,
  resume = null,
  onProgress,
}: {
  lesson: Lesson;
  onComplete: (o: LessonOutcome) => void;
  onExit: () => void;
  textEntry?: boolean;
  hintsAllowed?: boolean;
  title?: string;
  /* The player is reused outside the lesson path (checkpoints, remediation), so
     every string that says "lesson" or assumes the path is the next screen is a
     prop with the lesson wording as its default. */
  exitLabel?: string;
  closeHeading?: string;
  closeAction?: string;
  /** XP is awarded by the caller; a caller that awards none must not claim any. */
  showXp?: boolean;
  /** A place to come back to, loaded by the caller. Null means start at the card. */
  resume?: LessonResume | null;
  /**
   * Called with the current place each time the run reaches a challenge, and with
   * null once the lesson closes. The caller owns persistence: a graded assessment
   * simply does not pass this, and then nothing is saved.
   */
  onProgress?: (r: LessonResume | null) => void;
}) {
  const coachMuted = useSettings((s) => s.coachMuted);
  const settingTextEntry = useSettings((s) => s.textEntry);
  const textEntry = forceText ?? settingTextEntry;
  const coach = useMemo(() => {
    const c = new CoachService();
    c.muted = coachMuted;
    return c;
  }, [coachMuted]);
  const [s, dispatch] = useReducer(reduce, lesson, (l) => seedLesson(l, hintsAllowed, resume));
  const [lastWrong, setLastWrong] = useState<WrongMove | null>(null);
  useEngineRefutation(s, lastWrong, dispatch, coach);

  const c = currentChallenge(s);
  const ph = s.phase;
  // The wrong move belongs to the challenge it was played on. Clearing it here
  // makes that an invariant of the player rather than something the engine
  // refutation hook is left to infer. Adjusted during render, as elsewhere.
  const [prevId, setPrevId] = useState<string | null>(c?.id ?? null);
  if ((c?.id ?? null) !== prevId) {
    setPrevId(c?.id ?? null);
    setLastWrong(null);
  }
  const hintLabel = s.hintLevel === 0 ? 'Hint' : s.hintLevel === 1 ? 'Second hint' : 'No more hints';
  const busy = ph.kind === 'challenge' && ph.status !== 'attempting' && ph.status !== 'retry';

  /* F-AX-1: the control that advanced the run is unmounted with the challenge, so
     focus has to be placed deliberately or it falls to <body> — six to ten times
     a lesson for a keyboard or screen-reader user. The new challenge's prompt
     takes it, and the live region names the transition. */
  const promptRef = useRef<HTMLParagraphElement>(null);
  const challengeId = ph.kind === 'challenge' ? (c?.id ?? null) : null;
  useEffect(() => {
    if (challengeId) promptRef.current?.focus();
  }, [challengeId]);

  /* The place is reported as the run reaches each challenge, and withdrawn at the
     close — so a completed lesson has no record left to resume from. */
  const results = s.results;
  useEffect(() => {
    if (!onProgress) return;
    if (ph.kind === 'challenge' && challengeId) {
      onProgress({
        lessonId: lesson.id,
        challengeId,
        index: ph.index,
        challengeCount: lesson.challenges.length,
        results,
        totalHints: s.totalHints,
        totalMisses: s.totalMisses,
        savedAt: new Date().toISOString(),
      });
    } else if (ph.kind === 'close') {
      onProgress(null);
    }
    // `ph.index` and `ph.kind` are read through the narrowed phase above.
  }, [onProgress, lesson.id, lesson.challenges.length, challengeId, ph, results, s.totalHints, s.totalMisses]);

  const [confirmingExit, setConfirmingExit] = useState(false);
  const midRun = ph.kind === 'challenge' || ph.kind === 'explain';
  const exit = () => {
    if (midRun) setConfirmingExit(true);
    else onExit();
  };

  return (
    /* Concept Note 2 and the desktop wireframe: above `md` the three parts sit
       side by side -- the board on the left, the coach and the lesson on the
       right -- with the board column capped to the viewport height so an 800px
       board can no longer push its own top off-screen. Below `md` this is the
       untouched single phone column, which is why every placement below is a
       `md:` grid coordinate rather than a change of DOM order. */
    <section className="flex min-h-full flex-col p-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-x-6">
      <header className="flex items-center justify-between md:col-span-2">
        <button type="button" className="tap" aria-label={exitLabel} onClick={exit}>
          ✕
        </button>
        <h1 className="text-sm text-ink-muted">{title ?? `${lesson.id} · ${lesson.title}`}</h1>
        {/* The counter is the announcement: giving the text already on screen a
            live region names the transition for a screen reader without adding a
            second, competing statement of where the learner is. */}
        <span role="status" aria-live="polite" aria-label="Challenge progress" className="text-sm text-ink-muted">
          {ph.kind === 'challenge' ? `${ph.index + 1} of ${lesson.challenges.length}` : ''}
        </span>
      </header>

      {confirmingExit && (
        <div className="mt-6 rounded-lg border border-line p-4 md:col-span-2">
          <h2 className="text-lg font-semibold">{`Leave the ${onProgress ? 'lesson' : 'attempt'}?`}</h2>
          <p className="mt-2 text-sm">
            {onProgress
              ? 'Your place is saved. You can pick up where you left off.'
              : 'This attempt will not be saved, and you would start it again from the beginning.'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="tap flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-white"
              onClick={() => {
                setConfirmingExit(false);
              }}
            >
              Keep going
            </button>
            <button
              type="button"
              className="tap flex-1 rounded-lg border border-line px-3 py-2"
              onClick={onExit}
            >
              Leave
            </button>
          </div>
        </div>
      )}

      {!confirmingExit && ph.kind === 'card' && (
        <>
          <div className="mt-6 md:col-start-2 md:row-start-2">
            <h2 className="text-2xl font-semibold">{lesson.title}</h2>
            <p className="mt-3">{lesson.card.idea}</p>
            {lesson.card.habit && (
              <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm">Habit: {lesson.card.habit}</p>
            )}
          </div>
          {lesson.card.diagrams[0] && (
            <div className="mt-4 md:col-start-1 md:row-start-2 md:row-span-2 md:mt-6 md:max-w-[calc(100dvh-9rem)]">
              <Board fen={lesson.card.diagrams[0]} orientation="w" mode="static" />
            </div>
          )}
          <button
            type="button"
            className="tap mt-6 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white md:col-start-2 md:row-start-3"
            onClick={() => dispatch({ type: 'next' })}
          >
            Start
          </button>
        </>
      )}

      {!confirmingExit && ph.kind === 'explain' &&
        (() => {
          const e = lesson.explain[ph.index];
          if (!e) return null;
          const highlights: Highlights = {};
          for (const sq of e.highlights ?? []) highlights[sq] = 'accent';
          return (
            <>
              <div className="mt-4 md:col-start-1 md:row-start-2 md:sticky md:top-4 md:max-w-[calc(100dvh-9rem)]">
                <Board
                  fen={e.fen}
                  orientation="w"
                  mode="static"
                  arrows={(e.arrows ?? []).map(([from, to]: [Square, Square]) => ({ from, to }))}
                  highlights={highlights}
                />
              </div>
              <div className="md:col-start-2 md:row-start-2 md:mt-4">
                <CoachBubble text={e.text} />
                <button
                  type="button"
                  className="tap mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white"
                  onClick={() => dispatch({ type: 'next' })}
                >
                  Next
                </button>
              </div>
            </>
          );
        })()}

      {!confirmingExit && ph.kind === 'challenge' && c && (
        <>
          <p
            id="challenge-prompt"
            className="mt-4 font-semibold md:col-start-2 md:row-start-2"
            tabIndex={-1}
            ref={promptRef}
          >
            {c.prompt}
          </p>
          {/* A retry has to reset the challenge's own answering surface as well as
              the machine, so the key carries the miss count as a retry generation
              (see ChallengeView). The answering surface travels with the board:
              the squares to pick, the options to choose, the drill to play out. */}
          <div className="mt-3 md:col-start-1 md:row-start-2 md:row-span-2 md:mt-4 md:sticky md:top-4 md:max-w-[calc(100dvh-9rem)]">
          <ChallengeView
            key={`${c.id}#${s.results[c.id]?.misses ?? 0}`}
            c={c}
            highlights={s.highlights}
            refutation={s.refutation}
            busy={busy}
            textEntry={textEntry}
            dispatch={dispatch}
            onWrongMove={setLastWrong}
          />
          </div>
          <div className="md:col-start-2 md:row-start-3">
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
        </>
      )}

      {ph.kind === 'close' && (
        <div className="mt-6 text-center md:col-span-2">
          <p className="text-3xl" aria-hidden>
            {'★'.repeat(ph.stars)}
            {'☆'.repeat(3 - ph.stars)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {ph.stars} stars · {s.totalHints} hints · {s.totalMisses} misses
          </p>
          <h2 className="mt-4 text-xl font-semibold">{closeHeading}</h2>
          <p className="mt-3 rounded-lg bg-accent-soft p-3">{lesson.takeaway}</p>
          {showXp && <p className="mt-3 text-ink-muted">+{ph.xp} XP</p>}
          <button
            type="button"
            className="tap mt-6 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white"
            onClick={() =>
              onComplete({ lessonId: lesson.id, stars: ph.stars, xp: ph.xp, results: s.results })
            }
          >
            {closeAction}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Start at the card, unless a saved place still matches this lesson's content.
 * The saved run comes back at the top of the challenge it was interrupted on:
 * the coach's transient state (feedback, arrows, half-typed answers) is not
 * worth reviving, and a fresh attempt at that challenge is what the learner
 * expects on coming back.
 */
function seedLesson(l: Lesson, hintsAllowed: boolean, r: LessonResume | null): LessonState {
  const base = initLesson(l, hintsAllowed);
  if (!r || r.lessonId !== l.id) return base;
  if (r.challengeCount !== l.challenges.length) return base;
  if (!(r.index >= 0 && r.index < l.challenges.length)) return base;
  if (l.challenges[r.index]?.id !== r.challengeId) return base;
  return {
    ...base,
    phase: { kind: 'challenge', index: r.index, status: 'attempting' },
    results: r.results,
    totalHints: r.totalHints,
    totalMisses: r.totalMisses,
  };
}

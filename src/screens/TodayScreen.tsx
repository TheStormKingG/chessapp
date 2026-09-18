import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { btn } from '@/app/Button';
import { Board } from '@/board';
import { localDay, useProgress } from '@/data';
import { loadLesson } from '@/lesson/loader';
import { activeNode } from '@/path/progress';
import { resumeLabel, useLessonResume } from '@/path/resumeLabel';

const COOL_DOWN_KEY = 'chessapp.coolDownDismissed';

/**
 * PREMIUM-DELTA Δ4.4: the position the next lesson opens on, for the card.
 *
 * It is the lesson's OWN first position, not a generic diagram, so the card
 * previews the lesson truthfully -- lesson 1.1.1 is about the empty grid and
 * shows the empty grid. Null while it loads and null for ever on failure: the
 * board is context, so Today must render completely without it rather than
 * hold the one thing the learner came for behind a JSON fetch. A checkpoint
 * has no single opening position and asks for none.
 */
function useNextLessonFen(lessonId: string | null): string | null {
  const [state, setState] = useState<{ id: string | null; fen: string | null }>({ id: lessonId, fen: null });
  // Keyed by lesson, invalidated during render, matching `useLessonResume`:
  // otherwise a lesson change shows the previous lesson's position for a frame.
  if (state.id !== lessonId) setState({ id: lessonId, fen: null });
  useEffect(() => {
    if (!lessonId) return;
    let on = true;
    loadLesson(lessonId)
      .then((l) => {
        if (on) setState({ id: lessonId, fen: l.explain[0]?.fen ?? null });
      })
      .catch(() => {
        /* the card is complete without it */
      });
    return () => {
      on = false;
    };
  }, [lessonId]);
  return state.id === lessonId ? state.fen : null;
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(COOL_DOWN_KEY);
  } catch {
    return null;
  }
}

export function TodayScreen() {
  const progress = useProgress((s) => s.progress);
  const next = activeNode(progress);
  const resume = useLessonResume(next?.kind === 'lesson' ? next.id : null);
  // The card offers what is actually there: a run already under way is resumed,
  // never re-started, and it says how far in the learner had got.
  const resumed = next?.kind === 'lesson' ? resumeLabel(resume, next.id) : null;
  const nextFen = useNextLessonFen(next?.kind === 'lesson' ? next.id : null);
  const today = localDay(new Date());
  const [dismissedOn, setDismissedOn] = useState(readDismissed);
  // F-HM-6: two losses in a row, dismissible, and never more than once a day.
  const coolDown = progress.consecutiveLosses >= 2 && dismissedOn !== today;

  return (
    <section className="p-4">
      {/* PREMIUM-DELTA.md Δ2: one of the two places `display-lg` is spent, and it
          is never allowed to stand alone — the XP count directly beneath it is the
          `--font-index` notation line the role is defined as a pair with. The count
          is stated in the index face, tabular, before anything decorates it. */}
      <h1 className="t-display-lg">Today</h1>
      <p className="t-index mt-1 text-content-dim">{progress.xp} XP so far</p>

      <h2 className="t-caption mt-6 uppercase tracking-wide text-content-dim">On the path</h2>
      {next ? (
        <Link
          to={next.kind === 'lesson' ? `/lesson/${next.id}` : `/checkpoint/${next.unit}`}
          className="tap mt-2 block rounded-xl border border-edge-strong border-b-2 border-b-key-raised bg-surface-raised p-4"
        >
          {/* Δ4.4: the position and the words are one row, so the card grows by
              the board's 120px only where there is room beside the text. The
              board is `aria-hidden` and carries no tab stop, so the whole row
              is still announced as one link named by the lesson title. */}
          <div className="flex items-start gap-4">
            <span className="min-w-0 flex-1">
              <span className="t-caption block text-content-dim">
                {next.kind === 'lesson' ? `Lesson ${next.id}` : `Checkpoint ${next.unit}`}
              </span>
              <span className="t-heading block">{next.title}</span>
              {resumed && <span className="t-label mt-1 block text-content-dim">{resumed.hint}</span>}
            </span>
            {nextFen && (
              <div className="shrink-0">
                <Board
                  fen={nextFen}
                  orientation="w"
                  mode="static"
                  size={120}
                  decorative
                  testId="today-lesson-board"
                />
              </div>
            )}
          </div>
          <span className={`${btn.primary} mt-4 w-full`}>
            {next.kind === 'checkpoint'
              ? 'Open the checkpoint'
              : resumed
                ? 'Resume this lesson'
                : 'Start this lesson'}
          </span>
        </Link>
      ) : (
        <p className="t-body mt-2 rounded-xl border border-edge-strong border-b-2 border-b-key-raised bg-surface-raised p-4">
          You have finished everything that is built so far. More lessons are coming.
        </p>
      )}

      <h2 className="t-caption mt-6 uppercase tracking-wide text-content-dim">Play</h2>
      {coolDown && (
        <div className="t-label mt-2 rounded-xl bg-signal-soft p-3" role="status">
          <p>
            Two losses in a row. A lesson or a few minutes off usually helps more than a rematch.
          </p>
          <button
            type="button"
            className={`${btn.quiet} mt-2 underline`}
            onClick={() => {
              try {
                localStorage.setItem(COOL_DOWN_KEY, today);
              } catch {
                /* private mode: the banner simply returns next render */
              }
              setDismissedOn(today);
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <Link to="/play" className="t-heading tap mt-2 block rounded-xl border border-edge-strong border-b-2 border-b-key-raised bg-surface-raised p-4">
        Play a coached game
      </Link>

      <Link to="/settings" className="tap t-label mt-6 inline-flex items-center text-content-dim underline">
        Settings
      </Link>
    </section>
  );
}

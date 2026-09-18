import { useState } from 'react';
import { Link } from 'react-router';
import { btn } from '@/app/Button';
import { localDay, useProgress } from '@/data';
import { activeNode } from '@/path/progress';
import { resumeLabel, useLessonResume } from '@/path/resumeLabel';

const COOL_DOWN_KEY = 'chessapp.coolDownDismissed';

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
          <span className="t-caption block text-content-dim">
            {next.kind === 'lesson' ? `Lesson ${next.id}` : `Checkpoint ${next.unit}`}
          </span>
          <span className="t-heading block">{next.title}</span>
          {resumed && <span className="t-label mt-1 block text-content-dim">{resumed.hint}</span>}
          <span className={`${btn.primary} mt-3 w-full`}>
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

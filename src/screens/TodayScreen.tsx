import { useState } from 'react';
import { Link } from 'react-router';
import { localDay, useProgress } from '@/data';
import { activeNode } from '@/path/progress';

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
  const today = localDay(new Date());
  const [dismissedOn, setDismissedOn] = useState(readDismissed);
  // F-HM-6: two losses in a row, dismissible, and never more than once a day.
  const coolDown = progress.consecutiveLosses >= 2 && dismissedOn !== today;

  return (
    <section className="p-4">
      <h1 className="text-xl font-semibold">Today</h1>
      <p className="mt-1 text-sm text-ink-muted">{progress.xp} XP so far</p>

      <h2 className="mt-6 text-xs uppercase tracking-wide text-ink-muted">On the path</h2>
      {next ? (
        <Link
          to={next.kind === 'lesson' ? `/lesson/${next.id}` : `/checkpoint/${next.unit}`}
          className="tap mt-2 block rounded-xl border border-line bg-card p-4"
        >
          <span className="block text-xs text-ink-muted">
            {next.kind === 'lesson' ? `Lesson ${next.id}` : `Checkpoint ${next.unit}`}
          </span>
          <span className="block font-medium">{next.title}</span>
        </Link>
      ) : (
        <p className="mt-2 rounded-xl border border-line bg-card p-4">
          You have finished everything that is built so far. More lessons are coming.
        </p>
      )}

      <h2 className="mt-6 text-xs uppercase tracking-wide text-ink-muted">Play</h2>
      {coolDown && (
        <div className="mt-2 rounded-xl bg-review-soft p-3 text-sm" role="status">
          <p>
            Two losses in a row. A lesson or a few minutes off usually helps more than a rematch.
          </p>
          <button
            type="button"
            className="tap mt-2 underline"
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
      <Link to="/play" className="tap mt-2 block rounded-xl border border-line bg-card p-4 font-medium">
        Play a coached game
      </Link>

      <Link to="/settings" className="mt-6 block text-sm text-ink-muted underline">
        Settings
      </Link>
    </section>
  );
}

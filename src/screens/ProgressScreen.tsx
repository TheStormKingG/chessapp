import { Link } from 'react-router';
import { useProgress } from '@/data';
import { SECTIONS } from '@/path/curriculum';

/**
 * What the learner has actually done, read straight off the projection.
 *
 * This screen was a stub reading "Progress arrives in the next release" while
 * being one of the five tabs — the most visible unfinished thing in the app.
 * Nothing new is stored for it: `xp`, `lessons`, `units`, `games`, `reviews`,
 * `puzzleRating` and `puzzlesSolved` are already on `Progress`, so this is a
 * read, not a feature.
 *
 * Two rules the rest of the app already follows and this keeps:
 *
 *  - **Every number is stated in text.** The meters are `aria-hidden`
 *    decoration over a sentence that already says the count, exactly as
 *    PathScreen and Today do it, so nothing here depends on seeing a bar or a
 *    colour (F-AX-2, and it survives forced colours).
 *  - **Nothing is invented to fill the screen.** No streak, no chart, no
 *    "accuracy" derived from numbers that were never recorded for it. A
 *    fabricated metric is worse than a short screen, and a learner who has
 *    done nothing gets an honest empty state pointing at the one action that
 *    starts everything.
 */
export function ProgressScreen() {
  const p = useProgress((s) => s.progress);

  const lessons = Object.values(p.lessons);
  const done = lessons.filter((l) => l.completed).length;
  const stars = lessons.reduce((n, l) => n + (l.completed ? l.stars : 0), 0);
  const totalLessons = SECTIONS.reduce(
    (n, s) => n + s.units.reduce((m, u) => m + u.lessons.length, 0),
    0,
  );
  const unitsPassed = Object.values(p.units).filter((u) => u.passed).length;
  const totalUnits = SECTIONS.reduce((n, s) => n + s.units.length, 0);
  const started = done > 0 || p.games > 0 || p.puzzlesSolved > 0;

  return (
    <section className="p-4 md:mx-auto md:max-w-3xl md:px-6 md:py-8">
      <h1 className="t-display-lg">Progress</h1>
      <p className="t-index mt-1 text-content-dim">{p.xp} XP so far</p>

      {!started ? (
        <p className="t-body n-panel n-lit n-edge mt-6 rounded-card bg-panel p-4">
          Nothing here yet. Finish a lesson and it starts filling in.{' '}
          <Link to="/" className="underline">
            Go to Today
          </Link>
          .
        </p>
      ) : null}

      {/* ── The path ─────────────────────────────────────────────────────── */}
      <h2 className="t-caption mt-6 uppercase tracking-wide text-content-dim">The path</h2>
      <div className="n-panel n-lit n-edge mt-2 rounded-card bg-panel p-4">
        <p className="t-index text-content-dim">
          {done} of {totalLessons} lessons done
        </p>
        {SECTIONS.map((s) => {
          const ids = s.units.flatMap((u) => u.lessons.map((l) => l.id));
          const sectionDone = ids.filter((id) => p.lessons[id]?.completed).length;
          const pct = Math.round((sectionDone / ids.length) * 100);
          return (
            <div key={s.id} className="mt-4 first:mt-3">
              <p className="t-label">
                <span className="t-index text-content-dim">Section {s.id}</span> {s.title}
              </p>
              {/* The sentence above and this one carry the meaning; the bar is
                  decoration over them, which is why it is aria-hidden. */}
              <p className="t-index mt-0.5 text-content-dim">
                {sectionDone} of {ids.length} done
              </p>
              <div
                aria-hidden="true"
                className="n-inset-soft n-lit-sunken mt-2 h-2 w-full rounded-control bg-track"
              >
                <div className="n-lit h-2 rounded-control bg-accent" style={{ width: `${String(pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Everything else, as plain counted rows ───────────────────────── */}
      <h2 className="t-caption mt-6 uppercase tracking-wide text-content-dim">Totals</h2>
      <dl className="n-panel n-lit n-edge mt-2 rounded-card bg-panel">
        {[
          ['Checkpoints passed', `${String(unitsPassed)} of ${String(totalUnits)}`],
          ['Stars earned', String(stars)],
          ['Puzzle rating', p.puzzlesSolved > 0 ? String(p.puzzleRating.rating) : 'Not rated yet'],
          ['Puzzles solved', String(p.puzzlesSolved)],
          ['Games played', String(p.games)],
          ['Games reviewed', String(p.reviews)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-edge px-4 py-3 last:border-b-0"
          >
            <dt className="t-label text-content-dim">{label}</dt>
            <dd className="t-index text-content">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

import { Link } from 'react-router';
import { useProgress } from '@/data';
import { SECTIONS } from '@/path/curriculum';
import { ProfileView, useProfile } from '@/profile';
import { AchievementShowcase, useEngagement } from '@/engagement';

/**
 * What the learner has actually done, read straight off the projection.
 *
 * ── F-SW-1: THE PROFILE IS THE FIRST SCREEN OF THIS TAB ──────────────────────
 *
 * F-SW-1 says the strengths-and-weaknesses profile "is the first screen of the
 * Progress tab" and that "it replaces the six bare skill bars of F-PG-1 with the
 * same six skills plus the detail behind each".
 *
 * There were never six bare skill bars. This screen shipped the path and the
 * totals, so the profile is the first implementation of F-PG-1's six skills rather
 * than a replacement of an existing treatment — and nothing has been deleted to
 * make room for it. The path and the totals answer a different question ("what have
 * I done") from the profile's ("what am I good at"), and both are requirements.
 * They move below it, which is what "first screen" asks for.
 *
 * The profile is a PROJECTION and not a store: `useProfile` reads the reviews, the
 * imported rows and the event log, and re-derives. See src/profile/buildProfile.ts.
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
  const { profile, undateable } = useProfile();
  // F-EN-5: achievements are "displayed in a showcase on the profile", and this
  // screen is the profile.
  const engagement = useEngagement();

  const lessons = Object.values(p.lessons);
  const done = lessons.filter((l) => l.completed).length;
  const stars = lessons.reduce((n, l) => n + (l.completed ? l.stars : 0), 0);
  const totalLessons = SECTIONS.reduce(
    (n, s) => n + s.units.reduce((m, u) => m + u.lessons.length, 0),
    0,
  );
  const unitsPassed = Object.values(p.units).filter((u) => u.passed).length;
  const totalUnits = SECTIONS.reduce((n, s) => n + s.units.length, 0);
  /*
   * `p.reviews` is here because of what the profile made visible: a learner who
   * imported and analysed forty games had `games: 0` — that field counts games
   * PLAYED in the app — so this screen said "Nothing here yet" directly above a
   * profile built on forty of them. Seen in the browser at 390px, not deduced.
   *
   * `reviews` is the right field rather than a second import-aware count: an
   * imported game banks the same `game_reviewed` event an in-app game does
   * (src/import/reviewSource.ts), so one field covers both kinds.
   */
  const started = done > 0 || p.games > 0 || p.reviews > 0 || p.puzzlesSolved > 0;

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

      {/* ── F-SW-1: the profile, first ────────────────────────────────────
          Rendered only once `useProfile` has read Dexie. There is deliberately no
          "Loading…" placeholder: the read is one index-free table scan and resolves
          within a frame on every visit, and the rest of this screen — which comes
          off the in-memory projection and is already painted — would be pushed down
          by a spinner that appeared and vanished. `ProfileView` has its own honest
          empty state for a learner with no analysed games. */}
      {profile !== null && (
        <div className="mt-6">
          <ProfileView profile={profile} undateable={undateable} />
        </div>
      )}

      {/* ── F-EN-5's showcase ────────────────────────────────────────────── */}
      <AchievementShowcase achievements={engagement.achievements} />

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

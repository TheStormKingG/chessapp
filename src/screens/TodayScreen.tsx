import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { btn } from '@/app/Button';
import { Board } from '@/board';
import { localDay, useProgress } from '@/data';
import { loadLesson } from '@/lesson/loader';
import { activeNode, activeUnitProgress, recentlyFinished, upcomingNodes } from '@/path/progress';
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

/**
 * NEUMORPHIC-DELTA.md §7.3: the lesson card is the screen's ONE hero-scale
 * element, and at the two-column width its board is 240px instead of 120px.
 *
 * The size is a number the board is rendered at, not a CSS box it fills, so the
 * breakpoint has to be read rather than declared -- and it is read with the same
 * `matchMedia?.` shape `Board.tsx` uses for reduced motion, so an environment
 * without `matchMedia` (jsdom) falls back to the compact 120px rather than
 * throwing. The query is `xl` exactly as Tailwind defines it, so the board grows
 * on the same edge the grid splits on.
 */
const HERO_WIDTH = '(min-width: 1280px)';

function useHeroBoardSize(): number {
  const wide = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(HERO_WIDTH);
      if (!mq) return () => undefined;
      mq.addEventListener('change', onChange);
      return () => {
        mq.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia?.(HERO_WIDTH).matches ?? false,
    () => false,
  );
  return wide ? 240 : 120;
}

/** A node's line in "Up next": the lesson's own number and title, or the unit's checkpoint. */
function upNextLabel(n: { kind: 'lesson'; id: string; title: string } | { kind: 'checkpoint'; unit: string; title: string }): string {
  return n.kind === 'lesson' ? `${n.id}  ${n.title}` : `${n.unit}  checkpoint`;
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

  const hero = useHeroBoardSize();
  const unit = activeUnitProgress(progress);
  const upNext = upcomingNodes(progress, 2);
  const finished = recentlyFinished(progress, 4);

  return (
    /*
      NEUMORPHIC-DELTA.md §7: cap and rank rather than stretch. Below `xl` this
      is exactly the screen it was -- one column, same order, same spacing, so
      the phone layout is untouched. At `xl` the same children become a 2fr/1fr
      grid on the reference's own 48px gutter.

      `content-between` was here and is now `content-start`, which is the one
      substantive change this screen needed after the desktop pass. The idea was
      that distributing the rows would turn dead space into "the gutter BETWEEN
      two ranked bands rather than a void under everything". Measured on a fresh
      profile at 2000 x 1200, where the middle row -- Recently finished -- has no
      content to hold, it did the opposite: the ink ended at 511px and the
      Settings link was pushed to 1116, leaving a 605px hole, 50% of the window,
      with nothing in it. That is not a gutter. A hole between two elements reads
      as something that failed to load; the same emptiness below the last element
      reads as a page that ended, which is what the reference itself does -- it
      caps its measure and lets the page finish (§7.2).

      `min-h-dvh` STAYS. It is what keeps the container filling the window, which
      is a separate claim from where the ink sits, and `desktop.spec.ts` asserts
      both: the container reaches the foot, AND no band inside it is more than a
      quarter of the window high. Neither assertion implies the other, which is
      how a stretched container full of nothing passed the first one.
    */
    <section className="p-4 xl:grid xl:min-h-dvh xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:content-start xl:items-start xl:gap-x-12 xl:gap-y-10 xl:py-10">
      <div className="xl:col-start-1 xl:row-start-1">
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
            className="tap n-panel n-edge mt-2 block rounded-card bg-panel p-4 xl:rounded-hero xl:p-6 xl:n-raised-lg"
          >
            {/* Δ4.4: the position and the words are one row, so the card grows by
                the board's 120px only where there is room beside the text. The
                board is `aria-hidden` and carries no tab stop, so the whole row
                is still announced as one link named by the lesson title. §7.3:
                at the two-column width the same board is the screen's one
                hero-scale element at 240px. */}
            <div className="flex items-start gap-4 xl:items-center xl:gap-8">
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
                    size={hero}
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
          <p className="t-body n-raised mt-2 rounded-card bg-surface-raised p-4">
            You have finished everything that is built so far. More lessons are coming.
          </p>
        )}
      </div>

      {/*
        The secondary column. `display: contents` below `xl` so the phone sees
        the Play block exactly where it always was, with nothing wrapping it;
        at `xl` the wrapper becomes the second grid column.
      */}
      <div className="contents xl:col-start-2 xl:row-start-1 xl:block">
        {unit && (
          <section aria-label="This unit" className="hidden xl:block">
            <h2 className="t-caption uppercase tracking-wide text-content-dim">This unit</h2>
            {/*
              The count comes first and in words, exactly as PathScreen states
              it: the meter under it is `aria-hidden` decoration, so this line
              is what a screen reader reads and what survives forced colours.
              It is a groove and a fill, one row high -- the coordinate rail
              stays the app's progress language and this does not compete with
              it.
            */}
            <p className="t-index mt-1 text-content-dim">
              {unit.done} of {unit.total} lessons done
            </p>
            <div aria-hidden="true" className="n-inset-soft mt-2 h-2 w-full rounded-control bg-track">
              <div
                className="h-2 rounded-control bg-accent"
                style={{ width: `${String(Math.round((unit.done / unit.total) * 100))}%` }}
              />
            </div>
          </section>
        )}

        {upNext.length > 0 && (
          <section aria-label="Up next" className="mt-8 hidden xl:block">
            <h2 className="t-caption uppercase tracking-wide text-content-dim">Up next</h2>
            {/*
              A reading, not a second set of destinations: the Path tab owns
              navigating the path, and two more links to it here would put three
              routes to the same place on one screen.
            */}
            <ol className="mt-2 rounded-card border border-edge bg-surface-raised">
              {upNext.map((n) => (
                <li
                  key={n.kind === 'lesson' ? n.id : `cp-${n.unit}`}
                  className="t-label border-b border-edge px-3 py-3 last:border-b-0"
                >
                  {upNextLabel(n)}
                </li>
              ))}
            </ol>
          </section>
        )}

        <h2 className="t-caption mt-6 uppercase tracking-wide text-content-dim xl:mt-8">Play</h2>
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
        <Link to="/play" className="t-heading tap n-panel n-edge mt-2 block rounded-card bg-panel p-4">
          Play a coached game
        </Link>
      </div>

      {finished.length > 0 && (
        /*
          §7.3's full-width band. "Recently" is reverse PATH order, not a
          timestamp -- see `recentlyFinished`. Stars are stated as a number in
          words, so the row carries no meaning in colour or in a glyph alone.
        */
        <section aria-label="Recently finished" className="hidden xl:col-span-2 xl:row-start-2 xl:block">
          <h2 className="t-caption uppercase tracking-wide text-content-dim">Recently finished</h2>
          <ul className="mt-2 flex flex-wrap gap-x-8 gap-y-2 rounded-card border border-edge bg-surface-raised px-4 py-3">
            {finished.map((l) => (
              <li key={l.id} className="t-label">
                <span className="t-index text-content-dim">{l.id}</span> {l.title}{' '}
                {/* An explicit space: without it the row is announced as "The rook3 stars". */}
                <span className="t-index text-content-dim">
                  {l.stars} {l.stars === 1 ? 'star' : 'stars'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="xl:col-span-2 xl:row-start-3">
        <Link to="/settings" className="tap t-label mt-6 inline-flex items-center text-content-dim underline xl:mt-0">
          Settings
        </Link>
      </div>
    </section>
  );
}

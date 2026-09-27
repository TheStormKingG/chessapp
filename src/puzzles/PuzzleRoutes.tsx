import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { btn } from '@/app/Button';
import { db, useProgress } from '@/data';
import { estimateSpace } from '@/data/persistence';
import { track } from '@/analytics';
import { DailyPuzzle } from './DailyPuzzle';
import { FixMyMistakes } from './FixMyMistakes';
import { PuzzleStream } from './PuzzleStream';
import { ThemedPractice } from './ThemedPractice';
import { bandFor, loadPack } from './packs';
import { isOutOfSpace, packFailureMessage, type PackFailure } from './packMessages';
import { buildQueue } from './queue';
import { useErrors, useRating } from './routeData';
import { THEMES } from './themes';
import type { AttemptResult, Puzzle, RatingBand, Theme } from './types';

/**
 * Where the four solving routes get their data (design spec §5).
 *
 * The screens themselves take plain props — a pool, a queue, a pack — and that
 * is deliberate: it is what makes every one of them testable without a
 * database. This file is the one place that knows about Dexie, the event log
 * and the network, and each route below is the seam between them.
 *
 * THIS MODULE IS THE LAZY CHUNK. `src/app/routes.tsx` reaches it through
 * `React.lazy`, so every import above is paid for by a learner who opens a
 * puzzle and by nobody else. The puzzles HOME deliberately lives elsewhere
 * (`PuzzlesHomeRoute.tsx`): it is a tab in the shell, so a static import of it
 * would drag this whole file back onto first paint.
 */

/**
 * The daily puzzle's pack is FIXED, and that is the whole of F-PZ-6.
 *
 * It must not be the learner's own band: two learners in different bands would
 * then be handed different puzzles on the same date, and "the same puzzle for
 * everyone today" would be false on exactly the days anyone checked.
 */
const DAILY_BAND: RatingBand = '600-900';

type PackState =
  | { status: 'loading' }
  | { status: 'ready'; pool: Puzzle[] }
  /**
   * The network and the runtime cache both missed — a first-ever offline visit,
   * or a device with no room to keep the pack.
   *
   * F-ER-3 requires the learner be told WHICH pack and HOW MUCH SPACE it needs,
   * so the failure travels with the band and with what `estimate()` said rather
   * than collapsing to a single status: a bare `'unavailable'` cannot produce
   * either fact, which is why the old message stated neither.
   */
  | { status: 'unavailable'; failure: PackFailure };

function usePack(band: RatingBand): PackState & { retry: () => void } {
  /**
   * The band is carried WITH the state, and a mismatch reads as loading.
   *
   * The obvious alternative — setting `loading` at the top of the effect — is
   * a synchronous setState inside an effect, which cascades a render and which
   * the lint rule rejects for exactly that reason. Comparing instead means a
   * band change reports loading on the very render it changes on, rather than
   * one render later showing the previous band's pool.
   */
  const [held, setState] = useState<{ band: RatingBand; state: PackState }>(() => ({
    band,
    state: { status: 'loading' },
  }));
  /**
   * F-ER-3's retry. Bumping this re-runs the effect below, which owns the `on`
   * flag — so the dead attempt is neutralised by its own cleanup before the new
   * one starts, rather than by a second code path that would have to repeat it.
   */
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState((h) => ({ band: h.band, state: { status: 'loading' } }));
    setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    let on = true;
    loadPack(band)
      .then((pool) => {
        if (!on) return;
        setState({ band, state: { status: 'ready', pool } });
        // Derived data: which bands this learner has. Losing it costs a round
        // trip, never progress, so a failure to record it is not a failure.
        void db.puzzles
          .put({ band, fetchedAt: new Date().toISOString(), count: pool.length })
          .catch(() => undefined);
      })
      .catch(() => {
        /*
         * F-ER-3 names two causes with two different remedies, and `fetch` does
         * not tell them apart: a failure caused by a full disk and one caused by
         * no network both reject with the same `TypeError`. So the cause is not
         * inferred from the rejection — the space question is asked separately,
         * and a device that genuinely has no room for this pack gets the
         * out-of-space sentence instead of being sent to look for wifi.
         *
         * `estimateSpace` never rejects (see data/persistence.ts), so this
         * cannot turn a pack failure into an unhandled one.
         */
        void estimateSpace().then((space) => {
          if (!on) return;
          const failure: PackFailure = isOutOfSpace(band, space.freeBytes)
            ? { kind: 'out-of-space', band, freeBytes: space.freeBytes }
            : { kind: 'unavailable', band };
          setState({ band, state: { status: 'unavailable', failure } });
        });
      });
    return () => {
      on = false;
    };
    // `attempt` is read by nothing in this body: it is here so `retry` re-runs
    // the effect. Removing it makes the retry control a silent no-op.
  }, [band, attempt]);
  return { ...(held.band === band ? held.state : { status: 'loading' }), retry };
}

/**
 * Every puzzle id this learner has already attempted.
 *
 * Read from the log rather than projected into `Progress`, because it is a set
 * that grows without bound and only these routes ever want it. The `ready`
 * flag is load-bearing: `PuzzleStream` reads `seen` once, at mount, so
 * rendering it before the log has been read would hand it an empty set and
 * re-serve puzzles the learner has already done.
 */
function useSeen(): { seen: ReadonlySet<string>; ready: boolean } {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    db.events
      .toArray()
      .then((events) => {
        if (!on) return;
        setSeen(
          new Set(
            events.flatMap((e) => (e.payload.type === 'puzzle_attempted' ? [e.payload.puzzleId] : [])),
          ),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        // Ready on BOTH paths. A database that cannot be read must not leave
        // the route loading for ever; an empty `seen` is a worse stream, not a
        // broken one.
        if (on) setReady(true);
      });
    return () => {
      on = false;
    };
  }, []);
  return { seen, ready };
}

/** One banked attempt, written to the log exactly as every other screen writes one. */
function useBankAttempt(): (r: AttemptResult, puzzle: Puzzle) => void {
  const append = useProgress((s) => s.append);
  return useCallback(
    (r: AttemptResult, puzzle: Puzzle) => {
      void append({
        type: 'puzzle_attempted',
        puzzleId: r.puzzleId,
        themes: puzzle.themes,
        puzzleRating: puzzle.rating,
        solved: r.solved,
        hinted: r.hinted,
        misses: r.misses,
        source: r.source,
        ms: r.ms,
      });
      track('puzzle_attempted', { source: r.source, solved: r.solved, hinted: r.hinted });
    },
    [append],
  );
}

/** The chrome the loading and unavailable states share, each with its own way out. */
function Interstitial({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  const nav = useNavigate();
  return (
    <section className="p-4">
      <h1 className="t-display">{title}</h1>
      {/*
        `role="alert"` only when this is a failure. The loading copy is not an
        alert and announcing it would interrupt a screen reader for "Loading…".
      */}
      <p className="t-body mt-3" role={onRetry ? 'alert' : undefined}>
        {body}
      </p>
      {onRetry && (
        <button type="button" className={`${btn.primary} mt-6 w-full md:max-w-sm`} onClick={onRetry}>
          Try again
        </button>
      )}
      <button
        type="button"
        className={`${onRetry ? btn.quiet : btn.primary} mt-3 w-full md:max-w-sm`}
        onClick={() => {
          void nav('/puzzles');
        }}
      >
        Back to puzzles
      </button>
    </section>
  );
}


export function RatedRoute() {
  const nav = useNavigate();
  const rating = useRating();
  const pack = usePack(bandFor(rating.rating));
  const { seen, ready } = useSeen();
  const bank = useBankAttempt();
  const pool = pack.status === 'ready' ? pack.pool : null;

  const byId = useMemo(() => new Map((pool ?? []).map((p) => [p.id, p])), [pool]);

  if (pack.status === 'unavailable')
    return <Interstitial title="Puzzles" body={packFailureMessage(pack.failure).text} onRetry={pack.retry} />;
  if (!pool || !ready) return <Interstitial title="Puzzles" body="Loading…" />;

  return (
    <PuzzleStream
      pool={pool}
      rating={rating}
      seen={seen}
      onAttempt={(r) => {
        const puzzle = byId.get(r.puzzleId);
        if (puzzle) bank(r, puzzle);
      }}
      onExit={() => {
        void nav('/puzzles');
      }}
    />
  );
}

export function ThemedRoute() {
  const nav = useNavigate();
  const rating = useRating();
  const pack = usePack(bandFor(rating.rating));
  const bank = useBankAttempt();
  const [params] = useSearchParams();

  /**
   * F-PZ-2 d: a lesson links here carrying its motif. The value is a string
   * out of a URL until this line has checked it against `THEMES` — an
   * unchecked one would select a theme no pack carries and offer practice with
   * nothing in it.
   */
  const initialThemes = useMemo(
    () => params.getAll('theme').filter((t): t is Theme => (THEMES as readonly string[]).includes(t)),
    [params],
  );

  const pool = pack.status === 'ready' ? pack.pool : null;
  const byId = useMemo(() => new Map((pool ?? []).map((p) => [p.id, p])), [pool]);

  if (pack.status === 'unavailable')
    return (
      <Interstitial title="Themed practice" body={packFailureMessage(pack.failure).text} onRetry={pack.retry} />
    );
  if (!pool) return <Interstitial title="Themed practice" body="Loading…" />;

  return (
    <>
      <button
        type="button"
        className="tap icon-control m-4"
        aria-label="Close themed practice"
        onClick={() => {
          void nav('/puzzles');
        }}
      >
        ✕
      </button>
      <ThemedPractice
        pool={pool}
        initialThemes={initialThemes}
        onAttempt={(r) => {
          const puzzle = byId.get(r.puzzleId);
          if (puzzle) bank(r, puzzle);
        }}
      />
    </>
  );
}

export function DailyRoute() {
  const nav = useNavigate();
  // Deliberately NOT the learner's band: see DAILY_BAND.
  const pack = usePack(DAILY_BAND);
  const bank = useBankAttempt();
  const [solvedDays, setSolvedDays] = useState<string[] | null>(null);

  useEffect(() => {
    let on = true;
    db.events
      .toArray()
      .then((events) => {
        if (!on) return;
        // `deviceDay` IS `localDateKey` — `daily.ts` re-exports `localDay`
        // rather than reimplementing it, so the day a puzzle was solved on and
        // the day the calendar marks are the same string by construction.
        setSolvedDays(
          events.flatMap((e) =>
            e.payload.type === 'puzzle_attempted' && e.payload.source === 'daily' && e.payload.solved
              ? [e.deviceDay]
              : [],
          ),
        );
      })
      .catch(() => {
        if (on) setSolvedDays([]);
      });
    return () => {
      on = false;
    };
  }, []);

  const pool = pack.status === 'ready' ? pack.pool : null;
  const byId = useMemo(() => new Map((pool ?? []).map((p) => [p.id, p])), [pool]);

  if (pack.status === 'unavailable')
    return <Interstitial title="Daily puzzle" body={packFailureMessage(pack.failure).text} onRetry={pack.retry} />;
  if (!pool || solvedDays === null) return <Interstitial title="Daily puzzle" body="Loading…" />;

  return (
    <>
      <button
        type="button"
        className="tap icon-control m-4"
        aria-label="Close daily puzzle"
        onClick={() => {
          void nav('/puzzles');
        }}
      >
        ✕
      </button>
      <DailyPuzzle
        pack={pool}
        solvedDays={solvedDays}
        onAttempt={(r) => {
          const puzzle = byId.get(r.puzzleId);
          if (puzzle) bank(r, puzzle);
        }}
      />
    </>
  );
}

export function FixRoute() {
  const nav = useNavigate();
  const rating = useRating();
  const pack = usePack(bandFor(rating.rating));
  const { seen, ready } = useSeen();
  const bank = useBankAttempt();
  const errors = useErrors();

  // Memoised because it is a NEW array on a cache miss, and `buildQueue` below
  // takes it as a dependency: a fresh `[]` every render would rebuild the
  // queue every render and hand `FixMyMistakes` a new drill list each time.
  const pool = useMemo(() => (pack.status === 'ready' ? pack.pool : []), [pack]);

  const queue = useMemo(
    () => (errors === null ? null : buildQueue({ errors, pool, rating, seen })),
    [errors, pool, rating, seen],
  );

  const byId = useMemo(
    () => new Map(queue?.fix.map((d) => [d.puzzle.id, d.puzzle]) ?? []),
    [queue],
  );

  // A missing pack is NOT fatal here, and that is the point of F-PZ-3: the
  // learner's own positions are drills in their own right, so the queue is
  // still worth something with an empty pool. Only the "similar" pack puzzles
  // are lost.
  if (!queue || !ready || pack.status === 'loading')
    return <Interstitial title="Fix my mistakes" body="Loading…" />;

  return (
    <>
      <button
        type="button"
        className="tap icon-control m-4"
        aria-label="Close fix my mistakes"
        onClick={() => {
          void nav('/puzzles');
        }}
      >
        ✕
      </button>
      <FixMyMistakes
        queue={queue}
        onAttempt={(r) => {
          const puzzle = byId.get(r.puzzleId);
          if (puzzle) bank(r, puzzle);
        }}
      />
    </>
  );
}

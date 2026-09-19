import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db, useProgress } from '@/data';
import type { Progress } from '@/data/reduce';
import { getEngine } from '@/engine';
import { CoachService } from '@/coach';
import { btn } from '@/app/Button';
import { reportError } from '@/analytics';
import { bandForUnit } from './bands';
import { drillFrom } from './fixIt';
import { positionsOf, sourceFromEvents } from './gameSource';
import { loadBook, lookupOpening } from './openingBook';
import { askForBetter, explainMoment } from './explain';
import { bankReview, deepenMoments, reviewFor } from './useReview';
import { THEME_LESSON, classify } from './errorLog';
import { Summary } from './Summary';
import { KeyMomentView } from './KeyMomentView';
import { FixItDrill } from './FixItDrill';
import { AnalysisService } from './AnalysisService';
import type { Review } from './types';

type Stage = 'loading' | 'analysing' | 'summary' | 'moment' | 'drill' | 'missing' | 'failed';

/** PRD F-RV-1: key moments are re-analysed deeper, after the summary is up. */
const DEEPER_DEPTH = 16;

export function ReviewScreen() {
  const { gameId = '' } = useParams();
  const nav = useNavigate();
  const append = useProgress((s) => s.append);

  const [stage, setStage] = useState<Stage>('loading');
  const [review, setReview] = useState<Review | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [at, setAt] = useState(0);
  const banked = useRef(false);
  const coach = useMemo(() => new CoachService(), []);
  const service = useRef<AnalysisService | null>(null);

  /*
   * DEVIATION from the plan's draft, which had `progress` in this effect's
   * dependency list and read it inside. Banking the review appends an event,
   * which replaces `progress`, which would re-run this effect and restart the
   * whole analysis — dropping the learner out of the drill and back onto a
   * progress bar. The band only has to be right at the moment the review is
   * built, so it is read once, off the store, rather than subscribed to.
   */
  useEffect(() => {
    let live = true;
    (async () => {
      const events = await db.events.toArray();
      const source = sourceFromEvents(events, gameId);
      if (!source) {
        if (live) setStage('missing');
        return;
      }
      if (!live) return;
      setTotal(source.sans.length + 1);
      setStage('analysing');

      // The book is a nicety: no connection and no cache costs the opening
      // name, not the review. F-RV-10.
      let book = null;
      try {
        const b = await loadBook();
        const { ucis } = positionsOf(source.sans);
        const r = lookupOpening(b, ucis);
        book = { name: r.name, leftBookAtPly: r.leftBookAtPly, bookPlies: r.bookPlies };
      } catch (e) {
        reportError(e, { where: 'review:openingBook' });
      }

      try {
        const band = bandForUnit(furthestUnit(useProgress.getState().progress));
        const engine = getEngine();
        const svc = new AnalysisService(engine, {
          onProgress: (d, t) => {
            if (!live) return;
            setDone(d);
            setTotal(t);
          },
        });
        service.current = svc;
        const { review: built } = await reviewFor({
          source,
          table: db.reviews,
          engine,
          band,
          book,
          service: svc,
        });
        if (!live) return;
        setReview(built);
        setStage('summary');

        // Deeper pass, off the 60-second budget, while the summary is read.
        const deeper = await deepenMoments(built, engine, DEEPER_DEPTH, band);
        if (!live) return;
        setReview(deeper);
        await db.reviews.put(deeper);
      } catch (e) {
        reportError(e, { where: 'review:analyse' });
        if (live) setStage('failed');
      }
    })();
    return () => {
      live = false;
      // Leaving mid-analysis stops the pass rather than letting it run on
      // against a screen nobody is looking at (F-RV-1, design spec §1.5).
      service.current?.cancel();
    };
  }, [gameId]);

  const bank = useCallback(
    async (drillCompleted: boolean) => {
      if (banked.current || !review) return;
      const payload = bankReview(review, drillCompleted);
      if (!payload) return;
      banked.current = true;
      await append(payload);
    },
    [append, review],
  );

  if (stage === 'missing') {
    return (
      <Shellish>
        <p className="t-body">We could not find that game to review.</p>
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={() => { nav('/play'); }}>
          Back to play
        </button>
      </Shellish>
    );
  }

  if (stage === 'failed') {
    return (
      <Shellish>
        <p className="t-body">The engine could not finish this review. Your game is safe — try again later.</p>
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={() => { nav('/play'); }}>
          Close
        </button>
      </Shellish>
    );
  }

  if (stage === 'loading' || stage === 'analysing' || !review) {
    return (
      <Shellish>
        <h1 className="t-display">Reviewing your game</h1>
        <div
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-label="Analysis progress"
          className="n-inset-soft mt-4 h-2 w-full overflow-hidden rounded-full bg-track"
        >
          <div className="h-2 rounded-full bg-accent" style={{ width: `${String(total ? (done / total) * 100 : 0)}%` }} />
        </div>
        <p aria-live="polite" className="t-caption mt-2 text-content-dim">
          Move {String(done)} of {String(total)}
        </p>
        <button type="button" className={`${btn.quiet} mt-4 w-full`} onClick={() => { nav('/play'); }}>
          Close
        </button>
      </Shellish>
    );
  }

  if (stage === 'summary') {
    return (
      <>
        <Summary review={review} onStart={() => { setAt(0); setStage('moment'); }} />
        <div className="mx-auto w-full max-w-xl px-4 pb-4">
          <button type="button" className={`${btn.quiet} w-full`} onClick={() => { nav('/play'); }}>
            Close
          </button>
        </div>
      </>
    );
  }

  if (stage === 'moment') {
    const moment = review.keyMoments[at];
    const move = moment ? review.moves[moment.ply] : undefined;
    if (!moment || !move) {
      // Nothing left to show: treat it as the end of the run.
      return (
        <Shellish>
          <p className="t-body">That is the whole review.</p>
          <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={() => { nav('/path'); }}>
            Back to the path
          </button>
        </Shellish>
      );
    }
    /* `classify` returns the theme AND the piece the theme is about, from the
       same tagger calls that decided it. `reviewHungPiece` and
       `reviewMissedCapture` both need {pieceName} and {square}; without them
       CoachService throws, explain.ts returns null, and the two commonest
       themes render with no explanation at all. F-CO-4 is not weakened by
       this: the facts are the tagger's own findings, and when `classify`
       cannot name a piece it omits the fact and the moment stays silent. */
    const { theme, hung, free } = classify({
      fenBefore: move.fenBefore, fenAfter: move.fenAfter, playedUci: move.uci, bestUci: move.best.uci,
    });
    const lessonId = moment.lessonId ?? THEME_LESSON[theme];
    const explanation =
      moment.explanation ?? explainMoment(coach, { move, theme, lessonTitle: null, hung, free });
    return (
      <KeyMomentView
        /* F-RV-4 is "retry before reveal" on EVERY moment. `KeyMomentView`
           holds `revealed` and `tries` itself, so without a key React reuses
           one instance across the run and every moment after the first opens
           with the answer already showing, having asked nothing. The ply is
           unique across the list by construction: `selectKeyMoments` collects
           into a `Map` keyed on ply, and `deepenMoments` rebuilds the list
           one-for-one, so it cannot collide. */
        key={moment.ply}
        move={move}
        moment={{ ...moment, explanation, lessonId }}
        learner={review.learner}
        ask={askForBetter(coach, move)}
        index={at}
        total={review.keyMoments.length}
        onLesson={(id) => { nav(`/lesson/${id}`); }}
        onNext={() => {
          void (async () => {
            if (at + 1 < review.keyMoments.length) {
              setAt(at + 1);
              return;
            }
            if (drillFrom(review.errors)) {
              setStage('drill');
              return;
            }
            // No drill: this is the end of the review, so bank BEFORE leaving.
            await bank(false);
            nav('/path');
          })();
        }}
      />
    );
  }

  const drill = drillFrom(review.errors);
  if (!drill) {
    // Unreachable via the moment screen, which only enters 'drill' when one
    // exists — but the review must not become a blank screen if it ever is.
    return (
      <Shellish>
        <p className="t-body">That is the whole review.</p>
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={() => { nav('/path'); }}>
          Back to the path
        </button>
      </Shellish>
    );
  }
  return (
    <FixItDrill
      drill={drill}
      onLesson={(id) => { nav(`/lesson/${id}`); }}
      onBanked={() => { void bank(true); }}
      onDone={() => { nav('/path'); }}
    />
  );
}

function Shellish({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-xl p-4">{children}</div>;
}

/** The furthest unit the learner has passed, for the Appendix C band. */
function furthestUnit(p: Progress): string {
  const passed = Object.entries(p.units).filter(([, u]) => u.passed).map(([id]) => id);
  return passed.sort().at(-1) ?? '1.1';
}

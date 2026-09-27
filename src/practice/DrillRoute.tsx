import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { btn } from '@/app/Button';
import { loadLesson } from '@/lesson/loader';
import { PlayItOut } from '@/lesson/challenges/PlayItOut';
import type { PlayItOut as PlayItOutChallenge } from '@/lesson/challenges/goal';
import { GOAL_LABEL, drillKey, findDrill, parLabel, type Drill } from './drills';
import { usePractice } from './results';

/**
 * One drill, played out.
 *
 * ── THE RUNNER IS src/lesson/challenges/PlayItOut.tsx, UNCHANGED ─────────────
 *
 * It already plays a `play_it_out` position out against the engine, already owns
 * the `EngineGate` download, already decides the outcome through `goal.ts`, and
 * already resets itself when handed a new challenge. This route's whole job is to
 * fetch the lesson the drill lives in, hand `PlayItOut` the challenge, and turn
 * its `onResult(met)` into a star rating. There is no second drill runner and no
 * second definition of what meeting a goal means.
 *
 * ── WHY hints AND misses ARE COUNTED HERE ───────────────────────────────────
 *
 * `stars()` takes exactly those two numbers, and `PlayItOut` reports neither: its
 * callback is `(met: boolean)`. Rather than widen a signature the lesson pipeline
 * also calls — `ChallengeView`, `LessonMachine` and five other challenge types go
 * through it — the retry loop lives here. A failed run increments `misses` and
 * remounts the challenge; asking for the hint increments `hints`. That is the same
 * accounting a lesson does, so the same drill scores the same from either screen.
 *
 * The remount is keyed on the attempt number, which is what makes `PlayItOut`
 * restart the position: it resets when `props.c` changes identity, so a retry
 * hands it a fresh object rather than relying on internal state it does not expose.
 */
export function DrillRoute() {
  const { lessonId, challengeId } = useParams();
  const drill = findDrill(lessonId, challengeId);
  if (drill === null) return <Missing />;
  return <Runner drill={drill} />;
}

function Missing() {
  return (
    <section className="p-4">
      <h1 className="t-display">Drill not found</h1>
      <p className="t-body mt-2 text-content-dim">
        That drill is not in the catalogue. It may have been renamed.
      </p>
      <Link to="/practice/drills" className={`${btn.primary} mt-6 inline-block`}>
        Back to drills
      </Link>
    </section>
  );
}

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; challenge: PlayItOutChallenge };

function Runner({ drill }: { drill: Drill }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hints, setHints] = useState(0);
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);
  const record = usePractice((s) => s.record);

  useEffect(() => {
    let live = true;
    loadLesson(drill.lessonId)
      .then((lesson) => {
        if (!live) return;
        const challenge = lesson.challenges.find((c) => c.id === drill.challengeId);
        if (challenge?.type !== 'play_it_out') {
          // The index names a challenge this lesson does not have. drills.test.ts
          // makes that a suite failure, so reaching it means content moved under
          // a build that shipped — an honest message, never a blank board.
          setLoad({ state: 'failed' });
          return;
        }
        setLoad({ state: 'ready', challenge });
      })
      .catch(() => {
        if (live) setLoad({ state: 'failed' });
      });
    return () => {
      live = false;
    };
  }, [drill.lessonId, drill.challengeId]);

  const onResult = useCallback(
    (met: boolean) => {
      // `hints` and `misses` are read at the moment the run ends. `misses` counts
      // the runs BEFORE this one, which is what `stars()` means by a miss: this
      // run either met the goal or is itself the miss being counted next time.
      setMisses((m) => (met ? m : m + 1));
      setOutcome(met ? 'won' : 'lost');
      record(drillKey(drill), { met, hints, misses });
    },
    [drill, hints, misses, record],
  );

  if (load.state === 'loading') {
    return (
      <section className="p-4">
        <p className="t-body">Loading…</p>
      </section>
    );
  }
  if (load.state === 'failed') {
    return (
      <section className="p-4">
        <h1 className="t-display">{drill.title}</h1>
        <p className="t-body mt-2 text-content-dim">This drill could not be loaded. Try again when you are online.</p>
        <Link to="/practice/drills" className={`${btn.primary} mt-6 inline-block`}>
          Back to drills
        </Link>
      </section>
    );
  }

  const challenge = load.challenge;
  const showHint = challenge.hints !== undefined && hints === 0 && outcome === null;

  /*
   * A drill's hint is a FIRST-MOVE hint, and the control says so.
   *
   * In content, `hints.piece` and `hints.square` are the from- and to-squares of
   * the move that starts the solution — d1 and d3 for the king-and-queen mate,
   * which is Qd1–d3. 23 of the 28 drills carry `piece` and 19 carry `square`;
   * only 9 carry `text`.
   *
   * That makes them true of the STARTING position and of no other. A learner who
   * asks for help on move six and is shown a ring on the square their queen left
   * five moves ago is being told something that is no longer about the board in
   * front of them — seen in the browser, on exactly that drill. The route cannot
   * tell whether a move has been made (`PlayItOut` owns the move count and its
   * callback reports only the outcome), so rather than guess, the control names
   * what it is about: the opening move, whenever it is asked for.
   */
  const hintSquares: Record<string, 'accent' | 'review'> = {};
  if (hints > 0 && challenge.hints?.piece) hintSquares[challenge.hints.piece] = 'accent';
  if (hints > 0 && challenge.hints?.square) hintSquares[challenge.hints.square] = 'review';

  return (
    <section className="p-4">
      <h1 className="t-title">{drill.title}</h1>
      <p className="t-body mt-1 text-content-dim" data-testid="drill-goal">
        {GOAL_LABEL[drill.goal]} · {parLabel(drill)}
      </p>
      <p className="t-body mt-3" data-testid="drill-prompt">
        {challenge.prompt}
      </p>

      <div className="mt-3">
        <PlayItOut
          /*
           * `key={attempt}` remounts the runner on a retry, which is what restarts
           * the position.
           *
           * `c` is the challenge object straight out of `load` — NOT a fresh
           * `{ ...challenge }` spread. `PlayItOut` resets its position, its move
           * count and its settled flag whenever `props.c` changes IDENTITY, so a
           * new object on every render restarts the drill on every render. Found
           * by playing a drill in the browser: taking a hint, or the drill
           * settling, put the board back to the starting position with "Moves
           * used: 0 of 14" — the identity changed, so the runner did exactly what
           * it documents. The reset seam is real and useful; it just must be
           * driven by the retry and by nothing else.
           */
          key={attempt}
          c={challenge}
          onResult={onResult}
          disabled={outcome !== null}
          highlights={hintSquares}
        />
      </div>

      {showHint && (
        <button
          type="button"
          className={`${btn.quiet} mt-3`}
          onClick={() => {
            setHints((h) => h + 1);
          }}
        >
          Show me the first move
        </button>
      )}
      {hints > 0 && (
        <p className="t-body mt-3" data-testid="drill-hint">
          {challenge.hints?.text ?? 'The marked squares are the move this position starts with.'}
        </p>
      )}

      {outcome !== null && (
        <div aria-live="polite" className="mt-4">
          <p className="t-title" data-testid="drill-outcome">
            {outcome === 'won' ? 'Goal reached.' : 'Not this time.'}
          </p>
          {outcome === 'lost' && challenge.reason && (
            <p className="t-body mt-2 text-content-dim" data-testid="drill-reason">
              {challenge.reason}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                setOutcome(null);
                setAttempt((a) => a + 1);
              }}
            >
              {outcome === 'won' ? 'Play it again' : 'Try again'}
            </button>
            <Link to="/practice/drills" className={btn.secondary}>
              Back to drills
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

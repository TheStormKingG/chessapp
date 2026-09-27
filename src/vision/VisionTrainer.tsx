import { useCallback, useEffect, useRef, useState } from 'react';
import { Board } from '@/board';
import { btn } from '@/app/Button';
import type { Square } from '@/rules';
import { MAX_COUNT_ANSWER } from './questions';
import { answer, isOver, remainingSeconds, startSession, type VisionSession } from './session';
import { useVision } from './bests';
import { MODE_BRIEF, MODE_TITLE, VISION_MODES, type Orientation, type VisionMode } from './types';

/**
 * The vision trainer (PRD §8.7, F-PR-2).
 *
 * Three screens in one route, because they are three states of one activity and
 * a learner who finishes a round wants to go again:
 *
 *   setup  → pick a mode and an orientation
 *   round  → 30 seconds of questions
 *   result → the score, whether it beat the best, and "go again"
 *
 * ── THE CLOCK IS READ HERE AND NOWHERE ELSE ─────────────────────────────────
 *
 * `session.ts` takes `now` as an argument in every function. This component is
 * the only thing in the feature that calls `Date.now()`, and all it does with
 * the reading is pass it in. That is what makes the 30-second timer testable
 * without waiting 30 seconds (session.test.ts) and it is why the tick below can
 * be a plain interval rather than anything the logic depends on.
 *
 * The tick only drives the DISPLAYED countdown. Whether the round is over is
 * recomputed from the clock at every render and at every answer, so a throttled
 * or suspended interval — a backgrounded tab, a hidden window — cannot leave a
 * round running past its time or bank an answer after it.
 */

/** How often the countdown redraws. Four times a second: smooth, and cheap. */
const TICK_MS = 250;

type Phase = { kind: 'setup' } | { kind: 'round'; session: VisionSession } | { kind: 'result'; session: VisionSession };

export function VisionTrainer() {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const orientation = useVision((s) => s.orientation);
  const bests = useVision((s) => s.bests);
  const record = useVision((s) => s.record);
  const [beatBest, setBeatBest] = useState(false);

  const begin = useCallback((mode: VisionMode) => {
    setBeatBest(false);
    // The seed is the clock, so two rounds are not the same round. It is the only
    // place a real reading enters the question stream, and a test that wants a
    // known round calls `startSession` with a seed of its own.
    setPhase({ kind: 'round', session: startSession(mode, Date.now() % 1_000_000, Date.now()) });
  }, []);

  /** Ends the round once, banking the score against the best. */
  const finish = useCallback(
    (session: VisionSession) => {
      setBeatBest(record(session.mode, session.score));
      setPhase({ kind: 'result', session });
    },
    [record],
  );

  if (phase.kind === 'setup') return <Setup bests={bests} orientation={orientation} onStart={begin} />;
  if (phase.kind === 'result') {
    return (
      <Result
        session={phase.session}
        best={bests[phase.session.mode]}
        beatBest={beatBest}
        onAgain={() => {
          begin(phase.session.mode);
        }}
        onBack={() => {
          setPhase({ kind: 'setup' });
        }}
      />
    );
  }
  return (
    <Round
      session={phase.session}
      orientation={orientation}
      onSession={(session) => {
        setPhase({ kind: 'round', session });
      }}
      onFinish={finish}
    />
  );
}

function Setup({
  bests,
  orientation,
  onStart,
}: {
  bests: Record<VisionMode, number>;
  orientation: Orientation;
  onStart: (m: VisionMode) => void;
}) {
  const setOrientation = useVision((s) => s.setOrientation);
  return (
    <section className="p-4">
      <h1 className="t-display">Vision trainer</h1>
      <p className="t-body mt-2 text-content-dim">
        Thirty seconds a round. Answer as many as you can.
      </p>

      <fieldset className="mt-6">
        <legend className="t-label font-semibold text-content-dim">Board orientation</legend>
        <div className="mt-2 flex gap-2">
          {(['w', 'b'] as Orientation[]).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={orientation === side}
              className={`${orientation === side ? btn.primary : btn.secondary} flex-1`}
              onClick={() => {
                setOrientation(side);
              }}
            >
              {side === 'w' ? 'White at the bottom' : 'Black at the bottom'}
            </button>
          ))}
        </div>
      </fieldset>

      <ul className="mt-6 flex flex-col gap-3">
        {VISION_MODES.map((mode) => (
          <li key={mode}>
            <button
              type="button"
              className="tap n-panel n-lit n-edge block w-full rounded-card bg-panel p-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => {
                onStart(mode);
              }}
            >
              <span className="t-title block">{MODE_TITLE[mode]}</span>
              <span className="t-body mt-1 block text-content-dim">{MODE_BRIEF[mode]}</span>
              <span className="t-label mt-2 block text-content-dim" data-testid={`best-${mode}`}>
                {bests[mode] > 0 ? `Your best: ${String(bests[mode])}` : 'Not played yet'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Round({
  session,
  orientation,
  onSession,
  onFinish,
}: {
  session: VisionSession;
  orientation: Orientation;
  onSession: (s: VisionSession) => void;
  onFinish: (s: VisionSession) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  // `onFinish` must fire exactly once per round. Without the guard the effect
  // below would call it again on every tick after time is up.
  const finished = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!finished.current && isOver(session, now)) {
      finished.current = true;
      onFinish(session);
    }
  }, [session, now, onFinish]);

  const seconds = remainingSeconds(session, now);
  const q = session.current;
  const verdict = session.last;

  const give = (given: Parameters<typeof answer>[1]): void => {
    const next = answer(session, given, Date.now());
    if (next !== session) onSession(next);
  };

  return (
    <section className="p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="t-title">{MODE_TITLE[session.mode]}</h1>
        <p className="t-body text-content-dim">
          {/* The countdown is a live region so it is not silent to a screen
              reader, but `polite` and seconds-granular so it does not interrupt
              the prompt on every tick. */}
          <span aria-live="polite" aria-atomic="true" data-testid="clock">
            {seconds}s
          </span>
          {' · '}
          <span data-testid="score">
            {session.score}/{session.asked}
          </span>
        </p>
      </header>

      <p className="t-title mt-3" data-testid="prompt">
        {q.prompt}
      </p>

      <div className="mt-3">
        <Board
          fen={q.fen}
          orientation={orientation}
          mode="select"
          /*
           * The coordinate rail is hidden for "find the square" and shown for the
           * other two.
           *
           * In that mode the rail prints the answer: "Where is g1?" beside a
           * labelled a–h and 1–8 index is a reading exercise, not a board-vision
           * one, and F-PG-1 counts these scores towards Board vision. In the other
           * two modes the question is about the POSITION — where a written move
           * lands, how many men bear on a square — so the rail is an ordinary
           * board affordance and taking it away would only make them fiddlier.
           *
           * Nothing is lost to assistive technology either way: the rail is
           * `aria-hidden` and coordinates reach a screen reader through the
           * board's live region (see the note on `showRail` in Board.tsx).
           */
          coordinates={q.mode !== 'find-square'}
          disabled={q.answer.kind !== 'square'}
          onSelectSquare={(square: Square) => {
            if (q.answer.kind === 'square') give({ kind: 'square', square });
          }}
          highlights={q.subject ? { [q.subject]: 'review' } : {}}
          announce={q.prompt}
        />
      </div>

      {q.answer.kind === 'count' && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="How many?">
          {Array.from({ length: MAX_COUNT_ANSWER + 1 }, (_, n) => (
            <button
              key={n}
              type="button"
              className={`${btn.secondary} min-w-12 flex-1`}
              onClick={() => {
                give({ kind: 'count', count: n });
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* The verdict, in a live region: a learner who is wrong is told WHICH men
          they missed, which is the only part of this mode that teaches. */}
      <p aria-live="polite" className="t-body mt-3 min-h-12" data-testid="verdict">
        {verdict === null ? '' : verdict.correct ? 'Right.' : `Not quite. ${verdict.question.because}`}
      </p>
    </section>
  );
}

function Result({
  session,
  best,
  beatBest,
  onAgain,
  onBack,
}: {
  session: VisionSession;
  best: number;
  beatBest: boolean;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <section className="p-4">
      <h1 className="t-display">Time</h1>
      <p className="t-title mt-3" data-testid="final-score">
        {session.score} right out of {session.asked}
      </p>
      <p className="t-body mt-2 text-content-dim" data-testid="best-line">
        {beatBest ? `A new best for ${MODE_TITLE[session.mode]}.` : `Your best is ${String(best)}.`}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <button type="button" className={btn.primary} onClick={onAgain}>
          Go again
        </button>
        <button type="button" className={btn.secondary} onClick={onBack}>
          Choose another mode
        </button>
      </div>
    </section>
  );
}

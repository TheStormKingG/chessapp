import { useEffect, useRef, useState } from 'react';
import { Board } from '@/board';
import { applyMove, turn } from '@/rules';
import { getEngine } from '@/engine';
import { reportError } from '@/analytics';
import { EngineGate } from '@/play/EngineGate';
import type { Highlights } from '../LessonMachine';
import { goalMet, type PlayItOut as PlayItOutChallenge } from './goal';

/** F-ER-1: one plain line, and a retry that asks the engine again. */
const ENGINE_DOWN = 'The engine could not answer your move.';

/** The learner plays the position out against the engine until the goal settles. */
export function PlayItOut(props: {
  c: PlayItOutChallenge;
  onResult: (met: boolean) => void;
  disabled?: boolean;
  textEntry?: boolean;
  /** Hint and reveal squares. A drill's board is the only place to show them. */
  highlights?: Highlights;
}) {
  // F-OF-2: a play_it_out drill needs the engine, so the download happens here,
  // with its progress bar, before the board is offered.
  return (
    <EngineGate>
      <Drill {...props} />
    </EngineGate>
  );
}

function Drill({
  c,
  onResult,
  disabled,
  textEntry,
  highlights,
}: {
  c: PlayItOutChallenge;
  onResult: (met: boolean) => void;
  disabled?: boolean;
  textEntry?: boolean;
  /** Hint and reveal squares. A drill's board is the only place to show them. */
  highlights?: Highlights;
}) {
  const learner = turn(c.fen);
  // The engine reply is awaited, and the learner can leave the drill while it is
  // still thinking (Show me, then Next). Nothing a dead drill computes may reach
  // React state or the reducer: a late `onResult(false)` charges a miss to the
  // challenge that replaced it. Same guard as useEngineRefutation's `cancelled`.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [fen, setFen] = useState(c.fen);
  const [moves, setMoves] = useState(0);
  const [thinking, setThinking] = useState(false);
  // The engine owes the drill a reply and could not give one. The board stays
  // disabled while this stands: it is the opponent's turn, so every move the
  // learner tried would be refused with no explanation (PRD F-ER-1).
  const [engineDown, setEngineDown] = useState(false);
  // Set once the drill has reported its outcome, so a late engine reply cannot
  // report a second one. State, not a ref: the reset below happens during render.
  const [settled, setSettled] = useState(false);
  // A new drill restarts the position; adjusted during render, not in an effect
  // (setState-in-effect is lint-banned here, as in Board.tsx).
  const [prev, setPrev] = useState(c);
  if (prev !== c) {
    setPrev(c);
    setFen(c.fen);
    setMoves(0);
    setSettled(false);
    setEngineDown(false);
  }

  const settle = (f: string, n: number): boolean => {
    if (!alive.current) return true;
    const g = goalMet(c, f, learner, n);
    if (g !== null && !settled) {
      setSettled(true);
      onResult(g);
      return true;
    }
    return false;
  };

  /** Ask the engine for the opponent's reply to `after`, which the learner reached on move `n`. */
  const reply = (after: string, n: number) => {
    setEngineDown(false);
    setThinking(true);
    void (async () => {
      try {
        const uci = await getEngine().bestMove({ fen: after, depth: c.opponentDepth ?? 6 });
        if (!alive.current) return;
        const next = applyMove(after, uci).fen;
        setFen(next);
        settle(next, n);
      } catch (e) {
        // The position is the opponent's to move, so leaving the board live
        // would silently reject everything. Say so and offer the retry instead.
        if (!alive.current) return;
        reportError(e, { where: 'play-it-out-reply' });
        setEngineDown(true);
      } finally {
        if (alive.current) setThinking(false);
      }
    })();
  };

  return (
    <>
      <Board
        fen={fen}
        orientation={learner}
        mode="play"
        disabled={disabled || thinking || engineDown}
        textEntry={textEntry}
        highlights={highlights}
        onMove={(m) => {
          const after = applyMove(fen, m.uci).fen;
          const n = moves + 1;
          setFen(after);
          setMoves(n);
          if (settle(after, n)) return;
          reply(after, n);
        }}
      />
      {engineDown && (
        <p role="alert" className="mt-2 rounded-lg border border-danger bg-card p-3 text-sm">
          {ENGINE_DOWN}{' '}
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => {
              reply(fen, moves);
            }}
          >
            Retry
          </button>
        </p>
      )}
      <p className="mt-2 text-sm text-ink-muted">
        Moves used: {moves} of {c.goal.moves}
      </p>
    </>
  );
}

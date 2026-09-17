import { useEffect, useRef, useState } from 'react';
import { Board } from '@/board';
import { applyMove, turn } from '@/rules';
import { getEngine } from '@/engine';
import { goalMet, type PlayItOut as PlayItOutChallenge } from './goal';

/** The learner plays the position out against the engine until the goal settles. */
export function PlayItOut({
  c,
  onResult,
  disabled,
  textEntry,
}: {
  c: PlayItOutChallenge;
  onResult: (met: boolean) => void;
  disabled?: boolean;
  textEntry?: boolean;
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

  return (
    <>
      <Board
        fen={fen}
        orientation={learner}
        mode="play"
        disabled={disabled || thinking}
        textEntry={textEntry}
        onMove={(m) => {
          const after = applyMove(fen, m.uci).fen;
          const n = moves + 1;
          setFen(after);
          setMoves(n);
          if (settle(after, n)) return;
          setThinking(true);
          void (async () => {
            try {
              const reply = await getEngine().bestMove({ fen: after, depth: c.opponentDepth ?? 6 });
              if (!alive.current) return;
              const next = applyMove(after, reply).fen;
              setFen(next);
              settle(next, n);
            } catch {
              // Engine unavailable: the learner keeps the move and the drill
              // stays playable rather than dead-ending (PRD F-ER-1).
            } finally {
              if (alive.current) setThinking(false);
            }
          })();
        }}
      />
      <p className="mt-2 text-sm text-ink-muted">
        Moves used: {moves} of {c.goal.moves}
      </p>
    </>
  );
}

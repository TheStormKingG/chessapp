import { useState } from 'react';
import { Board, type Arrow, type Replay } from '@/board';
import { applyMove } from '@/rules';
import { sequenceReply } from '../answers';
import type { Challenge } from '../types';

export type SequenceChallenge = Extract<Challenge, { type: 'find_the_sequence' }>;

export interface WrongMove {
  fen: string;
  uci: string;
  san: string;
}

/** find_the_sequence: the learner plays each move, the authored reply answers it. */
export function Sequence({
  c,
  onDone,
  onWrong,
  disabled,
  textEntry,
  arrows,
  replay: revealReplay,
}: {
  c: SequenceChallenge;
  onDone: () => void;
  onWrong: (w: WrongMove) => void;
  disabled?: boolean;
  textEntry?: boolean;
  /** F-PA-6: the engine's refutation of a wrong move, drawn on the board. */
  arrows?: Arrow[];
  /** D1: the same refutation, played out on the board. */
  replay?: Replay | null;
}) {
  const [fen, setFen] = useState(c.fen);
  const [i, setI] = useState(0);
  // A new challenge restarts the line. Adjusted during render rather than in an
  // effect: setState-in-effect is lint-banned here (see Board.tsx for the same
  // pattern) and this avoids rendering one frame of the previous position.
  const [prev, setPrev] = useState(c);
  if (prev !== c) {
    setPrev(c);
    setFen(c.fen);
    setI(0);
  }

  /*
   * A revealed line is played out by `replay`, which restores the board to
   * this component's own `fen` when it finishes. If that is still the starting
   * position the learner watches the combination and then sees it snap back --
   * the same complaint that started this week. So the position advances to the
   * end of the line, and the replay lands on it instead of undoing it.
   *
   * Adjusted during render rather than in an effect, the pattern this file
   * already uses above.
   */
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  if (revealReplay && revealedFor !== c.id) {
    setRevealedFor(c.id);
    let end = c.fen;
    try {
      for (const m of c.answer.line) end = applyMove(end, m).fen;
      setFen(end);
    } catch {
      /* an authored line that does not fit is already guarded by the loader */
    }
  }

  return (
    <Board
      fen={fen}
      /* The orientation is the CHALLENGE's, not the live position's.
         `fen` advances move by move through the line, so reading the side to
         move off it flipped the board under the learner after every ply and
         left it, when the line finished, showing the losing side's view --
         reported as "after a find_the_sequence completes, the board is left in
         the losing side's orientation". It is one challenge, asked of one
         player: `c.fen` is the position they were given, so the side to move
         in it is the side they are playing, and it does not change while they
         play it. */
      orientation={c.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
      mode="play"
      arrows={arrows ?? []}
      replay={revealReplay ?? null}
      disabled={disabled}
      textEntry={textEntry}
      onMove={(m) => {
        const expected = c.answer.line[i * 2];
        if (expected === undefined) return;
        let want: string;
        try {
          want = applyMove(fen, expected).san;
        } catch {
          return; // authored line does not fit this position; the loader guards it
        }
        if (m.san !== want) {
          onWrong({ fen, uci: m.uci, san: m.san });
          return;
        }
        const played = applyMove(fen, m.uci).fen;
        const reply = sequenceReply(c, i);
        if (reply === null) {
          setFen(played);
          onDone();
          return;
        }
        setFen(applyMove(played, reply).fen);
        setI(i + 1);
      }}
    />
  );
}

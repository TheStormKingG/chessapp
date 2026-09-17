import { useState } from 'react';
import { Board, type Arrow } from '@/board';
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
}: {
  c: SequenceChallenge;
  onDone: () => void;
  onWrong: (w: WrongMove) => void;
  disabled?: boolean;
  textEntry?: boolean;
  /** F-PA-6: the engine's refutation of a wrong move, drawn on the board. */
  arrows?: Arrow[];
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

  return (
    <Board
      fen={fen}
      orientation={fen.split(' ')[1] === 'b' ? 'b' : 'w'}
      mode="play"
      arrows={arrows ?? []}
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

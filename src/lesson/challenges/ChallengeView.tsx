import { useState } from 'react';
import { Board } from '@/board';
import type { Square } from '@/rules';
import type { Action, Highlights } from '../LessonMachine';
import type { Challenge } from '../types';
import { Options } from './Options';
import { FindThemAll } from './FindThemAll';
import { Sequence, type WrongMove } from './Sequence';
import { PlayItOut } from './PlayItOut';

/**
 * The answering surface for one challenge. Mount it with `key={c.id}` so every
 * challenge starts with its own local state (the is_it_safe pick, the squares
 * picked in find_them_all, the sequence's position).
 */
export function ChallengeView({
  c,
  highlights,
  refutation,
  busy,
  textEntry,
  dispatch,
  onWrongMove,
}: {
  c: Challenge;
  highlights: Highlights;
  refutation: { from: Square; to: Square } | null;
  busy: boolean;
  textEntry?: boolean;
  dispatch: (a: Action) => void;
  onWrongMove: (w: WrongMove) => void;
}) {
  // is_it_safe is asked in two steps: the verdict, then the reason.
  const [safePick, setSafePick] = useState<boolean | null>(null);

  switch (c.type) {
    case 'find_the_move':
    case 'guess_the_move':
    case 'which_square':
      return (
        <Board
          fen={c.fen}
          orientation={c.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
          mode={c.type === 'which_square' ? 'select' : 'play'}
          disabled={busy}
          textEntry={textEntry}
          highlights={highlights}
          arrows={refutation ? [{ ...refutation, color: 'danger' }] : []}
          onMove={(m) => {
            onWrongMove({ fen: c.fen, uci: m.uci, san: m.san });
            dispatch({ type: 'attempt', attempt: { kind: 'move', uci: m.uci } });
          }}
          onSelectSquare={(square) => dispatch({ type: 'attempt', attempt: { kind: 'square', square } })}
        />
      );
    case 'find_the_sequence':
      return (
        <Sequence
          c={c}
          disabled={busy}
          textEntry={textEntry}
          onStep={() => {}}
          onDone={() => {
            const first = c.answer.line[0];
            if (first !== undefined) dispatch({ type: 'attempt', attempt: { kind: 'move', uci: first } });
          }}
          onWrong={(w) => {
            onWrongMove(w);
            dispatch({ type: 'miss', san: w.san });
          }}
        />
      );
    case 'find_them_all':
      return (
        <FindThemAll
          fen={c.fen}
          disabled={busy}
          textEntry={textEntry}
          highlights={highlights}
          onSubmit={(squares) => dispatch({ type: 'attempt', attempt: { kind: 'squares', squares } })}
        />
      );
    case 'name_the_pattern':
      return (
        <>
          <Board fen={c.fen} orientation="w" mode="static" highlights={highlights} />
          <Options
            options={c.options}
            disabled={busy}
            label="Which pattern is it?"
            onPick={(option) => dispatch({ type: 'attempt', attempt: { kind: 'option', option } })}
          />
        </>
      );
    case 'is_it_safe':
      return (
        <>
          <Board fen={c.fen} orientation="w" mode="static" highlights={highlights} />
          <p className="mt-2">
            Proposed move: <strong>{c.move}</strong>. Is it safe?
          </p>
          {safePick === null ? (
            <Options
              options={['Yes, it is safe', 'No, it is not safe']}
              disabled={busy}
              label="Is the move safe?"
              onPick={(i) => setSafePick(i === 0)}
            />
          ) : (
            <Options
              options={c.reasons}
              disabled={busy}
              label={safePick ? 'Why is it safe?' : 'Why is it not safe?'}
              onPick={(reason) => {
                dispatch({ type: 'attempt', attempt: { kind: 'safe', safe: safePick, reason } });
                setSafePick(null);
              }}
            />
          )}
        </>
      );
    case 'play_it_out':
      return (
        <PlayItOut
          c={c}
          disabled={busy}
          textEntry={textEntry}
          onResult={(met) => dispatch({ type: 'attempt', attempt: { kind: 'goal', met } })}
        />
      );
  }
}

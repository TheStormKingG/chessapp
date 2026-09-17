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
 * The answering surface for one challenge. Mount it with a key that carries both
 * the challenge id and its miss count, so every challenge -- and every retry of
 * one -- starts with its own local state: the is_it_safe pick, the squares picked
 * in find_them_all, the sequence's position, and the play_it_out drill, which is
 * otherwise left standing on the position that just failed (see LessonPlayer).
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
          arrows={refutation ? [{ ...refutation, color: 'danger' }] : []}
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
            label={c.prompt}
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
              label={c.prompt}
              onPick={(i) => setSafePick(i === 0)}
            />
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-muted">
                You said: <strong>{safePick ? 'Yes, it is safe' : 'No, it is not safe'}</strong>.
              </p>
              {/* The reason step asks one neutral question. Labelling it "Why is
                  it safe?" told the learner what the answer was and contradicted
                  the reasons offered underneath it; the reasons themselves are
                  authored as reasons, not as restated verdicts. */}
              <Options
                options={c.reasons}
                disabled={busy}
                label="Why?"
                onPick={(reason) => {
                  dispatch({ type: 'attempt', attempt: { kind: 'safe', safe: safePick, reason } });
                  setSafePick(null);
                }}
              />
              {/* A verdict is one tap and was previously irreversible. */}
              <button
                type="button"
                disabled={busy}
                className="tap mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-60"
                onClick={() => setSafePick(null)}
              >
                Change answer
              </button>
            </>
          )}
        </>
      );
    case 'play_it_out':
      return (
        <PlayItOut
          c={c}
          disabled={busy}
          highlights={highlights}
          textEntry={textEntry}
          onResult={(met) => dispatch({ type: 'attempt', attempt: { kind: 'goal', met } })}
        />
      );
  }
}

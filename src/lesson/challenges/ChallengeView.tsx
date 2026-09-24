import { useState } from 'react';
import { Board, type Replay } from '@/board';
import { btn } from '@/app/Button';
import type { Action, Highlights, LessonState } from '../LessonMachine';
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
  answeredFen,
  revealed,
  highlights,
  refutation,
  busy,
  textEntry,
  dispatch,
  onWrongMove,
}: {
  c: Challenge;
  /**
   * The position after the answering move, when there was one. The board is a
   * controlled component, so without this it re-renders the challenge's
   * starting FEN and visually undoes the move it just accepted.
   */
  answeredFen: string | null;
  /**
   * The learner asked to be shown the answer (or ran out of tries), as opposed
   * to having found it. Only `find_the_sequence` needs to tell the two apart:
   * a learner who played the line has already seen it.
   */
  revealed: boolean;
  highlights: Highlights;
  refutation: LessonState['refutation'];
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
          // Orientation stays derived from the CHALLENGE's fen: the side to
          // move flips once the answer is played, and a board that spun round
          // at the moment of success would be worse than one that did nothing.
          fen={answeredFen ?? c.fen}
          orientation={c.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
          mode={c.type === 'which_square' ? 'select' : 'play'}
          disabled={busy}
          textEntry={textEntry}
          highlights={highlights}
          arrows={refutation ? [{ from: refutation.from, to: refutation.to, color: 'danger' }] : []}
          replay={refutation?.replay ?? null}
          onMove={(m) => {
            onWrongMove({ fen: c.fen, uci: m.uci, san: m.san });
            dispatch({ type: 'attempt', attempt: { kind: 'move', uci: m.uci } });
          }}
          onSelectSquare={(square) => dispatch({ type: 'attempt', attempt: { kind: 'square', square } })}
        />
      );
    case 'find_the_sequence': {
      /*
       * "Show me" on a sequence used to show nothing.
       *
       * Every other type demonstrates its answer on reveal. This one left the
       * board where the learner got stuck, while `revealText` named only the
       * FIRST move of the line -- and a revealed challenge is `busy`, which
       * disables the board, so the learner was handed one move out of three
       * and then stopped from playing it.
       *
       * The board already knows how to play a line out: `replay` does it for
       * engine refutations. Reusing it is better than a second way to animate
       * a board, and it starts from `c.fen` so the line is shown whole rather
       * than from wherever the learner happened to stop.
       *
       * A refutation still wins if both are present: a learner who has just
       * played a losing move needs to see why before they see the answer.
       */
      const revealReplay: Replay | null =
        revealed && c.answer.line.length > 0
          ? {
              fen: c.fen,
              moves: c.answer.line,
              san: c.answer.line[c.answer.line.length - 1] ?? '',
              // Not "try again": the challenge is revealed and the board is
              // disabled, so the default sentence would tell the learner to do
              // something the interface has just stopped them doing.
              note: 'That is the line.',
            }
          : null;
      return (
        <Sequence
          c={c}
          disabled={busy}
          textEntry={textEntry}
          arrows={refutation ? [{ from: refutation.from, to: refutation.to, color: 'danger' }] : []}
          replay={refutation?.replay ?? revealReplay}
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
    }
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
          {/* The real position while the question is open -- the exercise is
              judging a move BEFORE playing it -- and the move played once the
              verdict and reason are in, so the answer is demonstrated rather
              than only described. `answeredFen` is null until then. */}
          <Board fen={answeredFen ?? c.fen} orientation="w" mode="static" highlights={highlights} />
          {/* A group step, not a control step. §3.3 sets the rhythm by role --
              "8 inside a control, 12 between related lines, 24 between groups"
              -- and the gap between the position and the question asked about
              it is a group boundary, the same boundary the coach's line takes
              on the other side of the board. It was 8, which is the value for
              two halves of one control, and it made the question read as a
              caption printed on the board rather than as the next thing said.
              This is the whole of "the space around the board" that lives in
              this file: the board's own width is decided by the column in
              LessonPlayer and is deliberately unchanged (PREMIUM-DELTA §6,
              "the board is unchanged at ≈ 358 px"), because elevation stops at
              its edge and its presence is proportion, not framing. */}
          <p className="mt-6">
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
              <p className="t-label mt-3 text-content-dim">
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
                className={`${btn.secondary} mt-3 w-full disabled:opacity-60`}
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

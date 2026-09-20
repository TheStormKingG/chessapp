import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { btn } from '@/app/Button';
import { Board } from '@/board';
import { CoachService } from '@/coach';
import type { Highlights } from '@/lesson/LessonMachine';
import { applyMove, type Square } from '@/rules';
import { useSettings } from '@/app/settings';
import { THEME_LABEL } from './themes';
import { explainPuzzle } from './explainPuzzle';
import { initial, reduce, result } from './session';
import type { AttemptResult, Puzzle, PuzzleSource } from './types';

/**
 * The solving screen (design spec §5.2). It mirrors `LessonPlayer` deliberately
 * and copies three of its properties rather than re-deciding them:
 *
 * 1. **It takes a plain data prop, not an id it fetches.** That is what makes
 *    it testable without a database, and it is why a fix-my-mistakes drill is
 *    just another `Puzzle` handed in by `queue.ts`.
 * 2. **The result is banked on ARRIVAL at the result, never from a dismiss
 *    button's `onClick`.** Banking from one exit turns every other exit — the
 *    ✕, the tab bar, a reload — into silent loss. This exact defect lost a
 *    completed lesson.
 * 3. **One board, one live region.** The board's own status region is the
 *    single carrier, so non-visual mode gets the position, the side to move and
 *    the result of every attempt through the region it already reads.
 */

/** F-PZ-4, stated where the learner decides and not only in the rules. */
const HINT_COST = 'A hint still earns progress, but the solve will not move your rating.';

/**
 * How long the opponent's move waits before it is played.
 *
 * The learner watches it happen rather than arriving at a position that has
 * already moved — the move is half of what the puzzle is about. Until it lands
 * the board is `static` and there is nothing to type into, so an answer can
 * never be played against a position the learner is not looking at.
 */
const OPPONENT_BEAT_MS = 450;

function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

export function PuzzlePlayer({
  puzzle,
  source,
  onDone,
  onExit,
  firstLearnerPly = 1,
  textEntry: forceText,
  children,
}: {
  puzzle: Puzzle;
  source: PuzzleSource;
  /** Fired once, when the attempt finishes. Never from a dismiss control. */
  onDone: (r: AttemptResult) => void;
  onExit: () => void;
  /**
   * Which ply of `solution` the learner plays. 1 for a pack puzzle; 0 for a
   * drill from the learner's own error position, where there is no opponent
   * move to replay. Explicit, never inferred from the solution's length: a
   * wrong guess asks the learner to play the wrong side and every position
   * still looks legal, so nothing downstream would catch it.
   */
  firstLearnerPly?: 0 | 1;
  textEntry?: boolean;
  /** Anything the caller wants on the result screen — an explanation, a next control. */
  children?: React.ReactNode;
}) {
  const settingTextEntry = useSettings((s) => s.textEntry);
  const textEntry = forceText ?? settingTextEntry;
  const coach = useMemo(() => new CoachService(), []);

  const [s, dispatch] = useReducer(reduce, { puzzle, source, firstLearnerPly }, (a) =>
    initial(a.puzzle, a.source, { firstLearnerPly: a.firstLearnerPly, now: Date.now() }),
  );

  /**
   * Every position the solution passes through: `positions[n]` is the board
   * after `n` plies. Derived from the puzzle rather than held in state — a
   * position kept beside the reducer is a second copy of the same fact, and
   * the two drift the moment one is updated.
   *
   * A solution ply that does not fit its own position stops the line there
   * rather than producing a half-played board. That is the same call
   * `Board.replayFrames` makes, for the same reason.
   */
  const positions = useMemo(() => {
    const out = [puzzle.fen];
    let cur = puzzle.fen;
    for (const uci of puzzle.solution) {
      try {
        cur = applyMove(cur, uci).fen;
      } catch {
        break;
      }
      out.push(cur);
    }
    return out;
  }, [puzzle]);

  const at = (ply: number) => positions[Math.min(ply, positions.length - 1)] ?? puzzle.fen;

  /**
   * The ply currently ON THE BOARD, which lags the ply the reducer is asking
   * about while the opponent's move is played.
   *
   * The learner watches that move happen rather than arriving at a position
   * that has already moved — the move is half of what the puzzle is about.
   * While the board lags there is nothing to type into and the board is
   * disabled, so an answer can never be played against a position the learner
   * is not looking at. This covers the opening move and every reply after a
   * correct move alike, which is why it is a lag and not a one-off flag.
   */
  const [shown, setShown] = useState(firstLearnerPly === 1 ? 0 : s.ply);
  useEffect(() => {
    if (shown >= s.ply) return;
    const id = window.setTimeout(() => {
      setShown(s.ply);
    }, OPPONENT_BEAT_MS);
    return () => {
      clearTimeout(id);
    };
  }, [shown, s.ply]);

  const ready = shown >= s.ply;
  const fen = at(shown);
  // The board faces the learner: the side to move on the position they are
  // asked about, which is never the side that plays the replayed reply.
  const orientation = sideToMove(at(s.ply));

  /*
    Banked when the attempt FINISHES, which is the moment the screen is entitled
    to say it did. A ref rather than state, because this fires exactly once and
    must not itself cause a render. `LessonPlayer` carries the same guard for
    the same reason, and its test and this one both prove the ordering rather
    than the call.
  */
  const banked = useRef(false);
  useEffect(() => {
    if (!s.done || banked.current) return;
    banked.current = true;
    onDone(result(s));
  }, [s, onDone]);

  const [note, setNote] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  /**
   * The hint is the square the answer starts on — a fact taken from the
   * solution, never an invented one, and never the whole move. Taking it is
   * what costs the rating, so it is offered before it is spent, not after.
   */
  const hintFrom: Square | null =
    s.hinted && s.expected ? (s.expected.slice(0, 2) as Square) : null;
  const highlights: Highlights = hintFrom ? { [hintFrom]: 'accent' } : {};

  /**
   * The last wrong move, and the position it was played in. Kept because
   * F-PZ-5 explains a MISS, and by the time the result screen renders the
   * reducer has moved on; the only other way to recover it would be to infer
   * it, which is exactly the kind of guess `explainPuzzle` exists to refuse.
   */
  const [lastMiss, setLastMiss] = useState<{ fen: string; playedUci: string; bestUci: string } | null>(
    null,
  );

  const onMove = (uci: string) => {
    if (s.done || !ready) return;
    const correct = uci === s.expected;
    if (!correct && s.expected) setLastMiss({ fen: at(s.ply), playedUci: uci, bestUci: s.expected });
    setNote(correct ? 'That is it.' : 'Not that one — the position is back, try again.');
    dispatch({ type: 'move', uci, at: Date.now() });
  };

  /**
   * F-PZ-5. Computed rather than fetched on demand, so the control is offered
   * only when there is something verified to say: `explainPuzzle` returns null
   * for a puzzle with no motif, and a "Why?" button that produces nothing is
   * worse than no button. Null is the honest answer and this is what honest
   * looks like on a screen.
   */
  const explanation = useMemo(() => {
    if (!lastMiss) return null;
    return explainPuzzle(coach, { ...lastMiss, theme: puzzle.themes[0] ?? null });
  }, [coach, lastMiss, puzzle.themes]);

  const announce = !ready
    ? `${orientation === 'w' ? 'White' : 'Black'} to move. Watching the opponent’s move.`
    : s.done
      ? showWhy && explanation !== null
        ? explanation
        : s.solved
          ? 'Solved.'
          : 'Puzzle over.'
      : (note ?? `Your move. ${orientation === 'w' ? 'White' : 'Black'} to play.`);


  return (
    <section className="flex min-h-dvh flex-col p-4 md:mx-auto md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-x-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-x-12">
      <header className="flex items-center justify-between gap-3 md:col-span-2">
        <button type="button" className="tap icon-control shrink-0" aria-label="Close puzzle" onClick={onExit}>
          ✕
        </button>
        <h1 className="t-caption min-w-0 flex-1 text-center text-content-dim">
          {/* F-PZ-1: the rating and the themes are not on screen until the
              attempt is over, so neither the number nor the motif can be read
              as a hint. The heading says which kind of puzzle it is, which is
              a fact about the session and not about this position. */}
          {SOURCE_LABEL[source]}
        </h1>
        <span className="t-index shrink-0 text-content-dim">{s.misses > 0 ? `${String(s.misses)} miss` : ''}</span>
      </header>

      <div className="mt-4 md:col-start-1 md:row-start-2">
        <div className="md:mx-auto md:max-w-[calc(100dvh-11rem)]">
          <Board
            fen={fen}
            orientation={orientation}
            mode="play"
            disabled={!ready || s.done}
            onMove={(m) => {
              onMove(m.uci);
            }}
            highlights={highlights}
            textEntry={textEntry && ready && !s.done}
            announce={announce}
          />
        </div>
      </div>

      <div className="mt-4 md:col-start-2 md:row-start-2">
        {!s.done && (
          <>
            <p className="t-body-strong">
              {ready
                ? `${orientation === 'w' ? 'White' : 'Black'} to play. Find the best move.`
                : 'Watch the opponent’s move.'}
            </p>
            {note && <p className="t-body mt-2 text-content-dim">{note}</p>}
            {hintFrom && <p className="t-body mt-2">The move starts on {hintFrom}.</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={`${btn.secondary} flex-1 disabled:opacity-60`}
                onClick={() => {
                  dispatch({ type: 'hint' });
                }}
                disabled={s.hinted || !ready}
                title={HINT_COST}
                aria-describedby="puzzle-hint-cost"
              >
                Hint
              </button>
              {/* The cost is announced, not only hovered (F-AX-1). */}
              <p id="puzzle-hint-cost" className="sr-only">
                {HINT_COST}
              </p>
              <button
                type="button"
                className={`${btn.secondary} flex-1`}
                disabled={!ready}
                onClick={() => {
                  setNote(null);
                  dispatch({ type: 'giveUp', at: Date.now() });
                }}
              >
                Give up
              </button>
            </div>
          </>
        )}

        {s.done && (
          <div className="flex flex-col">
            <h2 className="t-display-lg">{s.solved ? 'Solved' : 'Not this time'}</h2>
            {/* F-PZ-1: revealed only now. The time comes from the reducer, so
                the screen never has to hold a clock of its own. */}
            <p className="t-index mt-2 text-content-dim">
              Rating {puzzle.rating} · {s.misses === 1 ? '1 miss' : `${String(s.misses)} misses`}
              {s.hinted ? ' · hint taken' : ''} · {Math.round((result(s).ms / 1000) * 10) / 10}s
            </p>
            <p className="t-body mt-3">
              {puzzle.themes.length > 0
                ? puzzle.themes.map((t) => THEME_LABEL[t]).join(' · ')
                : 'No motif recorded for this position.'}
            </p>
            {/* F-PZ-5, on request. The explanation is only offered when there
                is one: `explainPuzzle` returns null for a position with no
                verified motif, which is the COMMON case for a drill built from
                the learner's own error, and an empty "Why?" would be the
                review feature's shipped defect repeated. */}
            {explanation !== null &&
              (showWhy ? (
                <p className="t-body mt-3 border-l-2 border-accent bg-surface-raised py-2 pl-3">{explanation}</p>
              ) : (
                <button
                  type="button"
                  className={`${btn.secondary} mt-3 self-start`}
                  onClick={() => {
                    setShowWhy(true);
                  }}
                >
                  Why?
                </button>
              ))}
            {children}
            <button type="button" className={`${btn.primary} mt-6 w-full md:mx-auto md:max-w-sm`} onClick={onExit}>
              Done
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const SOURCE_LABEL: Record<PuzzleSource, string> = {
  rated: 'Puzzle',
  themed: 'Themed practice',
  daily: 'Daily puzzle',
  fix: 'Fix my mistakes',
};

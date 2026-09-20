import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { btn } from '@/app/Button';
import { Board } from '@/board';
import type { Highlights } from '@/lesson/LessonMachine';
import { applyMove, type Square } from '@/rules';
import { useSettings } from '@/app/settings';
import { THEME_LABEL } from './themes';
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

  const [s, dispatch] = useReducer(reduce, { puzzle, source, firstLearnerPly }, (a) =>
    initial(a.puzzle, a.source, { firstLearnerPly: a.firstLearnerPly, now: Date.now() }),
  );

  /**
   * The position the learner is asked about, and the opponent move that gets
   * there. Both are derived from the puzzle rather than held in state: a
   * position kept in state alongside the reducer is a second copy of the same
   * fact, and the two drift the moment one is updated.
   *
   * An opponent move that does not fit its own FEN leaves the learner on the
   * puzzle's own position rather than on a half-played line.
   */
  const opening = useMemo(() => {
    const opener = firstLearnerPly === 1 ? puzzle.solution[0] : undefined;
    if (opener === undefined) return { from: puzzle.fen, to: puzzle.fen, san: null };
    try {
      const r = applyMove(puzzle.fen, opener);
      return { from: puzzle.fen, to: r.fen, san: r.san };
    } catch {
      return { from: puzzle.fen, to: puzzle.fen, san: null };
    }
  }, [puzzle, firstLearnerPly]);

  const [ready, setReady] = useState(opening.san === null);
  useEffect(() => {
    if (opening.san === null) return;
    const id = window.setTimeout(() => {
      setReady(true);
    }, OPPONENT_BEAT_MS);
    return () => {
      clearTimeout(id);
    };
  }, [opening.san]);

  const fen = ready ? opening.to : opening.from;
  const orientation = sideToMove(opening.to);

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

  const announce = !ready
    ? `${orientation === 'w' ? 'White' : 'Black'} to move. Watching the opponent’s move.`
    : s.done
      ? s.solved
        ? 'Solved.'
        : 'Puzzle over.'
      : (note ?? `Your move. ${orientation === 'w' ? 'White' : 'Black'} to play.`);

  /**
   * The hint is the square the answer starts on — a fact taken from the
   * solution, never an invented one, and never the whole move. Taking it is
   * what costs the rating, so it is offered before it is spent, not after.
   */
  const hintFrom: Square | null =
    s.hinted && s.expected ? (s.expected.slice(0, 2) as Square) : null;
  const highlights: Highlights = hintFrom ? { [hintFrom]: 'accent' } : {};

  const onMove = (uci: string) => {
    if (s.done) return;
    const correct = uci === s.expected;
    setNote(correct ? 'That is it.' : 'Not that one — the position is back, try again.');
    dispatch({ type: 'move', uci, at: Date.now() });
  };

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

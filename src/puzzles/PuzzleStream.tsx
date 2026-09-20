import { useState } from 'react';
import { btn } from '@/app/Button';
import { PuzzlePlayer } from './PuzzlePlayer';
import { pickNext, type Pick } from './select';
import type { AttemptResult, Puzzle, PuzzleRating } from './types';

/**
 * The rated stream (F-PZ-1): one puzzle after another, chosen so predicted
 * success stays in the 70-85% band, for as long as the learner keeps going.
 *
 * WHY THIS IS ITS OWN COMPONENT. Selection has to happen between puzzles, and
 * "between" is the only place a stream can hold state. `PuzzlePlayer` is
 * deliberately ignorant of what comes next — it is handed one puzzle and
 * reports one result — so the alternative was a player that fetched its own
 * successor, which is the coupling that makes the fix-my-mistakes drill and
 * the daily puzzle impossible to reuse it for.
 */
export function PuzzleStream({
  pool,
  rating,
  seen: alreadySeen = [],
  onAttempt,
  onExit,
}: {
  pool: readonly Puzzle[];
  /** Projected from the event log by the caller, never held here. */
  rating: PuzzleRating;
  /** Ids the learner has already met, so a stream resumed later does not repeat. */
  seen?: Iterable<string>;
  onAttempt: (r: AttemptResult) => void;
  onExit: () => void;
}) {
  /**
   * The current pick and the ids it was chosen against, held TOGETHER.
   *
   * Two separate pieces of state would let the pick be recomputed from a
   * `seen` that had already moved on, which is how a stream serves the same
   * puzzle twice. Holding the pick rather than deriving it also means a rating
   * that updates mid-attempt — and it does, the projection re-runs on every
   * banked result — cannot swap the puzzle out from under the learner.
   */
  const [{ pick }, setState] = useState<{ seen: ReadonlySet<string>; pick: Pick }>(() => {
    const s = new Set(alreadySeen);
    return { seen: s, pick: pickNext(pool, rating, s) };
  });

  const advance = () => {
    setState((cur) => {
      const next = new Set(cur.seen);
      if (cur.pick.puzzle) next.add(cur.pick.puzzle.id);
      // `rating` from the current render, so the NEXT puzzle is chosen against
      // what the learner has just proved — and the one on screen never is.
      return { seen: next, pick: pickNext(pool, rating, next) };
    });
  };

  const puzzle = pick.puzzle;

  if (!puzzle) {
    return (
      <section className="p-4">
        <h1 className="t-display">No more puzzles</h1>
        <p className="t-body mt-3">
          You have worked through every puzzle in this band. More arrive with the next pack.
        </p>
        <button type="button" className={`${btn.primary} mt-6 w-full`} onClick={onExit}>
          Back to puzzles
        </button>
      </section>
    );
  }

  return (
    <>
      {/* Which puzzle is on screen, throughout the attempt and not only at the
          end of it — the test that proves the stream advances has to read it
          while the puzzle is still open. Not visible: F-PZ-1 keeps the rating
          and the motif off the solving screen, and an id is neither. */}
      <span className="sr-only" data-testid="stream-puzzle-id">
        {puzzle.id}
      </span>
      <PuzzlePlayer
        /*
          EVERY PUZZLE STARTS FRESH. Without this key React reuses the player
          instance as `puzzle` changes, and its reducer state — the hint, the
          misses, the result — carries into the next puzzle, which then opens
          already solved. This is the defect that shipped in `KeyMomentView`
          and that every single-item unit test passed through;
          `PuzzleStream.test.tsx` advances through three so it cannot.

          The id is a safe key because ids are unique within a pack and across
          all three: verified with `cut -f1 public/data/puzzles/*.txt | sort |
          uniq -d`, which is empty, rather than assumed from their being
          Lichess ids.
        */
        key={puzzle.id}
        puzzle={puzzle}
        source="rated"
        onDone={onAttempt}
        onExit={onExit}
      >
        {/* Design spec §3.2: a widened pick must not arrive silently. Said on
            the result screen, not before it, so it cannot be read as a
            difficulty hint while the puzzle is still open (F-PZ-1). */}
        {pick.widened && (
          <p className="t-body mt-3 text-content-dim">
            That one was outside your usual range — you have outgrown this band.
          </p>
        )}
        <button type="button" className={`${btn.secondary} mt-4 self-start`} onClick={advance}>
          Next puzzle
        </button>
      </PuzzlePlayer>
    </>
  );
}

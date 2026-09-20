import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '@/app/settings';
import { emptyProgress, reduceProgress } from '@/data/reduce';
import { newEvent } from '@/data/events';
import { PuzzleStream } from './PuzzleStream';
import { initial, reduce, result, type SessionState } from './session';
import type { Puzzle, PuzzleSource } from './types';

/* The shared board is stubbed for the reason `PuzzlePlayer.test.tsx` states:
   react-chessboard throws "Square width not found" in jsdom the moment the FEN
   changes, and the opponent's move changes it on a beat. */
vi.mock('@/board', () => ({
  Board: ({
    fen,
    disabled,
    textEntry,
    onMove,
  }: {
    fen: string;
    disabled?: boolean;
    textEntry?: boolean;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      {textEntry && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const field = e.currentTarget.elements.namedItem('m') as HTMLInputElement;
            const uci = field.value.trim();
            field.value = '';
            if (!disabled && uci) onMove?.({ from: uci.slice(0, 2), to: uci.slice(2, 4), uci, san: uci });
          }}
        >
          <input name="m" aria-label="Type a move" />
          <button type="submit">Move</button>
        </form>
      )}
    </div>
  ),
}));

/* Text move entry is the non-visual path and it is how a test drives a board
   it cannot see. A setting, not a prop, so it is set as the other board tests
   set it. */
beforeEach(() => {
  useSettings.setState({ textEntry: true });
});

const FEN = '8/8/8/8/8/8/8/K6k w - - 0 1';

const P = (id: string, rating: number): Puzzle => ({
  id,
  rating,
  themes: ['fork'],
  fen: FEN,
  solution: ['a1a2', 'h1h2'],
});

/** Take the hint, then play the answer. Both, because the hint is the state
 *  most likely to leak between puzzles and the solve is what ends the attempt. */
async function takeHintAndSolve(): Promise<void> {
  const field = await screen.findByLabelText('Type a move');
  await userEvent.click(screen.getByRole('button', { name: /^hint$/i }));
  await userEvent.type(field, 'h1h2{enter}');
}

/**
 * THE TEST THIS TASK EXISTS FOR (design spec §6).
 *
 * A per-item test proves nothing about state carried BETWEEN items. This
 * exact defect shipped in the review feature: `KeyMomentView` rendered without
 * a `key`, React reused the instance as the item changed, and every moment
 * after the first appeared already revealed. Every single-item unit test
 * passed. The stream has the same shape, so this advances through three.
 */
test('every puzzle in the stream starts fresh, not just the first', async () => {
  render(
    <PuzzleStream
      pool={[P('a', 900), P('b', 910), P('c', 920)]}
      rating={{ rating: 800, confidence: 0 }}
      onAttempt={vi.fn()}
      onExit={vi.fn()}
    />,
  );

  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) {
    // Read FIRST, and assert the leak before waiting on anything: a reused
    // instance is still showing the previous puzzle's result screen, so a wait
    // for the move field would time out and report a missing label instead of
    // the defect. The id also proves the stream really is advancing — a test
    // that cannot observe the defect certifies the opposite of what it claims.
    ids.push(screen.getByTestId('stream-puzzle-id').textContent ?? '');
    expect(
      screen.queryByRole('heading', { name: /^solved$|^not this time$/i }),
      `puzzle ${String(i)} opened already finished`,
    ).not.toBeInTheDocument();

    // Waits for the opponent's replayed move: until it lands there is nothing
    // to type into, and nothing to assert about the learner's own position.
    await screen.findByLabelText('Type a move');
    expect(
      screen.getByRole('button', { name: /^hint$/i }),
      `puzzle ${String(i)} did not offer an untaken hint`,
    ).toBeEnabled();

    await takeHintAndSolve();
    expect(screen.getByRole('heading', { name: /^solved$/i })).toBeInTheDocument();

    if (i < 3) await userEvent.click(screen.getByRole('button', { name: /next puzzle/i }));
  }

  expect(new Set(ids).size, `the stream repeated a puzzle: ${ids.join(', ')}`).toBe(3);
});

test('the stream says so when there is nothing left, rather than showing an empty board', async () => {
  const onExit = vi.fn();
  render(
    <PuzzleStream
      pool={[P('a', 900)]}
      rating={{ rating: 800, confidence: 0 }}
      onAttempt={vi.fn()}
      onExit={onExit}
    />,
  );
  await screen.findByLabelText('Type a move');
  await takeHintAndSolve();
  await userEvent.click(screen.getByRole('button', { name: /next puzzle/i }));

  expect(screen.getByText(/no more puzzles/i)).toBeInTheDocument();
  expect(screen.queryByTestId('fen')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to puzzles/i }));
  expect(onExit).toHaveBeenCalledTimes(1);
});

/**
 * `session.ts`'s `ratingCounts` and the projection's guard in
 * `src/data/reduce.ts` were written to the same expression deliberately — the
 * projection cannot import a session it never saw. They sit on opposite sides
 * of a module boundary and can drift, so this drives BOTH across all sixteen
 * combinations and asserts they agree.
 *
 * The projection side is measured by whether the rating actually MOVED, not by
 * re-writing the guard's expression here. Re-writing it would compare this
 * file against itself and pass however the projection behaved.
 */
test('the rating rule in session.ts and the projection agree, all sixteen ways', () => {
  const SOURCES: PuzzleSource[] = ['rated', 'themed', 'daily', 'fix'];
  // Far from the learner's 800 start, so a solve and a failure both move the
  // projected rating measurably. A puzzle at the learner's own rating would
  // make "did not move" the answer for the wrong reason.
  const PUZZLE_RATING = 1500;

  let checked = 0;
  for (const source of SOURCES) {
    for (const solved of [true, false]) {
      for (const hinted of [true, false]) {
        const label = `${source}/solved=${String(solved)}/hinted=${String(hinted)}`;

        let s: SessionState = initial({ ...P('x', PUZZLE_RATING) }, source, { now: 0 });
        if (hinted) s = reduce(s, { type: 'hint' });
        s = solved
          ? reduce(s, { type: 'move', uci: 'h1h2', at: 1 })
          : reduce(s, { type: 'giveUp', at: 1 });
        const fromSession = result(s).ratingCounts;

        const before = emptyProgress();
        const after = reduceProgress(before, [
          newEvent({
            type: 'puzzle_attempted',
            puzzleId: 'x',
            themes: ['fork'],
            puzzleRating: PUZZLE_RATING,
            solved,
            hinted,
            misses: 0,
            source,
            ms: 1,
          }),
        ]);
        const projectionMoved = after.puzzleRating.rating !== before.puzzleRating.rating;

        expect(fromSession, `${label}: session says ratingCounts=${String(fromSession)}`).toBe(
          projectionMoved,
        );
        checked += 1;
      }
    }
  }
  // The loop ran. A nested loop that silently iterated zero times would make
  // every assertion above vacuous and the test green.
  expect(checked).toBe(16);
});

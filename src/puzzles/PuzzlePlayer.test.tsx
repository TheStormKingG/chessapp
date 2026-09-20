import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuzzlePlayer } from './PuzzlePlayer';
import type { Puzzle } from './types';

/*
 * react-chessboard throws "Square width not found" in jsdom as soon as the FEN
 * changes, and the opponent's move changes it on a beat, so the shared board is
 * stubbed exactly as `LessonPlayer.board.test.tsx` and `KeyMomentView.test.tsx`
 * stub it. What these tests assert is what the player hands the board and what
 * it does with a move that comes back -- the board's own rendering is the
 * board's own tests. The move field mirrors the real `TextMoveEntry`: the same
 * accessible name, and the text is passed through as UCI, which is what
 * `applyMove` produces for a UCI string anyway.
 */
vi.mock('@/board', () => ({
  Board: ({
    fen,
    orientation,
    disabled,
    textEntry,
    announce,
    highlights = {},
    onMove,
  }: {
    fen: string;
    orientation?: string;
    disabled?: boolean;
    textEntry?: boolean;
    announce?: string;
    highlights?: Record<string, string>;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      <span data-testid="orientation">{orientation}</span>
      <span data-testid="highlights">{Object.keys(highlights).join(',')}</span>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
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

/**
 * Two kings, white to move. `solution[0]` is the opponent's move and the
 * learner plays `solution[1]`, which is the convention `types.ts` states and
 * the one `session.initial`'s `firstLearnerPly` exists to keep explicit.
 */
const PZ: Puzzle = {
  id: 'p1',
  rating: 1000,
  themes: ['fork'],
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  solution: ['a1a2', 'h1h2'],
};

/**
 * Drive the shared board's own move entry — the affordance `LessonPlayer`'s
 * tests use, not a second one invented here. `findBy` is load bearing: the
 * opponent's move is replayed on a beat, and the field only appears once the
 * learner's own position is on the board.
 */
async function solve(): Promise<void> {
  const field = await screen.findByLabelText('Type a move');
  await userEvent.type(field, 'h1h2{enter}');
}

describe('PuzzlePlayer', () => {
  test('the rating and themes are hidden until the puzzle is finished (F-PZ-1)', () => {
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} textEntry />);
    expect(screen.queryByText(/1000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/fork/i)).not.toBeInTheDocument();
  });

  test('the hint control states the rule it costs (F-PZ-4)', () => {
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} textEntry />);
    const hint = screen.getByRole('button', { name: /hint/i });
    // The rule must be readable, not only hoverable: a `title` attribute alone
    // is unreachable by touch and by a screen reader in some modes.
    expect(hint).toHaveAccessibleDescription(/rating/i);
  });

  test('the result is banked on arrival, not from the exit control', async () => {
    const onDone = vi.fn();
    const onExit = vi.fn();
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={onDone} onExit={onExit} textEntry />);
    await solve();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(onDone).toHaveBeenCalledTimes(1); // still once — not banked twice
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('the banked result carries the source and the F-PZ-4 accounting', async () => {
    const onDone = vi.fn();
    render(<PuzzlePlayer puzzle={PZ} source="themed" onDone={onDone} onExit={vi.fn()} textEntry />);
    await solve();
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        puzzleId: 'p1',
        solved: true,
        hinted: false,
        misses: 0,
        source: 'themed',
        mastered: true,
        // F-PZ-2: themed practice cannot move the rating, whatever happened.
        ratingCounts: false,
      }),
    );
  });

  test('after finishing, the rating and themes are shown', async () => {
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} textEntry />);
    await solve();
    expect(screen.getByText(/1000/)).toBeInTheDocument();
    expect(screen.getByText(/fork/i)).toBeInTheDocument();
  });

  test('a wrong move is counted and the puzzle stays open', async () => {
    const onDone = vi.fn();
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={onDone} onExit={vi.fn()} textEntry />);
    const field = await screen.findByLabelText('Type a move');
    await userEvent.type(field, 'h1g1{enter}');
    expect(onDone).not.toHaveBeenCalled();
    await userEvent.type(field, 'h1h2{enter}');
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ solved: true, misses: 1, mastered: false, ratingCounts: true }),
    );
  });

  test('a hint is accounted for, and the solve after it does not move the rating (F-PZ-4)', async () => {
    const onDone = vi.fn();
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={onDone} onExit={vi.fn()} textEntry />);
    // A hint cannot be taken before the puzzle has started: the control is
    // disabled until the opponent's move has landed, so there is nothing to be
    // hinted about yet, and a click that was swallowed must not read as a
    // hint that was never charged for.
    const field = await screen.findByLabelText('Type a move');
    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    await userEvent.type(field, 'h1h2{enter}');
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ solved: true, hinted: true, mastered: false, ratingCounts: false }),
    );
  });

  /**
   * A drill built from the learner's own error position has no opponent move to
   * replay: they are already to move. Inferring that from the solution's length
   * would be a silent side-swap that every legality check passes.
   */
  test('a drill from the learner’s own position asks for the first ply', async () => {
    const own: Puzzle = {
      id: 'own:g1:7',
      rating: 800,
      themes: [],
      fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
      solution: ['a1a2'],
    };
    const onDone = vi.fn();
    render(
      <PuzzlePlayer
        puzzle={own}
        source="fix"
        firstLearnerPly={0}
        onDone={onDone}
        onExit={vi.fn()}
        textEntry
      />,
    );
    const field = await screen.findByLabelText('Type a move');
    await userEvent.type(field, 'a1a2{enter}');
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ solved: true, source: 'fix' }));
  });

  /**
   * Spec §5.5: the announcements go through the board's single live region,
   * which is the one the non-visual learner already reads. A second region on
   * this screen would compete with it, so the player must add none of its own.
   */
  test('the player announces through the board\u2019s region and adds none of its own', async () => {
    const { container } = render(
      <PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} textEntry />,
    );
    await screen.findByLabelText('Type a move');
    const regions = container.querySelectorAll('[aria-live]');
    expect(regions).toHaveLength(1); // the board's, and only the board's
    expect(regions[0]).toHaveTextContent(/black to play/i);
  });

  /**
   * The opponent's move is REPLAYED, not skipped past: the learner arrives on
   * the puzzle's own position and watches it change. Until it lands there is
   * nothing to type into, so an answer can never be played against a position
   * the learner is not looking at.
   */
  test('the opponent\u2019s move is played on arrival, and the learner waits for it', async () => {
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} textEntry />);
    expect(screen.getByTestId('fen')).toHaveTextContent(PZ.fen);
    expect(screen.queryByLabelText('Type a move')).not.toBeInTheDocument();
    await screen.findByLabelText('Type a move');
    expect(screen.getByTestId('fen')).not.toHaveTextContent(PZ.fen);
    // The board faces the learner, who is the side to move once it has landed.
    expect(screen.getByTestId('orientation')).toHaveTextContent('b');
  });

  test('a hint marks the square the answer starts on, and nothing more', async () => {
    render(<PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} textEntry />);
    await screen.findByLabelText('Type a move');
    expect(screen.getByTestId('highlights')).toHaveTextContent('');
    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByTestId('highlights')).toHaveTextContent('h1');
    // The destination is never given away: a hint is a nudge, not the answer.
    expect(screen.getByTestId('highlights')).not.toHaveTextContent('h2');
  });

});

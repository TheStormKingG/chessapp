import { render, waitFor } from '@testing-library/react';
import { PuzzlePlayer } from './PuzzlePlayer';
import type { Puzzle } from './types';

/**
 * Non-visual mode on the solving screen (design spec §5.5).
 *
 * WHY THIS IS A SEPARATE FILE. `PuzzlePlayer.test.tsx` stubs `@/board`,
 * because react-chessboard throws in jsdom the moment the FEN changes. A live
 * region counted against that stub counts the stub: it renders exactly one and
 * would pass however the real board behaved. These tests therefore render the
 * REAL board and assert before the opponent's replayed move changes the
 * position.
 */

const PZ: Puzzle = {
  id: 'p1',
  rating: 1000,
  themes: ['fork'],
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  solution: ['a1a2', 'h1h2'],
};

/** jsdom gives every element a zero-size rect, which react-chessboard rejects. */
async function withSizedRects(fn: () => Promise<void>): Promise<void> {
  const real = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    return { ...real.call(this), width: 50, height: 50 } as DOMRect;
  };
  try {
    await fn();
  } finally {
    Element.prototype.getBoundingClientRect = real;
  }
}

test('the solving screen exposes exactly one live region, and it is the board’s', async () => {
  await withSizedRects(async () => {
    const { container, unmount } = render(
      <PuzzlePlayer puzzle={PZ} source="rated" onDone={vi.fn()} onExit={vi.fn()} />,
    );

    /*
      THE NON-HIDDEN COUNT, NOT THE RAW ONE. The raw `[aria-live]` count is 2
      by design: dnd-kit adds its own inside `role="application"` and
      `Board.tsx` neutralises it with `aria-hidden` rather than removing it.
      Asserting the raw count asserts a library's internals and would break on
      a dnd-kit upgrade for no reason at all.
    */
    const exposed = () =>
      [...container.querySelectorAll('[aria-live]')].filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      );

    /*
      AWAITED, because `Board.tsx` neutralises dnd-kit's region through a
      MutationObserver and the library mounts it after the first commit.
      `Board.test.tsx` waits for the same reason. A synchronous read here sees
      two and would make this test fail for a reason that is not a defect.
    */
    await waitFor(() => {
      expect(exposed()).toHaveLength(1);
    });
    const live = exposed();

    /*
      Negative control, in the shape `Board.test.tsx` uses: something really
      was filtered out. Without this the `toHaveLength(1)` above would pass
      just as happily if there had only ever been one `[aria-live]` element and
      the `aria-hidden` filter were doing nothing at all. The NUMBER filtered
      is deliberately not asserted — that would be a count of dnd-kit's
      internals, and it is the library's business how many it mounts.
    */
    expect(
      container.querySelectorAll('[aria-live]').length,
      'the aria-hidden filter removed nothing, so this test is not measuring it',
    ).toBeGreaterThan(live.length);

    /*
      And it is the BOARD's region, by name. This is what stops the assertion
      above going vacuous: "exactly one" is also satisfied if the filter
      removed the wrong one, or if the player grew a region of its own and the
      board's got hidden. Naming the survivor makes the count mean what it says.
    */
    expect(live[0]).toHaveAttribute('aria-label', 'Board announcements');
    expect(live[0]).toHaveTextContent(/to move|to play/i);

    // One board, not two. Spec §5.5's other invariant.
    expect(container.querySelectorAll('[role="application"]')).toHaveLength(1);

    // Unmounted inside the sized-rect window: the opponent's move is replayed
    // on a beat, and react-chessboard throws on that FEN change once the real
    // rects are back.
    unmount();
  });
});

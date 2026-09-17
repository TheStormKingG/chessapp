import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from './Board';
import { START_FEN } from '@/rules';

test('text move entry submits a legal SAN move and announces it', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  const input = screen.getByLabelText('Type a move');
  await userEvent.type(input, 'e4{enter}');
  expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' });
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/e4/);
});

test('text move entry accepts UCI too', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  await userEvent.type(screen.getByLabelText('Type a move'), 'g1f3{enter}');
  expect(onMove).toHaveBeenCalledWith({ from: 'g1', to: 'f3', uci: 'g1f3', san: 'Nf3' });
});

test('text move entry reports an illegal move without calling onMove', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  await userEvent.type(screen.getByLabelText('Type a move'), 'e5{enter}');
  expect(onMove).not.toHaveBeenCalled();
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/not a legal move/i);
});

test('keyboard navigation: arrows move the cursor, Enter selects then moves', () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  // cursor starts at a1 for white; go to e2: right x4, up x1
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' }); fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ uci: 'e2e4' }));
});

test('selectable mode reports square taps instead of moves', () => {
  const onSelect = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="select" onSelectSquare={onSelect} textEntry />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('a1');
});

test('disabled board ignores keyboard activation', () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} disabled />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' }); fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onMove).not.toHaveBeenCalled();
});

test('announce prop overrides the internal status', () => {
  render(<Board fen={START_FEN} orientation="w" mode="static" announce="Puzzle solved" />);
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent('Puzzle solved');
});

// --- I-1: single tab stop, no dnd-kit instructions, one live region ---

function tabStopsInside(app: HTMLElement) {
  return app.querySelectorAll('[tabindex="0"]').length;
}
function describedByInside(app: HTMLElement) {
  return app.querySelectorAll('[aria-roledescription="draggable"][aria-describedby]').length;
}
function exposedLiveRegions(root: HTMLElement) {
  return Array.from(root.querySelectorAll('[aria-live]')).filter(
    (el) => !el.closest('[aria-hidden="true"]'),
  );
}

test('application container is the only tab stop inside the board, before and after a move', () => {
  // jsdom gives every element a zero-size rect; react-chessboard throws
  // ("Square width not found") when it animates a position change.
  const realRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    return { ...realRect.call(this), width: 50, height: 50 } as DOMRect;
  };
  try {
  const { container, rerender } = render(<Board fen={START_FEN} orientation="w" mode="play" />);
  const app = screen.getByRole('application', { name: /chess board/i });
  expect(tabStopsInside(app)).toBe(0);
  expect(describedByInside(app)).toBe(0);
  expect(app.getAttribute('tabindex')).toBe('0');

  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  rerender(<Board fen={afterE4} orientation="w" mode="play" />);
  expect(tabStopsInside(app)).toBe(0);
  expect(describedByInside(app)).toBe(0);
  expect(exposedLiveRegions(container).length).toBe(1);
  } finally {
    Element.prototype.getBoundingClientRect = realRect;
  }
});

test('exactly one live region inside the component is exposed to AT', async () => {
  const { container } = render(<Board fen={START_FEN} orientation="w" mode="play" />);
  // react-chessboard/dnd-kit may mount its own live region in a child effect
  // after our commit; the MutationObserver neutralises it on the next tick.
  // So there is a real one-tick window at mount during which two live regions
  // are exposed -- that window is what this waitFor absorbs, and it is not a
  // test-only artefact.
  await waitFor(() => expect(exposedLiveRegions(container)).toHaveLength(1));
  const exposed = exposedLiveRegions(container);
  expect(exposed[0]).toHaveAttribute('aria-label', 'Board announcements');
  // the board wrapper itself must not be hidden
  expect(screen.getByRole('application', { name: /chess board/i }).closest('[aria-hidden="true"]')).toBeNull();
});

// --- I-3: cursor moves announce; label is static ---

test('arrow keys announce the new cursor square in the status region', () => {
  render(<Board fen={START_FEN} orientation="w" mode="play" />);
  const grid = screen.getByRole('application', { name: 'Chess board, white at the bottom' });
  fireEvent.keyDown(grid, { key: 'ArrowRight' });
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/b1/);
  expect(grid).toHaveAttribute('aria-label', 'Chess board, white at the bottom');
});

// --- M-1: cursor resets on orientation change ---

test('orientation b starts the cursor at h8 and ArrowUp moves away from the player', () => {
  const onSelect = vi.fn();
  render(<Board fen={START_FEN} orientation="b" mode="select" onSelectSquare={onSelect} />);
  const grid = screen.getByRole('application', { name: 'Chess board, black at the bottom' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelect).toHaveBeenLastCalledWith('h8');
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/h7/);
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelect).toHaveBeenLastCalledWith('h7');
});

test('cursor resets when orientation changes', () => {
  const onSelect = vi.fn();
  const { rerender } = render(<Board fen={START_FEN} orientation="w" mode="select" onSelectSquare={onSelect} />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  fireEvent.keyDown(grid, { key: 'ArrowRight' });
  rerender(<Board fen={START_FEN} orientation="b" mode="select" onSelectSquare={onSelect} />);
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelect).toHaveBeenLastCalledWith('h8');
});

// --- M-5: select mode never emits moves ---

test('select mode: Enter on e2 then e4 does not call onMove', () => {
  const onMove = vi.fn();
  const onSelect = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="select" onMove={onMove} onSelectSquare={onSelect} />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  for (let i = 0; i < 4; i++) fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' }); fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onMove).not.toHaveBeenCalled();
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(onSelect).toHaveBeenNthCalledWith(1, 'e2');
  expect(onSelect).toHaveBeenNthCalledWith(2, 'e4');
});

// --- M-1b: the selected square resets with the cursor on an orientation change ---

function selectedSquares(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>('[style]')).filter((el) =>
    /rgba\(\s*31,\s*95,\s*74,\s*0\.35\s*\)/.test(el.getAttribute('style') ?? ''),
  );
}

test('flipping the board clears the selected square, not just the cursor', () => {
  const onMove = vi.fn();
  const { container, rerender } = render(
    <Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} />,
  );
  const grid = screen.getByRole('application', { name: /chess board/i });
  // a1 -> e2, then select the pawn there
  for (let i = 0; i < 4; i++) fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/Selected e2/);
  expect(selectedSquares(container)).toHaveLength(1);

  rerender(<Board fen={START_FEN} orientation="b" mode="play" onMove={onMove} />);
  expect(selectedSquares(container)).toHaveLength(0);

  // the cursor is back home at h8; activating it describes the square rather
  // than reporting an illegal move from a piece the user is no longer holding.
  fireEvent.keyDown(grid, { key: 'Enter' });
  const status = screen.getByRole('status', { name: 'Board announcements' });
  expect(status).not.toHaveTextContent(/Not a legal move/);
  expect(status).toHaveTextContent(/h8/);
  expect(onMove).not.toHaveBeenCalled();
});

// F-AX-1: unit 1.1's board-vision lessons run on an empty (kingless) board in
// select mode. Answering a which_square challenge must accept the answer AND
// update the live status region -- it used to throw "Invalid FEN: missing
// white king" out of the handler, leaving the screen-reader readout dead.
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

test('select mode on an empty board: text entry answers and announces', async () => {
  const onSelectSquare = vi.fn();
  render(<Board fen={EMPTY_FEN} orientation="w" mode="select" onSelectSquare={onSelectSquare} textEntry />);
  await userEvent.type(screen.getByLabelText('Type a move'), 'e4{enter}');
  expect(onSelectSquare).toHaveBeenCalledWith('e4');
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent('e4, empty');
});

test('keyboard cursor announces squares on an empty board', async () => {
  const onSelectSquare = vi.fn();
  render(<Board fen={EMPTY_FEN} orientation="w" mode="select" onSelectSquare={onSelectSquare} />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  await waitFor(() =>
    expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent('b2, empty'),
  );
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelectSquare).toHaveBeenCalledWith('b2');
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent('b2, empty');
});

import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from './Board';
import { START_FEN } from '@/rules';
import { resolveBoardPalette, withAlpha } from './boardColors';

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

// A3: the selected fill is `--mark-good` at 0.35, not a literal. The expected
// string is derived the same way the component derives it, so this matcher
// follows a token change instead of pinning one appearance's hex.
function selectedSquares(root: HTMLElement) {
  const fill = withAlpha(resolveBoardPalette()['--mark-good'], 0.35);
  return Array.from(root.querySelectorAll<HTMLElement>('[style]')).filter((el) =>
    (el.getAttribute('style') ?? '').includes(fill),
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

test('board pieces are not announced as unnamed buttons', async () => {
  const { container } = render(<Board fen={START_FEN} orientation="w" mode="play" />);
  await waitFor(() => {
    expect(container.querySelectorAll('[aria-roledescription="draggable"]').length).toBeGreaterThan(0);
  });
  expect(container.querySelectorAll('[role="button"]').length).toBe(0);
});

/*
 * D1 -- the refutation replay. These assert the contract the design document
 * sets for it, not the pixels: it plays, it can be got out of, and the
 * reduced-motion path carries the same information rather than less of it.
 */
const REPLAY = {
  fen: START_FEN,
  // The learner's wrong move, then the answer to it.
  moves: ['f2f3', 'e7e5'],
  san: 'e5',
};

/**
 * jsdom ships no `matchMedia` in this environment, which is why Board calls it
 * optionally; define one rather than spy on a function that is not there.
 */
function reduceMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) =>
      ({
        matches: reduce && q.includes('reduced-motion'),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

function clearReduceMotion() {
  Reflect.deleteProperty(window, 'matchMedia');
}

test('the refutation replay runs, announces the move in SAN, and gives the position back', () => {
  vi.useFakeTimers();
  // react-chessboard measures a square to animate a piece between two of them
  // and throws outright when the measurement is zero, which is every element in
  // jsdom. Give it a square; the animated path is the one under test here.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 48, height: 48, top: 0, left: 0, right: 48, bottom: 48, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
  render(<Board fen={START_FEN} orientation="w" mode="play" replay={REPLAY} />);

  // It is running: the board says so and offers the way out of it.
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();

  act(() => { vi.advanceTimersByTime(1100); }); // both slides landed
  // The SAN announcement is the accessible carrier of the whole moment.
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/Replay: e5/);

  act(() => { vi.advanceTimersByTime(1400); }); // the hold expires
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('Skip ends the replay at once', () => {
  vi.useFakeTimers();
  render(<Board fen={START_FEN} orientation="w" mode="play" replay={REPLAY} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('a key at the board skips the replay instead of moving the cursor through it', () => {
  vi.useFakeTimers();
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} replay={REPLAY} />);
  fireEvent.keyDown(screen.getByRole('application', { name: /chess board/i }), { key: 'ArrowRight' });
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  expect(onMove).not.toHaveBeenCalled();
  vi.useRealTimers();
});

test('reduced motion gets the same information, held for longer rather than animated', () => {
  vi.useFakeTimers();
  reduceMotion(true);
  render(<Board fen={START_FEN} orientation="w" mode="play" replay={REPLAY} />);

  // No travel to wait through: the announcement and the marked position are
  // there on the first tick, not after two slides.
  act(() => { vi.advanceTimersByTime(0); });
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/Replay: e5/);
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();

  // And it is held for two seconds, not the 1.2 the animated path uses, so
  // there is MORE time to read it, not less.
  act(() => { vi.advanceTimersByTime(1500); });
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(600); });
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  clearReduceMotion();
  vi.useRealTimers();
});

test('a replay that does not fit its position is dropped rather than half-played', () => {
  vi.useFakeTimers();
  render(<Board fen={START_FEN} orientation="w" mode="play" replay={{ fen: START_FEN, moves: ['e7e5'], san: 'e5' }} />);
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('a move typed during a replay is played, not swallowed by the skip', () => {
  vi.useFakeTimers();
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} replay={REPLAY} textEntry />);
  // The text field is not the board: an answer typed while the replay is still
  // running is an answer, and it must survive ending the replay. (Regression:
  // it did not, and every checkpoint question -- where the engine refutation
  // fires and a retry is typed straight afterwards -- lost its retry.)
  fireEvent.change(screen.getByLabelText('Type a move'), { target: { value: 'e4' } });
  fireEvent.submit(screen.getByLabelText('Type a move').closest('form')!);
  expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' });
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  vi.useRealTimers();
});

/*
 * PREMIUM-DELTA.md Δ1 rule 4 -- elevation stops at the board's edge.
 *
 * This is a guard, not a restyle: the board is already correct and must stay
 * correct. Both reference products frame their board with literally nothing
 * (PREMIUM-DELTA.md §1.1 measured chess.com's hero board at `box-shadow: none`,
 * `border: 0px none`, transparent background), and a chess board with a drop
 * shadow stops being a board and becomes a photograph of one. The premium pass
 * adds --key-accent and --key-raised edges to cards and controls; this test
 * exists so a later chunk cannot sweep the board up with them.
 *
 * What is deliberately NOT banned: the marks. `accent` is `inset 0 0 0 5px` and
 * the review ring is `inset 0 0 0 3px` -- inset, zero blur, and the carriers of
 * meaning that DESIGN-SYSTEM.md §7 requires kept exactly. The rule is about
 * ELEVATION, so it bans outer shadows, any blur radius at all, radii and the key
 * edges, and leaves zero-blur inset rings alone.
 */

const BLUR_CAP_PX = 4;

/** Every non-inset shadow layer, and every layer whose blur is above the cap. */
function elevationShadows(el: HTMLElement): string[] {
  const raw = el.style.boxShadow;
  if (!raw) return [];
  return raw
    .split(/,(?![^()]*\))/)
    .map((layer) => layer.trim())
    .filter((layer) => {
      if (!layer) return false;
      // Strip the colour first -- `rgba(0, 0, 0, 0.2)` is full of numbers that
      // are not lengths -- then read the remaining numeric tokens in order.
      // Unitless zeros are lengths too: `inset 0 0 12px red` has blur 12, and a
      // parser that only matched `\d+px` would silently read it as blur 0.
      const lengths = [
        ...layer
          .replace(/(rgba?|hsla?|color|var)\([^)]*\)/gi, ' ')
          .replace(/#[0-9a-f]{3,8}/gi, ' ')
          .matchAll(/(-?\d*\.?\d+)(px|r?em)?(?=\s|$)/g),
      ].map((m) => Number(m[1]));
      // offset-x, offset-y, blur, spread -- blur is the third length when present.
      const blur = lengths[2] ?? 0;
      return !/\binset\b/.test(layer) || blur > BLUR_CAP_PX;
    });
}

/** `className` is an SVGAnimatedString on SVG nodes, so read the attribute. */
function classOf(el: Element): string {
  return el.getAttribute('class') ?? '';
}

/**
 * The board proper: its own outer box plus the grid and everything the grid
 * paints. Deliberately NOT the whole of `[data-board-root]` -- the replay's
 * Skip control is transient chrome that sits over the board rather than part
 * of it, and it is allowed a radius like any other control.
 */
function boardElements(container: HTMLElement): HTMLElement[] {
  const root = container.querySelector<HTMLElement>('[data-board-root]');
  expect(root, 'the board root must be findable for this guard to mean anything').not.toBeNull();
  const grid = root!.querySelector<HTMLElement>('[role="application"]');
  expect(grid, 'the board grid must be findable for this guard to mean anything').not.toBeNull();
  return [root!, grid!, ...grid!.querySelectorAll<HTMLElement>('*')];
}

test.each(['light', 'dark'] as const)(
  '%s: the board, its squares and its marks carry no elevation -- no shadow, no blur, no radius, no key edge',
  (appearance) => {
    reduceMotion(false);
    if (appearance === 'dark') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (q: string) =>
          ({
            matches: q.includes('prefers-color-scheme: dark'),
            media: q,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            onchange: null,
            dispatchEvent: () => false,
          }) as unknown as MediaQueryList,
      });
    }
    try {
      const { container } = render(<Board fen={START_FEN} orientation="w" mode="play" />);
      const els = boardElements(container);
      // The guard is only as good as its reach: a selector that matched nothing
      // would pass this test in silence (observation 0032).
      expect(els.length).toBeGreaterThan(1);

      for (const el of els) {
        expect(elevationShadows(el), `box-shadow on ${el.tagName}.${classOf(el)}`).toEqual([]);
        expect(el.style.borderRadius, `border-radius on ${el.tagName}.${classOf(el)}`).toBe('');
        for (const key of ['--key-accent', '--key-raised'] as const) {
          expect(
            `${el.getAttribute('style') ?? ''} ${classOf(el)}`,
            `${key} must not reach the board`,
          ).not.toContain(key.replace('--', ''));
        }
        expect(classOf(el), `rounded-* must not reach the board`).not.toMatch(/(^|\s)rounded(-|$)/);
      }
    } finally {
      clearReduceMotion();
    }
  },
);

test('the guard can fail: an outer shadow, a >4px blur or a radius on a board element is caught', () => {
  // The negative control. Without it, a selector that drifted off the board
  // would leave the test above green forever (observation 0059).
  const { container } = render(<Board fen={START_FEN} orientation="w" mode="play" />);
  const root = container.querySelector<HTMLElement>('[data-board-root]')!;

  root.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
  expect(elevationShadows(root)).toHaveLength(1);

  root.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.2)';
  expect(elevationShadows(root)).toHaveLength(1);

  // ...and the marks the board really does draw are NOT caught.
  root.style.boxShadow = 'inset 0 0 0 5px rgb(11, 61, 46)';
  expect(elevationShadows(root)).toEqual([]);
  root.style.boxShadow = 'inset 0 0 0 3px rgb(74, 51, 6)';
  expect(elevationShadows(root)).toEqual([]);

  root.style.boxShadow = '';
  root.style.borderRadius = '10px';
  expect(root.style.borderRadius).toBe('10px'); // the property the guard reads is live
});

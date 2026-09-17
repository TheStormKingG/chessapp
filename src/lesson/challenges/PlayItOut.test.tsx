import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { PlayItOut } from './PlayItOut';
import type { PlayItOut as PlayItOutChallenge } from './goal';

// react-chessboard needs a laid-out DOM ("Square width not found" in jsdom the
// moment the FEN changes), so the board is a stub: the drill's own state is
// what these tests are about.
const board = vi.hoisted(() => ({ move: { from: 'e1', to: 'e2', uci: 'e1e2', san: 'Ke2' } }));
vi.mock('@/board', () => ({
  Board: ({
    fen,
    disabled,
    onMove,
    highlights,
  }: {
    fen: string;
    disabled?: boolean;
    highlights?: Record<string, string>;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      <span data-testid="highlights">{Object.keys(highlights ?? {}).sort().join(',')}</span>
      <button type="button" disabled={disabled} onClick={() => onMove?.(board.move)}>
        play
      </button>
    </div>
  ),
}));

const engine = vi.hoisted(() => ({ bestMove: vi.fn() }));
vi.mock('@/engine', () => ({ getEngine: () => engine }));

const analytics = vi.hoisted(() => ({ track: vi.fn(), reportError: vi.fn() }));
vi.mock('@/analytics', () => analytics);

// The drill is wrapped in the engine-download gate (F-OF-2); a cached engine
// resolves at once, which is what every test here assumes.
function cachedEngine(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(8));
      c.close();
    },
  });
  return new Response(body, { headers: { 'content-length': '8' } });
}

// Black has a pawn one square from queening: the learner's own move leaves the
// drill running, and only the engine's reply settles it (a promotion loses a hold).
const FEN = '4k3/8/8/8/8/8/1p6/4K3 w - - 0 1';
const drill: PlayItOutChallenge = {
  id: 'p1',
  type: 'play_it_out',
  fen: FEN,
  prompt: 'Hold the draw',
  concept: 'endgame',
  goal: { kind: 'hold', moves: 5 },
};

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(cachedEngine());
  analytics.reportError.mockReset();
  engine.bestMove.mockReset();
  board.move = { from: 'e1', to: 'e2', uci: 'e1e2', san: 'Ke2' };
});

test('an engine reply that lands after unmount reports no result', async () => {
  let resolve: (uci: string) => void = () => {};
  engine.bestMove.mockReturnValue(
    new Promise<string>((r) => {
      resolve = r;
    }),
  );
  const onResult = vi.fn();
  const { unmount } = render(<PlayItOut c={drill} onResult={onResult} />);

  await userEvent.click(await screen.findByRole('button', { name: 'play' }));
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  expect(engine.bestMove).toHaveBeenCalled();

  // The learner leaves the drill (Show me, then Next) while the engine thinks.
  unmount();
  await act(async () => {
    resolve('b2b1q');
    await new Promise((r) => setTimeout(r, 0));
  });

  // The next challenge must not be charged a miss by the dead drill.
  expect(onResult).not.toHaveBeenCalled();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('an engine that cannot reply explains itself, holds the board and retries', async () => {
  engine.bestMove.mockRejectedValueOnce(new Error('engine gone')).mockResolvedValueOnce('b2b1q');
  const onResult = vi.fn();
  render(<PlayItOut c={drill} onResult={onResult} />);

  const play = await screen.findByRole('button', { name: 'play' });
  await userEvent.click(play);

  // F-ER-1: one plain line, not a board that silently refuses every move.
  expect(await screen.findByRole('alert')).toHaveTextContent('The engine could not answer your move.');
  expect(screen.getByRole('button', { name: 'play' })).toBeDisabled();
  expect(analytics.reportError).toHaveBeenCalledWith(expect.any(Error), { where: 'play-it-out-reply' });

  const stuckFen = screen.getByTestId('fen').textContent ?? '';
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  // The retry asked about the position the learner reached, and the drill settled.
  expect(engine.bestMove).toHaveBeenLastCalledWith(expect.objectContaining({ fen: stuckFen }));
  expect(onResult).toHaveBeenCalled();
});

test('the drill board shows the squares the reveal marks', async () => {
  render(<PlayItOut c={drill} onResult={() => undefined} highlights={{ b2: 'accent', e1: 'selected' }} />);
  await waitFor(() => {
    expect(screen.getByTestId('highlights')).toHaveTextContent('b2,e1');
  });
});

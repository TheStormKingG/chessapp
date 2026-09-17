import { render, screen } from '@testing-library/react';
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
  }: {
    fen: string;
    disabled?: boolean;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      <button type="button" disabled={disabled} onClick={() => onMove?.(board.move)}>
        play
      </button>
    </div>
  ),
}));

const engine = vi.hoisted(() => ({ bestMove: vi.fn() }));
vi.mock('@/engine', () => ({ getEngine: () => engine }));

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

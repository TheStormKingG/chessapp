import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyMomentView } from './KeyMomentView';
import type { KeyMoment, ReviewedMove } from './types';

// The same technique src/lesson/LessonPlayer.board.test.tsx uses: react-chessboard
// throws "Square width not found" in jsdom, so the shared Board is stubbed and
// what these tests assert is the position, the announcement and the move the
// screen hands it. The stub deliberately renders NO live region, so the
// `aria-live` assertion below measures what THIS component adds — the real
// Board owns the screen's single region, and that is checked in the browser.
const board = vi.hoisted(() => ({ move: { from: 'a2', to: 'a3', uci: 'a2a3', san: 'a3' } }));
vi.mock('@/board', () => ({
  Board: ({
    fen,
    orientation,
    mode,
    announce,
    onMove,
    testId,
  }: {
    fen: string;
    orientation?: string;
    mode?: string;
    announce?: string;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
    testId?: string;
  }) => (
    <div data-testid={testId} data-fen={fen} data-orientation={orientation} data-mode={mode}>
      <span data-testid="announce">{announce}</span>
      <button type="button" onClick={() => onMove?.(board.move)}>play</button>
    </div>
  ),
}));

const move: ReviewedMove = {
  ply: 10,
  san: 'Qh5',
  uci: 'd1h5',
  fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 1',
  mover: 'w',
  best: { uci: 'g1f3', san: 'Nf3' },
  winBefore: 55,
  winAfterPlayed: 25,
  drop: 30,
  accuracy: 20,
  label: 'Blunder',
  book: false,
  phase: 'opening',
};

const moment: KeyMoment = {
  ply: 10,
  kind: 'decided',
  deeper: null,
  explanation: 'Nf3 was stronger than Qh5 here.',
  lessonId: null,
};

const props = {
  move,
  moment,
  learner: 'w' as const,
  ask: 'You played Qh5. There was a stronger move — have a go.',
  index: 0,
  total: 3,
  onNext: () => {},
  onLesson: () => {},
};

beforeEach(() => {
  board.move = { from: 'a2', to: 'a3', uci: 'a2a3', san: 'a3' };
});

test('the position shown is the one BEFORE the learner’s move', () => {
  render(<KeyMomentView {...props} />);
  expect(screen.getByTestId('review-board')).toHaveAttribute('data-fen', move.fenBefore);
});

test('the board is oriented to the learner', () => {
  render(<KeyMomentView {...props} />);
  expect(screen.getByTestId('review-board')).toHaveAttribute('data-orientation', 'w');
});

test('the answer is not on screen until the learner asks or tries', () => {
  render(<KeyMomentView {...props} />);
  expect(screen.queryByText(/Nf3/)).not.toBeInTheDocument();
  expect(screen.getByText(/have a go/i)).toBeVisible();
});

test('a wrong try does not reveal the answer', async () => {
  render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  expect(screen.queryByText(/Nf3/)).not.toBeInTheDocument();
  expect(screen.getByText(/another go/i)).toBeVisible();
});

test('a wrong try is announced through the board’s own region', async () => {
  render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  expect(screen.getByTestId('announce')).toHaveTextContent(/a3 is not it/i);
});

test('the right move reveals without needing Show me', async () => {
  board.move = { from: 'g1', to: 'f3', uci: 'g1f3', san: 'Nf3' };
  render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  // `strong` is the semantic emphasis the reveal paragraph gives the answer,
  // not a presentation class: /Nf3/ alone also matches the explanation text.
  expect(screen.getByText('Nf3', { selector: 'strong' })).toBeVisible();
});

test('Show me reveals the better move and the explanation', async () => {
  render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.getByText('Nf3', { selector: 'strong' })).toBeVisible();
  expect(screen.getByText(/stronger than Qh5/)).toBeVisible();
});

test('a moment with no explanation reveals the move and says nothing else', async () => {
  render(<KeyMomentView {...props} moment={{ ...moment, explanation: null }} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.getByText('Nf3', { selector: 'strong' })).toBeVisible();
  // No invented sentence in place of the missing one.
  expect(screen.queryByText(/stronger/i)).not.toBeInTheDocument();
});

test('the lesson link appears only when the moment has a lesson', async () => {
  const { rerender } = render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.queryByRole('button', { name: /replay/i })).not.toBeInTheDocument();
  rerender(<KeyMomentView {...props} moment={{ ...moment, lessonId: '1.3.1' }} />);
  expect(screen.getByRole('button', { name: /replay/i })).toBeVisible();
});

test('position in the run is stated', () => {
  render(<KeyMomentView {...props} />);
  expect(screen.getByText(/1 of 3/i)).toBeVisible();
});

test('the last moment finishes rather than offering a next one', async () => {
  render(<KeyMomentView {...props} index={2} total={3} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.getByRole('button', { name: /finish/i })).toBeVisible();
});

test('Great and Brilliant are omitted while the deeper pass has not landed', async () => {
  render(<KeyMomentView {...props} move={{ ...move, label: 'Best' }} moment={{ ...moment, deeper: null }} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.queryByText('Great')).not.toBeInTheDocument();
  expect(screen.queryByText('Brilliant')).not.toBeInTheDocument();
});

test('this screen adds no live region of its own — the board owns the only one', () => {
  const { container } = render(<KeyMomentView {...props} />);
  expect(container.querySelectorAll('[aria-live]')).toHaveLength(0);
  expect(screen.getAllByTestId('review-board')).toHaveLength(1);
});

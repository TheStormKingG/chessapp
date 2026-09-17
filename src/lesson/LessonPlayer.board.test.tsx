import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '@/app/settings';
import { LessonPlayer } from './LessonPlayer';
import type { Lesson } from './types';

// react-chessboard throws "Square width not found" in jsdom as soon as the FEN
// changes, so the board is stubbed: what these tests assert is the position,
// the arrows and the move count the player hands it.
const board = vi.hoisted(() => ({ move: { from: 'e2', to: 'e3', uci: 'e2e3', san: 'Qe3' } }));
vi.mock('@/board', () => ({
  Board: ({
    fen,
    arrows = [],
    disabled,
    onMove,
  }: {
    fen: string;
    arrows?: { from: string; to: string; color?: string }[];
    disabled?: boolean;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      <span data-testid="arrows">{arrows.map((a) => `${a.from}${a.to}:${a.color ?? ''}`).join(',')}</span>
      <button type="button" disabled={disabled} onClick={() => onMove?.(board.move)}>
        play
      </button>
    </div>
  ),
}));

const engine = vi.hoisted(() => ({ bestMove: vi.fn() }));
vi.mock('@/engine', () => ({ getEngine: () => engine }));

const MATE_FEN = '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1';
const SEQ_FEN = '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1';

// A play_it_out drill mounts behind the engine-download gate (F-OF-2). A cached
// engine resolves at once, which is the state these tests are written against.
function cachedEngine(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(8));
      c.close();
    },
  });
  return new Response(body, { headers: { 'content-length': '8' } });
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(cachedEngine());
  engine.bestMove.mockReset();
  board.move = { from: 'e2', to: 'e3', uci: 'e2e3', san: 'Qe3' };
  useSettings.setState({ coachMuted: false });
});

const drillLesson: Lesson = {
  id: '9.9.3',
  unit: '9.9',
  title: 'Finish it',
  xp: 5,
  card: { idea: 'Mate in one', diagrams: [] },
  explain: [],
  challenges: [
    {
      id: 'd1',
      type: 'play_it_out',
      fen: MATE_FEN,
      prompt: 'Mate in one',
      concept: 'mate',
      goal: { kind: 'mate_in', moves: 1 },
    },
  ],
  takeaway: 'Finish cleanly.',
};

test('a failed play_it_out drill restarts on the retry', async () => {
  engine.bestMove.mockResolvedValue('e8d8');
  render(<LessonPlayer lesson={drillLesson} onComplete={() => {}} onExit={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  expect(screen.getByTestId('fen')).toHaveTextContent(MATE_FEN);

  // The one move allowed is not mate: the goal fails and the machine offers a retry.
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  expect(screen.getByText(/try again/i)).toBeInTheDocument();

  // The retry has to be playable: the starting position back, the moves unspent.
  expect(screen.getByTestId('fen')).toHaveTextContent(MATE_FEN);
  expect(screen.getByText(/Moves used: 0 of 1/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'play' })).toBeEnabled();

  // And the restarted drill can still settle -- a second miss reveals the answer.
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  expect(screen.getByText(/Here is the idea/)).toBeInTheDocument();
});

const seqLesson: Lesson = {
  id: '9.9.4',
  unit: '9.9',
  title: 'The line',
  xp: 5,
  card: { idea: 'Play the line', diagrams: [] },
  explain: [],
  challenges: [
    {
      id: 'q1',
      type: 'find_the_sequence',
      fen: SEQ_FEN,
      prompt: 'Play the line',
      concept: 'mate',
      answer: { line: ['e2e7'] },
    },
  ],
  takeaway: 'Lines are forced.',
};

async function playWrongMove(): Promise<void> {
  render(<LessonPlayer lesson={seqLesson} onComplete={() => {}} onExit={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
}

test('F-PA-6: the engine refutation is drawn on a find_the_sequence board', async () => {
  engine.bestMove.mockResolvedValue('e8d8');
  await playWrongMove();
  expect(await screen.findByText('e8d8:danger')).toBeInTheDocument();
});

test('a muted coach still gets the refutation arrow, just no spoken line', async () => {
  useSettings.setState({ coachMuted: true });
  engine.bestMove.mockResolvedValue('e8d8');
  await playWrongMove();
  expect(await screen.findByText('e8d8:danger')).toBeInTheDocument();
  // The written retry line stays; nothing the coach would have said is added.
  expect(screen.getByText(/try again/i)).toBeInTheDocument();
});

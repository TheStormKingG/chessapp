import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '@/app/settings';
import { applyMove } from '@/rules';
import { DailyPuzzle } from './DailyPuzzle';
import { dailyIndex, localDateKey } from './daily';
import type { Puzzle } from './types';

/* Stubbed for the reason `PuzzlePlayer.test.tsx` states: react-chessboard
   throws "Square width not found" in jsdom the moment the FEN changes. */
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

beforeEach(() => {
  useSettings.setState({ textEntry: true });
});

/** Four positions that differ only in the move number, so each has its own FEN. */
const pack: Puzzle[] = [0, 1, 2, 3].map((n) => ({
  id: `d${String(n)}`,
  rating: 900,
  themes: ['fork'],
  fen: `8/8/8/8/8/8/8/K6k w - - 0 ${String(n + 1)}`,
  solution: ['a1a2', 'h1h2'],
}));

const TODAY = new Date(2026, 8, 19);
const KEY = localDateKey(TODAY);
const todays = pack[dailyIndex(KEY, pack.length)]!;
/** The position the learner is asked about: after the opponent's move. */
const ASKED = applyMove(todays.fen, todays.solution[0]!).fen;

test('the puzzle is the one the date picks, with no network and no server', async () => {
  render(<DailyPuzzle pack={pack} solvedDays={[]} today={TODAY} onAttempt={vi.fn()} />);
  await screen.findByLabelText('Type a move');
  expect(screen.getByTestId('fen').textContent).toBe(ASKED);
});

test('an attempt is recorded as the daily puzzle', async () => {
  const onAttempt = vi.fn();
  render(<DailyPuzzle pack={pack} solvedDays={[]} today={TODAY} onAttempt={onAttempt} />);
  const field = await screen.findByLabelText('Type a move');
  await userEvent.type(field, 'h1h2{enter}');
  expect(onAttempt).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'daily', solved: true, puzzleId: todays.id }),
  );
});

/**
 * F-PZ-6: three attempts. The learner gets three, not unlimited retries —
 * which is what makes the daily puzzle worth anything as a daily puzzle.
 */
test('two wrong moves leave the puzzle open', async () => {
  const onAttempt = vi.fn();
  render(<DailyPuzzle pack={pack} solvedDays={[]} today={TODAY} onAttempt={onAttempt} />);
  const field = await screen.findByLabelText('Type a move');
  await userEvent.type(field, 'h1g1{enter}');
  await userEvent.type(field, 'h1g2{enter}');
  expect(onAttempt).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Type a move')).toBeInTheDocument();
});

test('the third wrong move ends it, unsolved', async () => {
  const onAttempt = vi.fn();
  render(<DailyPuzzle pack={pack} solvedDays={[]} today={TODAY} onAttempt={onAttempt} />);
  const field = await screen.findByLabelText('Type a move');
  await userEvent.type(field, 'h1g1{enter}');
  await userEvent.type(field, 'h1g2{enter}');
  // The king has exactly three moves and one of them is the answer, so a
  // third wrong attempt is a repeat — which is what a stuck learner does.
  await userEvent.type(field, 'h1g1{enter}');
  expect(onAttempt).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'daily', solved: false, misses: 3 }),
  );
});

test('the attempts left are stated before they are spent, not after', async () => {
  render(<DailyPuzzle pack={pack} solvedDays={[]} today={TODAY} onAttempt={vi.fn()} />);
  const field = await screen.findByLabelText('Type a move');
  expect(screen.getByText(/3 attempts/i)).toBeInTheDocument();
  await userEvent.type(field, 'h1g1{enter}');
  expect(screen.getByText(/2 attempts/i)).toBeInTheDocument();
});

test('a day already solved is not offered again, and says so', () => {
  render(<DailyPuzzle pack={pack} solvedDays={[KEY]} today={TODAY} onAttempt={vi.fn()} />);
  expect(screen.queryByLabelText('Type a move')).not.toBeInTheDocument();
  expect(screen.getByText(/already solved/i)).toBeInTheDocument();
});

test('the calendar marks the days that were solved', () => {
  render(
    <DailyPuzzle pack={pack} solvedDays={['2026-09-01', '2026-09-17']} today={TODAY} onAttempt={vi.fn()} />,
  );
  const cal = screen.getByRole('list', { name: /september 2026/i });
  expect(cal).toBeInTheDocument();
  expect(screen.getByRole('listitem', { name: /^1 September, solved$/ })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { name: /^17 September, solved$/ })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { name: /^2 September, not solved$/ })).toBeInTheDocument();
  // September has 30 days, and the calendar shows the month it is in.
  expect(cal.querySelectorAll('li')).toHaveLength(30);
});

test('an empty pack says there is no daily puzzle rather than opening an empty board', () => {
  render(<DailyPuzzle pack={[]} solvedDays={[]} today={TODAY} onAttempt={vi.fn()} />);
  expect(screen.queryByLabelText('Type a move')).not.toBeInTheDocument();
  expect(screen.getByText(/no daily puzzle/i)).toBeInTheDocument();
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '@/app/settings';
import { ThemedPractice } from './ThemedPractice';
import { THEME_DEFINITION, THEMES } from './themes';
import type { Puzzle } from './types';

/* The shared board is stubbed for the reason `PuzzlePlayer.test.tsx` states:
   react-chessboard throws "Square width not found" in jsdom the moment the FEN
   changes, and the opponent's move changes it. */
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

/* Text move entry is the non-visual path (F-AX / spec §5.5) and it is how a
   test drives a board it cannot see. It is a SETTING, not a prop of this
   screen, so it is set the way the lesson's board tests set theirs. */
beforeEach(() => {
  useSettings.setState({ textEntry: true });
});

const FEN = '8/8/8/8/8/8/8/K6k w - - 0 1';
const p = (id: string, rating: number, themes: Puzzle['themes']): Puzzle => ({
  id,
  rating,
  themes,
  fen: FEN,
  solution: ['a1a2', 'h1h2'],
});

const POOL: Puzzle[] = [
  p('f1', 700, ['fork']),
  p('f2', 1000, ['fork']),
  p('s1', 1000, ['skewer']),
  p('b1', 700, ['backRankMate']),
];

async function pick(themeLabel: string) {
  await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(themeLabel, 'i') }));
}

test('every theme is offered with its one-sentence definition (F-PZ-2)', () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} />);
  for (const theme of THEMES) {
    expect(screen.getByText(THEME_DEFINITION[theme]), theme).toBeInTheDocument();
  }
});

test('there is no timer and no rating on the practice screen (F-PZ-2)', async () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} />);
  await pick('Fork');
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  await screen.findByLabelText('Type a move');
  expect(screen.queryByText(/\b\d+:\d\d\b/)).not.toBeInTheDocument(); // no clock
  expect(screen.queryByText(/1000|700/)).not.toBeInTheDocument(); // no rating
});

/**
 * The load-bearing one. F-PZ-2 says themed practice has no rating impact, and
 * the projection can only honour that if the attempt is recorded as themed —
 * so what this asserts is the field the projection reads, not a number on a
 * screen that nothing consumes.
 */
test('an attempt from themed practice is recorded as themed, so it cannot move the rating', async () => {
  const onAttempt = vi.fn();
  render(<ThemedPractice pool={POOL} onAttempt={onAttempt} />);
  await pick('Fork');
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  const field = await screen.findByLabelText('Type a move');
  await userEvent.type(field, 'h1h2{enter}');
  expect(onAttempt).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'themed', solved: true, ratingCounts: false }),
  );
});

test('the practice is drawn only from the chosen themes and the chosen band', async () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} />);
  await pick('Fork');
  await userEvent.selectOptions(screen.getByLabelText(/band/i), '900-1200');
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  await screen.findByLabelText('Type a move');
  // f2 is the only fork in 900-1200; f1 is a fork below the band and s1 is in
  // the band but the wrong theme.
  expect(screen.getByTestId('count')).toHaveTextContent('1');
});

test('more than one theme can be practised at once', async () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} />);
  await pick('Fork');
  await pick('Skewer');
  await userEvent.selectOptions(screen.getByLabelText(/band/i), '900-1200');
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  await screen.findByLabelText('Type a move');
  expect(screen.getByTestId('count')).toHaveTextContent('2');
});

test('practice cannot be started with no theme chosen', () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} />);
  expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
});

/**
 * A theme with nothing in the chosen band is a real case, not an error: the
 * packs are filtered and some motifs simply do not appear low down. It must say
 * so rather than presenting an empty board.
 */
test('a combination with no puzzles says so rather than opening an empty board', async () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} />);
  await pick('Back-rank mate');
  await userEvent.selectOptions(screen.getByLabelText(/band/i), '1200-1500');
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  expect(screen.getByText(/no puzzles/i)).toBeInTheDocument();
  expect(screen.queryByLabelText('Type a move')).not.toBeInTheDocument();
});

/**
 * F-PZ-2 d ends at this prop. The lesson close screen links to
 * `/puzzles/themed?theme=<theme>`, and a link whose destination cannot act on
 * what it was given is a link that only looks like it works.
 */
test('practice can be opened with a theme already chosen', async () => {
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} initialThemes={['fork']} />);
  expect(screen.getByRole('checkbox', { name: /fork/i })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /skewer/i })).not.toBeChecked();
  const start = screen.getByRole('button', { name: /start/i });
  expect(start).toBeEnabled();
  await userEvent.click(start);
  await screen.findByLabelText('Type a move');
});

test('a theme the packs do not carry is ignored rather than trusted', () => {
  // The value arrives from a URL, so it is not a `Theme` until it is checked.
  render(<ThemedPractice pool={POOL} onAttempt={vi.fn()} initialThemes={['nonsense'] as never} />);
  expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
});

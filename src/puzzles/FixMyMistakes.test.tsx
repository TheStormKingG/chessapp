import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { useSettings } from '@/app/settings';
import type { ErrorEntry } from '@/review/types';
import { FixMyMistakes } from './FixMyMistakes';
import { buildQueue } from './queue';
import type { Puzzle } from './types';

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

const POSITION = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';

function err(o: Partial<ErrorEntry> = {}): ErrorEntry {
  return {
    gameId: 'g1',
    ply: 4,
    fenBefore: POSITION,
    playedSan: 'Qh5',
    bestSan: 'Nf3',
    bestUci: 'g1f3',
    label: 'Blunder',
    theme: 'unclassified',
    phase: 'opening',
    clockMs: null,
    lessonId: null,
    typical: false,
    createdAt: '2026-09-19T00:00:00.000Z',
    ...o,
  };
}

const POOL: Puzzle[] = [];
const RATING = { rating: 800, confidence: 0.2 };

function show(errors: ErrorEntry[], onAttempt = vi.fn()) {
  return showWith(errors, POOL, onAttempt);
}

/**
 * The same render, with a pool that genuinely produces `source: 'similar'`
 * drills. `POOL` above is empty and stays empty — every test written before
 * this one depends on it being empty, and the drill counts they assert would
 * change under it.
 */
function showWith(errors: ErrorEntry[], pool: Puzzle[], onAttempt = vi.fn()) {
  const queue = buildQueue({ errors, pool, rating: RATING, seen: new Set<string>() });
  render(
    <MemoryRouter>
      <FixMyMistakes queue={queue} onAttempt={onAttempt} />
    </MemoryRouter>,
  );
  return queue;
}

/* A two-king position whose solution is legal from it, so a similar drill can
   actually be played: `firstLearnerPly` 1 means a1a2 is the opponent's and
   h1h2 is the learner's. `mateIn1` is the only theme `DRILL_THEME` maps a
   review theme onto, and 800 is `RATING.rating`, so these land inside the
   ±150 span F-PZ-3 defines "similar" by. */
const SIMILAR_FEN = '8/8/8/8/8/8/8/K6k w - - 0 1';
const similarPool = (): Puzzle[] =>
  ['s1', 's2', 's3', 's4'].map((id, i) => ({
    id,
    rating: 790 + i,
    themes: ['mateIn1'] as Puzzle['themes'],
    fen: SIMILAR_FEN,
    solution: ['a1a2', 'h1h2'],
  }));

/**
 * The unclassified path is the COMMON one: the review tagger implements four
 * of PRD §10.3's sixteen motifs, so most of a learner's own mistakes carry no
 * motif at all, and `THEME_LESSON.unclassified` is null by design.
 *
 * F-PZ-3 says such a mistake "produces a link to the relevant lesson instead of
 * a drill", and there is no relevant lesson to link to. The decision taken is
 * to show the learner their own position and their best move, and say plainly
 * that this one could not be matched — rather than invent a destination, link
 * to a generic lesson, or drop the entry.
 */
test('an unclassified mistake shows the position and the best move, and says so plainly', () => {
  show([err()]);
  expect(screen.getByTestId('fen')).toHaveTextContent(POSITION);
  expect(screen.getByText(/Nf3/)).toBeInTheDocument();
  expect(screen.getByText(/could not be matched/i)).toBeInTheDocument();
});

test('an unclassified mistake is not given a lesson link to nowhere', () => {
  show([err()]);
  expect(screen.queryByRole('link', { name: /lesson/i })).not.toBeInTheDocument();
});

test('a classified mistake links to the lesson that teaches it', () => {
  show([err({ theme: 'missed_capture' })]);
  const link = screen.getByRole('link', { name: /take free pieces/i });
  expect(link).toHaveAttribute('href', '/lesson/1.2.3');
});

/**
 * Nothing is dropped. The screen renders one entry per mistake the queue
 * carried, whether or not it could be classified — an entry silently omitted
 * is a mistake the learner is never shown again.
 */
test('every mistake in the queue is on the screen, classified or not', () => {
  const queue = show([
    err({ ply: 4 }),
    err({ ply: 6, theme: 'missed_capture' }),
    err({ ply: 8, theme: 'nonsense-from-a-newer-tagger' }),
  ]);
  expect(queue.lessonLinks).toHaveLength(3);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  // Two of the three could not be matched, and both say so.
  expect(screen.getAllByText(/could not be matched/i)).toHaveLength(2);
});

test('a drill from the learner’s own position is played as a fix attempt', async () => {
  const onAttempt = vi.fn();
  show([err({ theme: 'missed_mate' })], onAttempt);
  await userEvent.click(screen.getByRole('button', { name: /drill this position/i }));
  const field = await screen.findByLabelText('Type a move');
  // `firstLearnerPly` is 0 for an own drill: the learner is already to move, so
  // the answer is the FIRST ply and not the second.
  await userEvent.type(field, 'g1f3{enter}');
  expect(onAttempt).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'fix', solved: true }),
  );
});

test('an empty queue says there is nothing to fix rather than rendering nothing', () => {
  show([]);
  expect(screen.getByText(/no mistakes/i)).toBeInTheDocument();
});

/**
 * F-PZ-3 c: the queue carries the learner's exact position AND similar ones —
 * same primary theme, rating within 150. `queue.ts` has always built them;
 * this screen resolved only `source === 'own'`, so every similar drill was
 * built and then had no route into the player.
 *
 * The assertion is a correspondence, not a spot check: every index of
 * `queue.fix` must be offered, so a drill the screen quietly declines to route
 * fails here whatever its source.
 */
test('every drill the queue built is offered, similar ones included', () => {
  const queue = showWith([err({ theme: 'missed_mate' })], similarPool());
  expect(queue.fix.filter((d) => d.source === 'similar').length).toBeGreaterThan(0);
  const offered = screen.getAllByTestId(/^drill-/).map((b) => b.getAttribute('data-testid'));
  expect(new Set(offered)).toEqual(new Set(queue.fix.map((_, i) => `drill-${String(i)}`)));
});

test('a similar drill is played as a fix attempt, from the pack puzzle’s second ply', async () => {
  const onAttempt = vi.fn();
  const queue = showWith([err({ theme: 'missed_mate' })], similarPool(), onAttempt);
  const first = queue.fix.findIndex((d) => d.source === 'similar');
  await userEvent.click(screen.getByTestId(`drill-${String(first)}`));
  const field = await screen.findByLabelText('Type a move');
  // `firstLearnerPly` is 1 for a pack puzzle: a1a2 is the opponent's move,
  // already played, and h1h2 is the learner's answer.
  await userEvent.type(field, 'h1h2{enter}');
  expect(onAttempt).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'fix', solved: true, puzzleId: queue.fix[first]?.puzzle.id }),
  );
});

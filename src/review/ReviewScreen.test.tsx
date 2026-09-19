import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { db, useProgress } from '@/data';
import { emptyProgress } from '@/data/reduce';
import { ReviewScreen } from './ReviewScreen';

// The engine is a real Worker in the browser; here it is a stand-in that
// answers instantly. Its own behaviour is covered by Tasks 13 and 14.
const engine = vi.hoisted(() => ({ analyse: vi.fn() }));

/** The healthy default. Re-applied per test, because a `mockRejectedValue` set
 *  by one test outlives `mockClear` and would silently starve the next. */
function answersInstantly() {
  engine.analyse.mockReset();
  engine.analyse.mockImplementation(async (req: { fen: string; depth: number; multiPv?: number }) => ({
    lines: [{ move: 'g1f3', pv: ['g1f3'], score: { cp: 20 }, depth: req.depth }],
    depth: req.depth,
  }));
}
vi.mock('@/engine', async (orig) => ({
  ...(await orig<typeof import('@/engine')>()),
  getEngine: () => engine,
}));

// The opening book is fetched from /data/openings.txt and is NOT precached.
// Offline that fetch fails, which is the case this file drives: the review must
// still be produced, without an opening name.
const SANS = 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5';

async function seedGame(gameId: string) {
  await useProgress.getState().append({
    type: 'game_started', gameId, persona: 'rosa', color: 'w', timeControl: 'untimed', coach: true,
  });
  await useProgress.getState().append({
    type: 'game_finished', gameId, result: 'win', moves: 5, hints: 0, takebacks: 0, crowns: 3, pgn: SANS,
  });
}

beforeEach(async () => {
  await db.events.clear();
  await db.reviews.clear();
  useProgress.setState({ progress: emptyProgress(), loaded: true });
  answersInstantly();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
});

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/play/review/:gameId" element={<ReviewScreen />} />
        <Route path="/play" element={<p>play screen</p>} />
        <Route path="/path" element={<p>path screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

test('the analysing state shows a progress bar with a readable quantity', async () => {
  await seedGame('g1');
  at('/play/review/g1');
  const bar = await screen.findByRole('progressbar');
  expect(bar).toHaveAttribute('aria-valuemax');
  // A bar alone is not a readable quantity.
  expect(screen.getByText(/move \d+ of \d+/i)).toBeVisible();
});

test('something is on screen before any analysis has finished', async () => {
  await seedGame('g1');
  at('/play/review/g1');
  // Not "eventually": the heading is present in the first paint.
  expect(screen.getByRole('heading', { name: /reviewing your game/i })).toBeVisible();
});

test('an unknown game says so rather than showing an empty review', async () => {
  at('/play/review/does-not-exist');
  expect(await screen.findByText(/could not find that game/i)).toBeVisible();
});

test('the screen carries its own way out, as ModalTask requires', async () => {
  await seedGame('g1');
  at('/play/review/g1');
  expect(await screen.findByRole('button', { name: /close|exit|back/i })).toBeVisible();
});

test('there is exactly one live region on the screen at a time', async () => {
  await seedGame('g1');
  const { container } = at('/play/review/g1');
  await screen.findByRole('progressbar');
  expect(container.querySelectorAll('[aria-live]').length).toBeLessThanOrEqual(1);
});

test('the summary arrives, and states the depth actually used', async () => {
  await seedGame('g1');
  at('/play/review/g1');
  expect(await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 })).toBeVisible();
  expect(screen.getByText(/depth \d+/i)).toBeVisible();
});

test('with no opening book there is simply no opening line, and the review still lands', async () => {
  await seedGame('g1');
  at('/play/review/g1');
  await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 });
  expect(screen.queryByText(/left the book/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/never left/i)).not.toBeInTheDocument();
  // And no empty field where a name would have gone.
  expect(screen.getByRole('heading', { name: /accuracy/i })).toBeVisible();
});

test('an engine that cannot run at all leaves the learner a way out, not a spinner', async () => {
  await seedGame('g1');
  engine.analyse.mockRejectedValue(new Error('EngineUnavailable'));
  at('/play/review/g1');
  // AnalysisService reports `failed` with whatever it has; the screen shows the
  // partial review rather than nothing, and the summary says so.
  expect(await screen.findByText(/still analysing|could not finish/i, {}, { timeout: 5000 })).toBeVisible();
  expect(screen.getByRole('button', { name: /close|back/i })).toBeVisible();
});

/**
 * Banking appends an event, which changes `progress`. An effect that depends on
 * `progress` would therefore re-run the whole analysis the moment the review is
 * banked — pulling the learner out of the drill and back to a progress bar.
 * The analysis must run once per gameId.
 */
test('the analysis runs once, and a change in progress does not restart it', async () => {
  await seedGame('g1');
  at('/play/review/g1');
  await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 });
  const calls = engine.analyse.mock.calls.length;
  expect(calls).toBeGreaterThan(0); // the sweep has inputs
  await useProgress.getState().append({ type: 'lesson_started', lessonId: '1.1.1' });
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /game review/i })).toBeVisible();
  });
  expect(engine.analyse.mock.calls.length).toBe(calls);
});

/**
 * Nothing imports the barrel until Chunk F wires the route, so without this it
 * would ship unexecuted: a name missing from it, or a circular import through
 * it, would first be discovered by the chunk that depends on it.
 */
test('the barrel resolves and carries the route component and the vocabulary', async () => {
  const barrel = await import('./index');
  expect(barrel.ReviewScreen).toBe(ReviewScreen);
  for (const name of ['buildReview', 'drillFrom', 'bankReview', 'labelMove', 'selectKeyMoments', 'LABEL_GLYPH']) {
    expect(barrel, `barrel is missing ${name}`).toHaveProperty(name);
  }
});

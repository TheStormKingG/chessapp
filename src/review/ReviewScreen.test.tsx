import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { db, useProgress } from '@/data';
import { emptyProgress } from '@/data/reduce';
import userEvent from '@testing-library/user-event';
import { ReviewScreen } from './ReviewScreen';
import type { Review, ReviewedMove } from './types';

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
  expect(await screen.findByText(/not complete|could not finish/i, {}, { timeout: 5000 })).toBeVisible();
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

/**
 * F-RV-4 is "retry before reveal", and it is a promise about EVERY moment, not
 * about the first one.
 *
 * `KeyMomentView` holds `revealed` and `tries` in its own state, which is right
 * — the component is correct in isolation and its own tests all pass. The
 * screen is what decides whether moment 2 is the same instance as moment 1. If
 * it is, React keeps that state and every moment after the first renders with
 * the answer already on screen, having asked the learner nothing.
 *
 * Three moments, not two: a fix that resets on the first transition and then
 * stops would pass a two-moment test. The assertion is made on every moment.
 */
const REVEALED_MOVE = /the move was/i;
const TRIED_ALREADY = /not that one/i;

function seededReview(gameId: string): Review {
  const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const fenAfter = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const move = (ply: number, san: string): ReviewedMove => ({
    ply, san, uci: 'e2e4', fenBefore, fenAfter, mover: 'w',
    best: { uci: 'g1f3', san: 'Nf3' },
    winBefore: 55, winAfterPlayed: 25, drop: 30, accuracy: 20,
    label: 'Blunder', book: false, phase: 'opening',
  });
  // Index must equal ply: the screen reads `review.moves[moment.ply]`.
  const moves = [move(0, 'e4'), move(1, 'e5'), move(2, 'Nf3'), move(3, 'Nc6'), move(4, 'Bc4')];
  return {
    gameId, learner: 'w', depth: 14, partial: false, moves,
    accuracy: { w: 40.5, b: 80.1 },
    counts: { Blunder: 3, Best: 2 },
    opening: null, turningPhase: 'opening',
    keyMoments: [0, 2, 4].map((ply) => ({
      ply, kind: 'swing' as const, deeper: null,
      explanation: `Moment at ply ${String(ply)}.`, lessonId: null,
    })),
    errors: [], createdAt: '2026-09-19T00:00:00.000Z',
  };
}

test('every key moment asks before it reveals, not just the first', async () => {
  await seedGame('g3');
  await db.reviews.put(seededReview('g3'));
  at('/play/review/g3');

  await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 });
  await userEvent.click(screen.getByRole('button', { name: /start with the first moment/i }));

  for (const n of [1, 2, 3]) {
    // We are on the moment we think we are on.
    expect(screen.getByText(`Moment ${String(n)} of 3`)).toBeVisible();

    // Unrevealed: the learner is asked, and the answer is not on screen.
    if (!screen.queryByRole('button', { name: 'Show me' })) {
      throw new Error(`moment ${String(n)} opened already revealed — the learner was never asked`);
    }
    expect(screen.queryByText(REVEALED_MOVE)).not.toBeInTheDocument();

    // And `tries` came back to zero: a failed attempt on an earlier moment
    // must not follow the learner onto this one.
    expect(
      screen.queryByText(TRIED_ALREADY),
      `moment ${String(n)} inherited a failed attempt from an earlier moment`,
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByText(REVEALED_MOVE)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: n === 3 ? 'Finish' : 'Next moment' }));
  }
});

/**
 * F-RV-5 with F-CO-4. `reviewHungPiece` and `reviewMissedCapture` are the two
 * commonest review templates and both need {pieceName} and {square}. Nothing
 * ever fills `KeyMoment.explanation` — `selectKeyMoments` sets it null and
 * `deepenMoments` copies it through — so the screen's `explainMoment` call is
 * the only producer there is. Calling it without those facts makes
 * `CoachService` throw, `explain.ts` swallow, and every hung-piece and
 * missed-capture moment in the product render silently.
 *
 * The facts are verified data, not guesses: `hangingPieces(fenAfter, mover)`
 * names the piece and square for the first, `winningCaptures(fenBefore)` for
 * the second. The unit tests of explain.ts pass because they hand the facts in
 * by hand; only the screen can show the wiring is missing.
 */
function themedReview(gameId: string): Review {
  // d2d5 hangs the rook on d5 (hangingPieces goes 0 -> 1 across the move).
  const hungBefore = '4k3/8/8/8/8/5b2/3R4/4K3 w - - 0 1';
  const hungAfter = '4k3/8/8/3R4/8/5b2/8/4K3 b - - 1 1';
  // exd5 wins the free queen on d5; the learner played Ke2 instead.
  const missBefore = '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1';
  const missAfter = '4k3/8/8/3q4/4P3/8/4K3/8 b - - 1 1';
  const moves: ReviewedMove[] = [
    {
      ply: 0, san: 'Rd5', uci: 'd2d5', fenBefore: hungBefore, fenAfter: hungAfter, mover: 'w',
      best: { uci: 'd2d3', san: 'Rd3' },
      winBefore: 60, winAfterPlayed: 20, drop: 40, accuracy: 15,
      label: 'Blunder', book: false, phase: 'endgame',
    },
    {
      ply: 1, san: 'Ke2', uci: 'e1e2', fenBefore: missBefore, fenAfter: missAfter, mover: 'w',
      best: { uci: 'e4d5', san: 'exd5' },
      winBefore: 60, winAfterPlayed: 20, drop: 40, accuracy: 15,
      label: 'Blunder', book: false, phase: 'endgame',
    },
  ];
  return {
    gameId, learner: 'w', depth: 14, partial: false, moves,
    accuracy: { w: 15, b: 90 },
    counts: { Blunder: 2 },
    opening: null, turningPhase: 'endgame',
    keyMoments: [0, 1].map((ply) => ({
      ply, kind: 'swing' as const, deeper: null, explanation: null, lessonId: null,
    })),
    errors: [], createdAt: '2026-09-19T00:00:00.000Z',
  };
}

test('a hung-piece moment names the piece and the square rather than saying nothing', async () => {
  await seedGame('g4');
  await db.reviews.put(themedReview('g4'));
  at('/play/review/g4');

  await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 });
  await userEvent.click(screen.getByRole('button', { name: /start with the first moment/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Show me' }));

  expect(screen.getByText(/rook on d5/i)).toBeVisible();
});

test('a missed-capture moment names what was free and where', async () => {
  await seedGame('g5');
  await db.reviews.put(themedReview('g5'));
  at('/play/review/g5');

  await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 });
  await userEvent.click(screen.getByRole('button', { name: /start with the first moment/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Show me' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next moment' }));
  await userEvent.click(screen.getByRole('button', { name: 'Show me' }));

  expect(screen.getByText(/queen on d5/i)).toBeVisible();
});

/**
 * The drill is built from `review.errors`, which the deeper pass now
 * recomputes (Defect 2). If a relabelled move ever leaves the error log, the
 * count can fall below `MIN_DRILL` and `drillFrom` returns null where it
 * previously returned a drill. That transition must end the review cleanly and
 * still bank it, not render a blank screen or throw.
 *
 * Today the crossing is unreachable — `upgradeKeyMoment` only acts on `Best`
 * and `Excellent`, and `errorsFrom` only admits `Mistake`, `Blunder` and
 * `Miss`, so the two sets are disjoint. This pins the screen's behaviour for
 * when that stops being true.
 */
test('a review with too few errors for a drill ends and banks rather than showing a stub', async () => {
  await seedGame('g6');
  // Labelled `Good`, so the recomputed error log is genuinely empty. A stored
  // `errors: []` would not do it any more: the deeper pass now rebuilds the log
  // from the moves, and five Blunders produce five errors however the fixture
  // was written.
  const clean = seededReview('g6');
  await db.reviews.put({ ...clean, moves: clean.moves.map((m) => ({ ...m, label: 'Good' as const })) });
  at('/play/review/g6');

  await screen.findByRole('heading', { name: /game review/i }, { timeout: 5000 });
  await userEvent.click(screen.getByRole('button', { name: /start with the first moment/i }));
  for (const n of [1, 2, 3]) {
    expect(screen.getByText(`Moment ${String(n)} of 3`)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Show me' }));
    await userEvent.click(screen.getByRole('button', { name: n === 3 ? 'Finish' : 'Next moment' }));
  }

  expect(await screen.findByText('path screen')).toBeVisible();
  const banked = (await db.events.toArray()).filter((e) => e.payload.type === 'game_reviewed');
  expect(banked, 'the review ended without banking').toHaveLength(1);
  expect(banked[0]!.payload).toMatchObject({ drillCompleted: false, partial: false });
});

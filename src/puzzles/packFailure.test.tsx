import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { db, useProgress } from '@/data';
import { emptyProgress } from '@/data/reduce';
import { RatedRoute } from './PuzzleRoutes';
import { __resetPacks, LINE_WIDTH } from './packs';
import { PACK_BYTES } from './packMessages';

/**
 * PRD F-ER-3, at the surface the learner meets.
 *
 * > "If a pack download fails or the device is out of storage, the app says
 * > which pack failed and how much space it needs, and keeps whatever was
 * > already downloaded."
 *
 * `packMessages.test.ts` proves the sentences say those things. This file proves
 * a learner whose pack does not arrive actually READS one — which is a separate
 * claim, and the one that was false before: the route showed a message naming no
 * pack and no size, so every assertion in `packMessages.test.ts` could have
 * passed against a screen nobody ever saw.
 *
 * WHY THE POSITIVE CONTROL IS FIRST. Every test below asserts something about a
 * FAILURE, and a route that failed to mount at all would satisfy most of them by
 * accident — "the puzzle did not render" is what both a working failure path and
 * a broken test file look like. So the first test drives the same route with a
 * healthy pack and requires a puzzle.
 */

const BAND = '600-900';

/** One real pack line, padded to the width `packs.ts` parses. */
function pack(): string {
  const line = ['p1', '1000', 'fork', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1a2 h1h2'].join('\t');
  return line.padEnd(LINE_WIDTH, ' ');
}

/**
 * Put `navigator.storage` in a known state.
 *
 * `vi.restoreAllMocks()` does not undo an `Object.defineProperty`, so a stub
 * installed by one test is still there for the next. Two of the tests below turn
 * on how much space the device reports, so a leaked stub would decide another
 * test's message and it would pass or fail on the ORDER of the file rather than
 * on the code. Reset explicitly instead of relying on jsdom's default, which is
 * itself a thing that can change under a dependency bump.
 */
function setStorage(value: unknown): void {
  Object.defineProperty(navigator, 'storage', { configurable: true, value });
}

/** The board measures a square; jsdom has no layout. Stubbed as elsewhere. */
vi.mock('@/board', () => ({
  Board: ({ fen }: { fen: string }) => <span data-testid="fen">{fen}</span>,
}));

function at() {
  return render(
    <MemoryRouter initialEntries={['/puzzles/rated']}>
      <Routes>
        <Route path="/puzzles/rated" element={<RatedRoute />} />
        <Route path="/puzzles" element={<p>puzzles home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await db.events.clear();
  await db.reviews.clear();
  await db.puzzles.clear();
  // A rating inside the 600-900 band, so `bandFor` picks the pack this file
  // asserts the NAME of. A different band would make every message assertion
  // below wrong in a way that reads as a copy bug.
  useProgress.setState({ progress: emptyProgress(), loaded: true });
  // `loadPack` memoises per band for the session. Without this a pack resolved
  // by one test is served to the next from memory and the fetch mock is never
  // consulted — the failure tests would pass for the wrong reason.
  __resetPacks();
  vi.restoreAllMocks();
  // No Storage API by default: `estimateSpace` then reports every figure
  // unknown, which is the state in which a failed fetch must read as "no
  // connection" rather than as "no room".
  setStorage(undefined);
});

test('POSITIVE CONTROL: a pack that arrives produces a puzzle, through this same route', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(pack(), { status: 200 }));
  at();
  // A board on screen. Everything below asserts the absence of one, and this is
  // the proof that the absence means something.
  await waitFor(() => {
    expect(screen.getByTestId('fen')).toBeInTheDocument();
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a pack that will not download names the pack and its size, and offers a retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  at();

  const alert = await screen.findByRole('alert');
  // F-ER-3's two facts, at the surface.
  expect(alert).toHaveTextContent(/600–900/);
  expect(alert).toHaveTextContent(/0\.3 MB/);
  // And the promise that the rest survived.
  expect(alert).toHaveTextContent(/already have are still here/i);
  // Not the technical string `loadPack` throws.
  expect(alert.textContent ?? '').not.toMatch(/HTTP|Failed to fetch/);
  expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();
  // The way out is still there; the retry is added beside it, not instead of it.
  expect(screen.getByRole('button', { name: /back to puzzles/i })).toBeVisible();
});

test('a device with no room is told about space, not about its connection', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  // The same rejection as the test above — `fetch` cannot tell the two causes
  // apart, so what separates them is this, asked separately.
  setStorage({ estimate: () => Promise.resolve({ usage: 49_900_000, quota: 50_000_000 }) });
  at();

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/0\.3 MB/); // needs
  expect(alert).toHaveTextContent(/0\.1 MB free/); // has
  expect(alert).toHaveTextContent(/free up some space/i);
  // The distinction that matters: this learner must not be sent to look for wifi.
  expect(alert.textContent ?? '').not.toMatch(/connection/i);
});

test('a device with room gets the connection message, not a space one', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  setStorage({ estimate: () => Promise.resolve({ usage: 0, quota: 500_000_000 }) });
  at();

  const alert = await screen.findByRole('alert');
  // The control for the test above: the same rejection, a different device, a
  // different sentence. Without this pair either message could be the only one
  // the route can produce.
  expect(alert).toHaveTextContent(/check your connection/i);
  expect(alert.textContent ?? '').not.toMatch(/free up some space/i);
});

test('the retry re-fetches, and a pack that arrives the second time is used', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    // A fresh Response per call: a body stream reads once, so a single shared
    // Response would make the second read look like a broken source.
    .mockImplementation(() => Promise.resolve(new Response(pack(), { status: 200 })));
  at();

  await screen.findByRole('alert');
  const before = fetchMock.mock.calls.length;
  expect(before).toBeGreaterThan(0); // the first attempt really did try

  await userEvent.click(screen.getByRole('button', { name: /try again/i }));

  // The observable the LEARNER gets: the puzzles they came for.
  await waitFor(() => {
    expect(screen.getByTestId('fen')).toBeInTheDocument();
  });
  expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('F-ER-3: a pack that already loaded is kept when another fails', async () => {
  // "keeps whatever was already downloaded" is a claim about the module, not
  // only about the copy. One band resolves; a later failure must not unset it.
  const { loadPack } = await import('./packs');
  const ok = vi.fn(() => Promise.resolve(new Response(pack(), { status: 200 })));
  vi.spyOn(globalThis, 'fetch').mockImplementation(ok as unknown as typeof fetch);
  const first = await loadPack(BAND);
  expect(first).toHaveLength(1);

  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(loadPack('1200-1500')).rejects.toThrow();

  // The band that succeeded is still served, from memory, without a fetch.
  await expect(loadPack(BAND)).resolves.toHaveLength(1);
  // And the size the learner would be quoted for the failed band is the failed
  // band's own, not the one that worked.
  expect(PACK_BYTES['1200-1500']).not.toBe(PACK_BYTES[BAND]);
});

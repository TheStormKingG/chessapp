import { test, expect, type Page } from '@playwright/test';
import { buildFixtures, startSwapServer, type Fixtures, type SwapServer } from './swFixtures';

/**
 * F-RV-10: a review works offline once the app has been used online.
 *
 * This cannot live in `tests/audit/review.spec.ts` with the rest of the loop.
 * That suite is served by the dev server, where `devOptions.enabled: false`
 * means there is NO service worker at all — `setOffline(true)` there would only
 * prove that a page with no worker cannot load, which is not the claim. So it
 * runs on the same real production build `sw-upgrade.spec.ts` already builds
 * and serves, which is this suite's existing answer to "needs a real worker"
 * rather than a third arrangement.
 *
 * Two things are offline here, and they are cached by different mechanisms:
 * the ENGINE, by the `/engine/` runtime route, and the OPENING BOOK, by the
 * `/data/` route added with this chunk. The book is asserted directly, because
 * the opening NAME is not a safe proxy: whether a game has one depends on
 * whether it matched a named line, and the game played here leaves book almost
 * immediately by design.
 */

test.describe.configure({ mode: 'serial' });

const ENGINE_WAIT = 120_000;
/** 1.Na3 is a named book line, which the opening-name assertions below rely on. */
const MOVES = ['Na3', 'Nh3', 'Nb5'];
let fixtures: Fixtures;
let server: SwapServer;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  fixtures = await buildFixtures();
  server = await startSwapServer(fixtures.a);
});

test.afterAll(async () => {
  await server?.close();
});

function moveList(page: Page) {
  return page.getByRole('listitem').filter({ hasText: /^\d+\./ });
}
function isOver(page: Page): Promise<boolean> {
  return page.getByLabel(/of 3 crowns/).isVisible().catch(() => false);
}

/** Play one game to its end. Stops before the review, so a caller can choose. */
async function play(page: Page, moves: string[]): Promise<void> {
  await page.goto(`${server.origin}/settings`);
  await page.getByLabel('Text move entry').check();
  await page.goto(`${server.origin}/play`);
  await page.getByRole('button', { name: 'Untimed', exact: true }).click();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('checkbox', { name: /coach mode/i }).uncheck();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });

  for (let i = 0; i < moves.length; i++) {
    if (await isOver(page)) break;
    const input = page.getByLabel('Type a move');
    await input.fill(moves[i]!);
    await input.press('Enter');
    await expect(moveList(page).nth(i)).toHaveText(/^\d+\.\s+\S+\s+\S+/, { timeout: ENGINE_WAIT });
  }
  if (!(await isOver(page))) {
    await page.getByRole('button', { name: 'Resign' }).click();
    await expect(page.getByRole('heading', { name: 'Resign this game?' })).toBeVisible();
    await page.getByRole('button', { name: 'Resign' }).click();
  }
  await expect(page.getByLabel(/of 3 crowns/)).toBeVisible();
}

/** From the game-over screen, open the review and wait for the summary. */
async function review(page: Page): Promise<void> {
  await page.getByRole('button', { name: /review this game/i }).click();
  await expect(page.getByRole('heading', { name: 'Game review' })).toBeVisible({ timeout: 240_000 });
}

async function playAndReview(page: Page, moves: string[]): Promise<void> {
  await play(page, moves);
  await review(page);
}

/**
 * The summary's opening line, which reads "<name> — you left the book at move
 * N" or "<name> — the game never left the book". Matched on its own words
 * rather than on the opening name, which depends on the line played.
 */
function openingLine(page: Page) {
  return page.getByText(/left the book/);
}

/** Install the worker and wait until it is actually controlling the page. */
async function installWorker(page: Page): Promise<void> {
  // Two loads, and the second is not ceremony: with `registerType: 'prompt'`
  // the first worker does not claim the page it registered on, so only the
  // second visit is actually served by it. Same shape as
  // `returningVisitorOnBuildA` in sw-upgrade.spec.ts.
  await page.goto(server.origin);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect
    .poll(
      () => page.evaluate(() => navigator.serviceWorker.controller !== null).catch(() => false),
      { timeout: 60_000 },
    )
    .toBe(true);
}

/** Is the opening book in any of the worker's caches right now? */
function bookIsCached(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      const hit = await c.match('data/openings.txt', { ignoreSearch: true, ignoreVary: true });
      if (hit) return true;
    }
    return false;
  });
}

test('a second review works with the network off', async ({ browser }) => {
  test.setTimeout(600_000);
  const context = await browser.newContext();
  const page = await context.newPage();

  // Online first: install the worker, and let one whole review pull the engine
  // and the opening book into their runtime caches.
  await installWorker(page);
  await playAndReview(page, MOVES);

  // POSITIVE CONTROL for "a first-ever offline review shows no opening name"
  // below. That test asserts this line is ABSENT, and a negative assertion is
  // worth nothing unless the same fixture produces the line when the book IS
  // available. Same build, same moves: `b1a3` is a named path in
  // public/data/openings.txt, so 1.Na3 names an opening.
  await expect(openingLine(page)).toBeVisible();

  // Now cut the network. Nothing below may reach it.
  await context.setOffline(true);

  // The shell itself still loads, from the precache.
  await page.goto(`${server.origin}/`);
  await expect(page.getByRole('link', { name: 'Path' })).toBeVisible({ timeout: 60_000 });

  // The opening book is reachable with the network off — the whole point of the
  // /data/ runtime route. Asserted directly rather than through the opening
  // name, which depends on the game having matched a named line.
  // Catch rather than throw: with no /data/ route the fetch rejects outright,
  // and a raw "Failed to fetch" says less than the assertion below.
  const book = await page.evaluate(async () => {
    try {
      const r = await fetch('data/openings.txt');
      return { ok: r.ok, bytes: (await r.text()).length };
    } catch (e) {
      return { ok: false, bytes: 0, error: String(e) };
    }
  });
  expect(book.ok, `the opening book was not served offline: ${JSON.stringify(book)}`).toBe(true);
  expect(book.bytes, 'the offline opening book was empty').toBeGreaterThan(1000);

  // And a whole second game can be played and reviewed with no network.
  await playAndReview(page, MOVES);
  // The plan's stated floor: the accuracy line, not the opening name.
  await expect(page.getByRole('heading', { name: 'Accuracy' })).toBeVisible();
  await expect(page.getByText(/^\d+\.\d$|—/).first()).toBeVisible();

  await context.close();
});

/**
 * The other half of F-RV-10, and the case the PRD now states outright
 * (Appendix C): the opening book is NOT precached with the shell. It is fetched
 * on the first review that needs it. So a learner who has used the app online
 * — enough to install the worker and pull the engine down by playing — but has
 * never opened a review, and then goes offline, gets a review with no opening
 * name. The claim is that this costs the opening line and nothing else: the
 * review still runs and the summary still shows accuracy.
 *
 * The precondition is asserted, not assumed. If the book were ever added to the
 * precache, `bookIsCached` would be true before the review and this test would
 * fail there rather than quietly passing with a name on screen.
 */
test('a first-ever review with the network off loses the opening name, not the review', async ({
  browser,
}) => {
  test.setTimeout(600_000);
  // A fresh context is a fresh origin storage: no worker, no caches, no
  // reviews from the test above.
  const context = await browser.newContext();
  const page = await context.newPage();

  await installWorker(page);

  // Play, and do NOT review. Playing pulls the engine into its runtime cache;
  // only a review ever asks for the book.
  await play(page, MOVES);
  expect(await bookIsCached(page), 'the opening book was cached before any review ran').toBe(false);

  await context.setOffline(true);

  await review(page);

  // The review itself completed, and the summary carries the number it exists
  // to show.
  await expect(page.getByRole('heading', { name: 'Accuracy' })).toBeVisible();
  await expect(page.getByText(/^\d+\.\d$|—/).first()).toBeVisible();

  // And the one thing that is genuinely missing is missing, rather than the
  // screen being broken. The online run above proves these moves DO produce
  // this line when the book is reachable.
  await expect(openingLine(page)).toHaveCount(0);

  await context.close();
});

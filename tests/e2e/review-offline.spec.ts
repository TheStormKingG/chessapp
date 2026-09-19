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

async function playAndReview(page: Page, moves: string[]): Promise<void> {
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
  await page.getByRole('button', { name: /review this game/i }).click();
  await expect(page.getByRole('heading', { name: 'Game review' })).toBeVisible({ timeout: 240_000 });
}

test('a second review works with the network off', async ({ browser }) => {
  test.setTimeout(600_000);
  const context = await browser.newContext();
  const page = await context.newPage();

  // Online first: install the worker, and let one whole review pull the engine
  // and the opening book into their runtime caches.
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
  await playAndReview(page, ['Na3', 'Nh3', 'Nb5']);

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
  await playAndReview(page, ['Na3', 'Nh3', 'Nb5']);
  // The plan's stated floor: the accuracy line, not the opening name.
  await expect(page.getByRole('heading', { name: 'Accuracy' })).toBeVisible();
  await expect(page.getByText(/^\d+\.\d$|—/).first()).toBeVisible();

  await context.close();
});

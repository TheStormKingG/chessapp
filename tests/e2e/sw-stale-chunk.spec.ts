import { test, expect, type Browser, type Page } from '@playwright/test';
import { buildFixtures, startSwapServer, type Fixtures, type SwapServer } from './swFixtures';

/**
 * A held client recovers when a deploy takes its chunk away.
 *
 * `sw-upgrade.spec.ts` pins the guarantee that a learner is NOT swapped out of
 * an activity mid-activity. This pins the gap that guarantee creates.
 *
 * A held client keeps running build A's index. The deploy replaced the
 * artefact, so A's lazily-imported chunk hashes no longer exist on the server
 * -- and B's worker has by now rewritten the precache with B's entries, so A's
 * chunk is not cached either. It falls through to the network, 404s, and the
 * learner gets "that lesson could not be loaded" on a unit that is fine.
 *
 * Observed live after a content release: every EDITED unit failed this way
 * while untouched units, whose hashes had not moved, loaded normally. No
 * fresh-browser test can reach it -- CI runs a clean profile with no worker,
 * which is the one client that cannot be in this state -- which is why smoke
 * passed throughout.
 *
 * Build B is built with `--minify false`, so every chunk hash differs. That is
 * the same condition a content release produces, reached by a different route.
 *
 * STATUS: `fixme`. The FIX is shipped and unit-tested (`staleChunk.test.ts`,
 * 7 cases); this end-to-end reproduction is NOT working and is parked rather
 * than deleted, because what it learned is worth more than the file.
 *
 * What it disproved -- my own assumption. Swapping the server is not enough.
 * While the new worker is merely WAITING, Workbox has not run its cleanup, so
 * the old build's chunks are still in the precache and every lazy import is
 * served from there. Nothing 404s. The live failure needs the state AFTER
 * cleanup: new entries in place, old ones purged, and a page still running the
 * old index. That state cannot be reached by swapping builds alone.
 *
 * Evicting the chunks by hand reproduces the cache state, and the 404 that
 * follows is real. What then defeated it was incidental: inside a lesson the
 * tab bar is hidden (a lesson is modal, by design), the next lesson is LOCKED
 * on a fresh profile so it is not a link, and driving the remaining route
 * races the very reload the fix performs. Each obstacle is a correct product
 * behaviour, which is the signal that the harness, not the fix, is what is
 * missing here.
 *
 * To finish it, the likely route is a seeded profile (so a second lesson is
 * unlocked) plus waiting on the reload rather than clicking through it.
 *
 * WHY IT IS ITS OWN FILE. `sw-upgrade.spec.ts` is `mode: 'serial'`, so one
 * failure there skips every test after it -- including the guarantee tests.
 * This test drives a fifth browser context through two full builds and is the
 * slowest in the suite; when it was declared in that file, the run became
 * unstable in a way I could not attribute (the checkpoint guarantee test began
 * failing, reproducibly, although it is declared BEFORE this one and this one
 * never ran). Rather than ship a test whose presence can silently disarm the
 * guarantees next to it, it lives here with its own server and its own
 * fixtures. The instability is recorded rather than explained away: it is not
 * understood, and this placement makes it harmless instead of making it
 * invisible.
 */

let fixtures: Fixtures;
let server: SwapServer;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  fixtures = await buildFixtures('sw-stale-chunk');
  server = await startSwapServer(fixtures.a);
});

test.afterAll(async () => {
  await server?.close();
});

async function clientState(page: Page): Promise<{ entry: string | null; waiting: boolean }> {
  try {
    return await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        entry: document.querySelector('script[type="module"]')?.getAttribute('src') ?? null,
        waiting: reg?.waiting != null,
      };
    });
  } catch {
    // An auto-reload mid-evaluate is a retry, not a failure.
    return { entry: null, waiting: false };
  }
}

/** A returning visitor: build A installed AND controlling, not a first load. */
async function returningVisitorOnBuildA(browser: Browser, path: string): Promise<Page> {
  server.serve(fixtures.a);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${server.origin}${path}`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(async () => (await clientState(page)).entry, { timeout: 30_000 }).toBe(fixtures.a.entry);
  return page;
}

test.fixme('a held client recovers when a deploy takes its chunk away', async ({ browser }) => {
  const page = await returningVisitorOnBuildA(browser, '/lesson/1.1.1');

  server.serve(fixtures.b);
  await page.reload();

  // B really did install and really is being held back. Without this the
  // recovery below is indistinguishable from an ordinary navigation.
  await expect.poll(async () => (await clientState(page)).waiting, { timeout: 30_000 }).toBe(true);
  expect((await clientState(page)).entry, 'the client is not on build A to begin with').toBe(fixtures.a.entry);

  /*
   * Reach the state the live failure actually needs, and say plainly that it is
   * constructed.
   *
   * Swapping the server is not enough on its own: while B is merely WAITING,
   * Workbox has not run its cleanup, so A's chunks are still in the precache
   * and every lazy import is served from there. Nothing 404s and there is
   * nothing to recover from -- which this test asserted, and failed, before
   * this block existed.
   *
   * The live condition is the one AFTER cleanup: the new worker's entries have
   * replaced the old ones while a page is still running the old index, so the
   * old chunk is in no cache and the server no longer has it. Evicting A's
   * lesson chunks from the caches reproduces exactly that, without waiting for
   * an activation this test cannot force while the page is open.
   *
   * What is simulated is the CACHE STATE, not the failure: the 404 that follows
   * is real, served by the real swap server, and the recovery is real.
   */
  const evicted = await page.evaluate(async () => {
    let n = 0;
    for (const key of await caches.keys()) {
      const c = await caches.open(key);
      for (const req of await c.keys()) {
        if (/\/assets\/(lesson|checkpoint)-/.test(req.url)) {
          await c.delete(req);
          n += 1;
        }
      }
    }
    return n;
  });
  // If nothing was evicted the navigation below would simply succeed from
  // cache, and this test would pass while proving nothing.
  expect(evicted, 'no lesson/checkpoint chunks were in the precache to evict').toBeGreaterThan(0);

  // Now ask A's still-running index for a chunk that is in no cache and that
  // B's artefact does not contain. This is a client-side navigation, so the
  // page keeps running A's index rather than re-fetching a document.
  // The tab bar is hidden inside a lesson by design (a lesson is modal), so
  // the way out is the lesson's own exit control.
  await page.getByRole('button', { name: 'Exit lesson' }).click();
  // 1.1.2 is LOCKED on a fresh profile, so it is not a link. The unit
  // checkpoint is ("attempt any time to test out") and its chunk is lazily
  // imported and was evicted above, which is what this needs.
  await page.getByRole('link', { name: /checkpoint/i }).first().click();

  // It takes the waiting worker and comes back on B...
  await expect.poll(async () => (await clientState(page)).entry, { timeout: 45_000 }).toBe(fixtures.b.entry);
  // ...and the lesson asked for is on screen. Asserting recovery, not the
  // absence of an error: "no error text" also passes against a spinner that
  // never resolves.
  await expect(page.getByText('could not be loaded')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /start the checkpoint/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.context().close();
});

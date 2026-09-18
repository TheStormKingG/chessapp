import { test, expect, type Page, type Browser } from '@playwright/test';
import { buildFixtures, startSwapServer, type Fixtures, type SwapServer } from './swFixtures';

/**
 * The returning visitor, which is the one condition the rest of this suite
 * cannot reach.
 *
 * Every other e2e spec loads a freshly built app into a clean browser profile.
 * That is exactly the state in which a stale-client defect is invisible: there
 * is no old worker to be stuck on. `registerType: 'prompt'` shipped a worker
 * with `skipWaiting: false`, so a new build installed and *waited* while the
 * old worker kept serving the old shell; a plain reload did not release it, and
 * nothing re-checked, so a long-lived tab or a PWA resumed from the app
 * switcher never discovered a deploy. The suite was green through all of it.
 *
 * So these tests install build A, replace the served files with a genuinely
 * different build B, and reload once as an ordinary returning visitor with
 * nothing cleared. They assert on B's hashed entry-module URL — a string only
 * build B can produce — never on wording the two builds share.
 *
 * They also pin the guarantee the fix exists to keep: a client that starts
 * inside an activity must NOT be swapped out mid-activity, and must take the
 * update on its next launch. A test that only proved updates happen would
 * license a "fix" that reloads a learner out of a game.
 *
 * Cost: two production builds in `beforeAll` (~25 s each on CI-class hardware),
 * then a few seconds per test. Every wait is a bounded `expect.poll`, so a
 * worker that never activates fails the test inside its timeout rather than
 * hanging the job.
 */

test.describe.configure({ mode: 'serial' });

/**
 * How long a mid-activity client is watched to confirm it is not swapped out.
 * Comfortably longer than the time an unguarded app takes to apply a waiting
 * worker (observed under a mutation: well under a second), and well short of
 * the test timeout.
 */
const HOLD_WINDOW_MS = 5_000;

let fixtures: Fixtures;
let server: SwapServer;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  fixtures = await buildFixtures();
  server = await startSwapServer(fixtures.a);
});

test.afterAll(async () => {
  await server?.close();
});

type ClientState = {
  /** `src` of the entry module in the document the client is actually running. */
  entry: string | null;
  /** Is this page being served by a service worker at all? */
  controlled: boolean;
  /** Has a newer worker installed and been left waiting? */
  waiting: boolean;
};

/** Never throws: an auto-reload mid-evaluate is a retry, not a failure. */
async function clientState(page: Page): Promise<ClientState> {
  try {
    return await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        entry: document.querySelector('script[type="module"]')?.getAttribute('src') ?? null,
        controlled: navigator.serviceWorker.controller !== null,
        waiting: reg?.waiting != null,
      };
    });
  } catch {
    return { entry: null, controlled: false, waiting: false };
  }
}

/**
 * A browser that has build A installed and controlling the page — an ordinary
 * returning visitor, not a first-time one.
 *
 * Two loads are needed and the second is not ceremony: with `registerType:
 * 'prompt'` the first worker does not claim the page it registered on, so the
 * first visit is served from the network. The second visit is the first one
 * served by the worker, which is where a returning visitor actually lives.
 */
async function returningVisitorOnBuildA(browser: Browser, path: string): Promise<Page> {
  server.serve(fixtures.a);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${server.origin}${path}`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();

  await expect
    .poll(async () => (await clientState(page)).controlled, { timeout: 30_000 })
    .toBe(true);
  // Guard against a vacuous run: if the client is not on A to begin with, every
  // "now it is on B" assertion below would pass without an upgrade happening.
  expect((await clientState(page)).entry).toBe(fixtures.a.entry);
  return page;
}

test('a returning visitor lands on the new build after one ordinary reload', async ({ browser }) => {
  const page = await returningVisitorOnBuildA(browser, '/');

  // The deploy: the files on the server are now a different build.
  server.serve(fixtures.b);

  // One reload. Nothing cleared, no hard reload, no closing of every tab.
  await page.reload();

  await expect
    .poll(async () => (await clientState(page)).entry, { timeout: 30_000 })
    .toBe(fixtures.b.entry);

  // ...and nothing was left waiting behind it. Asserted separately from the
  // entry check on purpose: a single combined assertion can pass because the
  // registration could not be read at all.
  await expect
    .poll(async () => (await clientState(page)).waiting, { timeout: 15_000 })
    .toBe(false);

  await page.context().close();
});

for (const activity of ['/lesson/1.1.1', '/checkpoint/1.1', '/play/game']) {
  test(`a client that starts inside ${activity} is not swapped mid-activity`, async ({ browser }) => {
    const page = await returningVisitorOnBuildA(browser, activity);

    server.serve(fixtures.b);
    await page.reload();

    // Build B really did arrive and install — without this the assertion below
    // would pass simply because no update was available.
    await expect
      .poll(async () => (await clientState(page)).waiting, { timeout: 30_000 })
      .toBe(true);

    // And the learner STAYS on the build they started the activity with.
    //
    // Sampled over a window rather than read once: a single read taken the
    // instant after the waiting worker appears is satisfied by an app that is
    // already mid-swap, and this exact test passed against a deliberately
    // broken policy that swapped unconditionally. The window is what makes the
    // assertion about the guarantee instead of about scheduling luck.
    const deadline = Date.now() + HOLD_WINDOW_MS;
    let samples = 0;
    while (Date.now() < deadline) {
      let state = await clientState(page);
      if (state.entry === null) {
        // A page mid-navigation reads as null. Re-read once so the failure
        // names the build that replaced A rather than reporting nothing.
        await page.waitForTimeout(750);
        state = await clientState(page);
      }
      expect(state.entry, 'the app swapped builds while an activity was in progress').toBe(fixtures.a.entry);
      expect(state.waiting, 'the waiting worker was taken while an activity was in progress').toBe(true);
      samples += 1;
      await page.waitForTimeout(250);
    }
    expect(samples, 'the hold window took no samples').toBeGreaterThan(4);

    // The update is not lost: the next launch outside an activity takes it.
    await page.goto(`${server.origin}/`);
    await expect
      .poll(async () => (await clientState(page)).entry, { timeout: 30_000 })
      .toBe(fixtures.b.entry);
    await expect
      .poll(async () => (await clientState(page)).waiting, { timeout: 15_000 })
      .toBe(false);

    await page.context().close();
  });
}

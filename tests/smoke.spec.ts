import { test, expect } from '@playwright/test';

test('live app loads with the tab bar', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'Path' })).toBeVisible();
});

/**
 * The deployed worker and the deployed app must come from the same build.
 *
 * `sw.js` carries a precache manifest listing the exact asset URLs of the build
 * it was generated from. If a deploy publishes `index.html` from one build and
 * `sw.js` from another — a partial upload, a cache layer serving a stale
 * `sw.js`, a workflow that rebuilt one and not the other — the worker precaches
 * a set of files the shell never asks for and 404s on the ones it does. Every
 * client that installs it is stranded, and nothing else in the pipeline looks.
 *
 * WHAT THIS CHECK CAN SEE: what the server hands out over HTTP, right now, for
 * `index.html` and `sw.js`.
 *
 * WHAT IT CANNOT SEE — and this is the larger half of the problem:
 *  - what an already-installed worker serves a returning client. A browser with
 *    an old build cached is served by its own worker, not by this origin, so a
 *    perfectly self-consistent deploy can still leave clients on an old shell.
 *    That failure mode is covered by `tests/e2e/sw-upgrade.spec.ts`, which is
 *    the only place it can be covered, because it needs a browser profile that
 *    already has a build installed.
 *  - whether the worker actually activates, caches successfully, or is reachable
 *    from the manifest's scope.
 *  - lazily-loaded chunks: only the URLs `index.html` itself references are
 *    compared, so a missing lazy chunk is out of range.
 *
 * Cost: two HTTP fetches, well under a second. It cannot hang the deploy gate.
 */
test('the served service worker precaches the build the served index.html references', async ({ request, baseURL }) => {
  const base = new URL(baseURL ?? 'http://localhost:5173/');
  const swUrl = new URL('sw.js', base);

  const indexRes = await request.get(base.href);
  expect(indexRes.status(), `GET ${base.href}`).toBe(200);
  const html = await indexRes.text();

  const swRes = await request.get(swUrl.href);
  expect(swRes.status(), `GET ${swUrl.href}`).toBe(200);
  const sw = await swRes.text();

  // The manifest entries workbox inlines into sw.js, e.g. {url:"assets/index-X.js",revision:null}.
  // They are relative to the worker's own URL, which is also the app's base.
  const precached = new Set(
    [...sw.matchAll(/\{\s*url\s*:\s*"([^"]+)"\s*,\s*revision\s*:/g)].map((m) => new URL(m[1] ?? '', swUrl).href),
  );

  // The hashed assets the shell itself loads: <script src> and <link href> that
  // the build emitted, resolved against the page they are referenced from.
  const referenced = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(
    (m) => new URL(m[1] ?? '', base).href,
  );

  // Both sides are regex-derived, so both can silently come back empty — and an
  // "every referenced asset is precached" assertion over an empty list passes
  // while testing nothing. Fail loudly instead.
  expect(precached.size, `no precache manifest entries parsed from ${swUrl.href}`).toBeGreaterThan(0);
  expect(referenced.length, `no hashed assets parsed from ${base.href}`).toBeGreaterThan(0);

  const missing = referenced.filter((url) => !precached.has(url));
  expect(
    missing,
    `the served sw.js does not precache ${String(missing.length)} asset(s) the served index.html loads — ` +
      `the worker and the app were built from different builds`,
  ).toEqual([]);
});

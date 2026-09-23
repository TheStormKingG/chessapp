import { test, expect } from '@playwright/test';

test.describe('licences', () => {
  test('Stockfish is listed with version, GPL notice and resolving links', async ({ page, request }) => {
    await page.goto('./licences');
    const card = page.getByRole('listitem').filter({ hasText: 'Stockfish' }).first();
    await expect(card).toContainText('19.0.0');
    await expect(card).toContainText('GPL-3.0-or-later');
    await expect(card).toContainText(/GNU General Public License/i);

    const hrefs = await card.getByRole('link').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).href),
    );
    expect(hrefs.some((h) => h.endsWith('engine/LICENSE'))).toBe(true);
    expect(hrefs.some((h) => h.endsWith('engine/SOURCE.txt'))).toBe(true);
    expect(hrefs.some((h) => h.endsWith('engine/NOTICE'))).toBe(true);

    // Vite's SPA fallback answers 200 with index.html for a missing asset, so a
    // bare status check proves nothing: assert the body is the real file.
    for (const href of hrefs.filter((h) => h.includes('/engine/'))) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
      const body = await res.text();
      expect(body.startsWith('<!doctype html') || body.startsWith('<!DOCTYPE html'), `${href} served index.html`).toBe(
        false,
      );
    }
  });
});

/*
 * Same precondition as `tests/smoke.spec.ts`, same reason: the manifest link
 * and the registered worker are build outputs, and a dev server has neither in
 * the form these assert on.
 *
 * This file also sits in `tests/audit-platform/`, which NO workflow runs --
 * `deploy.yml` runs `tests/e2e` only. So these two could pass in exactly one
 * situation: somebody running them locally with PREVIEW=1 set by hand. Skipping
 * with the reason attached is what makes that visible at the point of running,
 * instead of leaving a red spec that is neither broken nor covered.
 */
const BUILT_ARTEFACT = !!process.env['PREVIEW'] || !!process.env['SMOKE_URL'];

test.describe('pwa', () => {
  test.skip(!BUILT_ARTEFACT, 'needs a production build: run with PREVIEW=1');

  test('the manifest parses and its start_url and scope match the deployed base', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, 'no manifest link in the document head').toBeTruthy();
    const url = new URL(href!, page.url());
    const res = await request.get(url.toString());
    expect(res.status()).toBe(200);
    const manifest = JSON.parse(await res.text()) as {
      start_url: string;
      scope: string;
      icons: { src: string }[];
    };

    const base = await page.evaluate(() => {
      const el = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      return el ? new URL(el.href).pathname.replace(/manifest\.webmanifest$/, '') : '/';
    });
    expect(new URL(manifest.start_url, url).pathname, 'start_url does not match the deployed base').toBe(base);
    expect(new URL(manifest.scope, url).pathname, 'scope does not match the deployed base').toBe(base);

    for (const icon of manifest.icons) {
      const iconRes = await request.get(new URL(icon.src, url).toString());
      expect(iconRes.status(), icon.src).toBe(200);
      expect(iconRes.headers()['content-type'], icon.src).toContain('image/');
    }
  });

  test('the service worker registers on the preview build', async ({ page }) => {
    await page.goto('./');
    const state = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) return 'registered';
      const r = await Promise.race([
        navigator.serviceWorker.ready.then(() => 'registered'),
        new Promise<string>((res) => setTimeout(() => res('none'), 8000)),
      ]);
      return r;
    });
    expect(state, 'no service worker registration on the preview build').toBe('registered');
  });
});

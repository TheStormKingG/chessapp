import { test, expect, type Page } from '@playwright/test';

/**
 * Two invariants the redesign's quality floor states and nothing else guards.
 *
 * 1. **Reflow.** DESIGN-SYSTEM.md's quality floor promises "the largest system
 *    text size survivable" and "responsive down to 320px". Every type role is
 *    in `rem`, so raising the root font size is exactly what an OS text-size
 *    setting does to this app. At 200% the page must still not scroll
 *    sideways: `accessibility.md > Best practices` asks that layouts survive
 *    the largest sizes, and two-dimensional scrolling is the failure mode.
 *
 * 2. **`.tap` is not inert.** `.tap` sets `min-height`/`min-width: 44px`, which
 *    does nothing on a non-replaced *inline* element. A link that carries the
 *    class therefore looks compliant in source and renders at line height. The
 *    class is a promise about rendered geometry, so it is measured as one.
 */

const SCREENS = [
  ['today', './'],
  ['path', './path'],
  ['progress', './progress'],
  ['settings', './settings'],
  ['licences', './licences'],
  ['choose-opponent', './play'],
  ['checkpoint-intro', './checkpoint/1.1'],
  ['not-found', './no-such-page'],
] as const;

async function settle(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

for (const [slug, url] of SCREENS) {
  test(`${slug}: no sideways scrolling at the largest text size`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page, url);
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(m.scrollW, `${slug} overflows by ${String(m.scrollW - m.clientW)}px`).toBeLessThanOrEqual(m.clientW + 1);
  });

  test(`${slug}: every .tap control really measures 44px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page, url);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('.tap')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44 || r.width < 44) {
          out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)} display=${getComputedStyle(el).display}`);
        }
      }
      return out;
    });
    expect(small, small.join('; ')).toEqual([]);
  });
}

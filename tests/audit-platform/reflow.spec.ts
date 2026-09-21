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
  // The puzzles tab and the rated stream reuse this sweep rather than growing
  // a second one: the solving screen is a full-height layout with a board in
  // it, which is the shape most likely to overflow at a 32px root.
  ['puzzles', './puzzles'],
  ['puzzles-rated', './puzzles/rated'],
  ['checkpoint-intro', './checkpoint/1.1'],
  ['not-found', './no-such-page'],
] as const;

async function settle(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

/**
 * The width matrix. 390x844 is the phone the reflow promise was written for;
 * 2000x1200 is the width the owner actually uses, and 1280x800 is the edge the
 * two-column grid switches on, all three added with the desktop layout
 * (NEUMORPHIC-DELTA.md §7.4). 1280 earns its row: the grid's media query is
 * evaluated in ROOT-relative rem that does not scale, while the rail, the
 * gutter and the padding are rem that does, so it is the one width where a
 * 32px root asks two columns to fit a container that shrank around them. The wide row is not a formality: at a 32px root
 * the two-column grid is the one place where a fixed gutter, a 240px board and
 * doubled text can push a column past its track, and nothing else in the suite
 * looks at a large root font in a wide window.
 */
const WIDTHS = [
  [390, 844],
  [1280, 800],
  [2000, 1200],
] as const;

for (const [slug, url] of SCREENS) {
  for (const [vw, vh] of WIDTHS) {
    test(`${slug}: no sideways scrolling at the largest text size at ${String(vw)}x${String(vh)}`, async ({ page }) => {
      await page.setViewportSize({ width: vw, height: vh });
      await settle(page, url);
      await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(m.scrollW, `${slug} overflows by ${String(m.scrollW - m.clientW)}px at ${String(vw)}px`).toBeLessThanOrEqual(
        m.clientW + 1,
      );
    });
  }

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

/**
 * 3. **The icon-only control is a square at the system radius.** `.icon-control`
 *    rings an icon-only dismiss button. Two things are guarded here and they
 *    are independent. The RADIUS is DESIGN-SYSTEM.md §3.3's control radius,
 *    now `--radius-control` (12px, NEUMORPHIC-DELTA.md §3.5, re-grounded on the
 *    reference's own 12/16/24 scale) — §3.3 says 999px applies to nothing and
 *    REFERENCE-DELTA.md §5.4
 *    rejects the reference's pill chips by citing that clause, so a round ring
 *    anywhere in the tree would make the rule untrue.
 *
 *    The BOX is square. `.tap` floors `min-height` and `min-width`
 *    *independently*, so at a large root font the glyph's line box grows the
 *    height while the width stays pinned at its floor — 44x54 at a 32px root,
 *    which no existing gate catches: nothing overflows, the 44px floor holds
 *    and everything stays legible.
 *
 *    The shape assertion is paired with a magnitude: equality alone is
 *    satisfied by a collapsed box, and a floor alone is satisfied by the 44x54
 *    one. Both, or neither means anything.
 */
/**
 * Two states, and the second is the one that matters. On the card screen the
 * challenge counter beside the control is empty, so the header has slack. Once
 * a challenge is running the counter is populated, and at the largest text size
 * the header's three children no longer fit: a flex item that may shrink is
 * then squeezed off its own width and stops being square again, by a different
 * mechanism than the floors. Measured on the card screen alone, the control
 * reads as fixed when it is not.
 */
const ICON_CONTROL_SCREENS = [
  ['lesson-card', './lesson/1.1.1', false],
  ['lesson-challenge', './lesson/1.1.1', true],
] as const;

for (const [slug, url, advance] of ICON_CONTROL_SCREENS) {
  /* 200% is 32px, not 24px: the app's body role is 17px at a 16px root, so the
     glyph's line box only clears the 44px floor once the root doubles. At a
     24px root the control still measures 44x44, which is why the defect this
     guards was invisible to a spot check at "150%". Both sizes are asserted —
     the 24px case is a regression floor, the 32px case is the one that was
     broken (44x54). */
  for (const [label, rootPx] of [
    ['normal text', null],
    ['a 24px root', 24],
    ['200% text (a 32px root)', 32],
  ] as const) {
    test(`${slug}: the icon-control ring is a square of at least 44px at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await settle(page, url);
      if (advance) {
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        for (let i = 0; i < 12; i++) {
          const next = page.getByRole('button', { name: 'Next', exact: true });
          if (!(await next.isVisible().catch(() => false))) break;
          await next.click();
        }
        // The populated counter is the crowding this state exists to create.
        await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible({ timeout: 20_000 });
      }
      if (rootPx !== null) {
        await page.addStyleTag({ content: `html{font-size:${String(rootPx)}px !important}` });
        await page.waitForTimeout(250);
      }
      await expect(page.locator('.icon-control').first()).toBeVisible({ timeout: 20_000 });

      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll('.icon-control')].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: el.getAttribute('aria-label') ?? el.tagName,
            w: Math.round(r.width * 100) / 100,
            h: Math.round(r.height * 100) / 100,
          };
        }),
      );

      // An empty set would satisfy every assertion below it.
      expect(boxes.length, 'no .icon-control rendered on this screen').toBeGreaterThan(0);

      // DESIGN-SYSTEM.md §3.3 states one radius system, now the reference's
      // 12px control radius (NEUMORPHIC-DELTA.md §3.5): 12px on cards and
      // controls, 999px on NOTHING, 0 on the board. An icon-only dismiss is a
      // control, so it takes the control radius like every other control — the
      // rule has no exception and REFERENCE-DELTA.md §5.4 depends on it having
      // none.
      const radii = await page.evaluate(() =>
        [...document.querySelectorAll('.icon-control')].map(
          (el) => getComputedStyle(el).borderTopLeftRadius,
        ),
      );
      for (const r of radii) expect(r, 'icon-control must take the 12px control radius').toBe('12px');

      for (const b of boxes) {
        const seen = `${b.label} ${String(b.w)}x${String(b.h)}`;
        expect(Math.abs(b.w - b.h), `${seen} is not square`).toBeLessThanOrEqual(1);
        expect(b.w, `${seen} is under the 44px touch floor on its width`).toBeGreaterThanOrEqual(44);
        expect(b.h, `${seen} is under the 44px touch floor on its height`).toBeGreaterThanOrEqual(44);
      }
    });
  }
}

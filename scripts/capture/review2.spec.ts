import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openLesson, readLesson, enableTextEntry } from '../../tests/audit/audit-helpers';

/**
 * Second pass: the three results from `review.spec.ts` that were claims about
 * the INSTRUMENT rather than about the app.
 *
 * 1. Focus rings. `element.focus()` does not reliably satisfy `:focus-visible`
 *    in Chromium when no keyboard interaction has happened, and the app's rings
 *    are all `focus-visible:`. A probe that presses Tab is the only one that
 *    answers the question that was asked.
 * 2. Touch targets. The 28px boxes are `<input type=checkbox>`; if each sits
 *    inside a `<label>` the whole label is the hit region, so the input's own
 *    box is the wrong thing to have measured.
 * 3. Checkpoint intro returned 9 visible elements, which is a navigation that
 *    did not land, not a screen that is empty.
 */

const OUT = process.env['REVIEW_OUT'] ?? '/tmp/chessapp-review';
const LESSON = readLesson('1.1.1');

/** Tab through the page and read the ring off whatever really has focus. */
async function tabRings(page: Page, limit = 40) {
  await page.evaluate(() => { document.body.focus(); });
  const seen: Record<string, unknown>[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const key = el.tagName + '|' + (el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30));
      // A ring is real if it paints: an outline with a style and a width, or a
      // box-shadow. `outline-width` alone is not a ring -- Tailwind sets the
      // width on the base class and only `:focus-visible` turns the style on.
      const outlineOn = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const shadowOn = s.boxShadow !== 'none' && s.boxShadow !== '';
      return {
        key,
        outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
        boxShadow: s.boxShadow,
        ring: outlineOn || shadowOn,
      };
    });
    if (!r) break;
    if (keys.has(r.key)) break;
    keys.add(r.key);
    seen.push(r);
  }
  return seen;
}

/** The real hit region of a checkbox is its label when it has one. */
async function checkboxTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox], input[type=radio]')].map((el) => {
      const own = el.getBoundingClientRect();
      const lab = el.closest('label') ?? (el.id ? document.querySelector<HTMLElement>(`label[for="${el.id}"]`) : null);
      const lb = lab?.getBoundingClientRect();
      return {
        name: el.getAttribute('aria-label') ?? (lab?.textContent ?? '').trim().slice(0, 40),
        input: { w: +own.width.toFixed(1), h: +own.height.toFixed(1) },
        label: lb ? { w: +lb.width.toFixed(1), h: +lb.height.toFixed(1) } : null,
      };
    }),
  );
}

const CASES = [
  { tag: 'phone-light', width: 390, height: 844 },
];

for (const c of CASES) {
  test(`focus and targets ${c.tag}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: c.width, height: c.height });
    await enableTextEntry(page);
    const out: Record<string, unknown> = {};

    await page.goto('./');
    await page.waitForTimeout(800);
    out['today'] = { rings: await tabRings(page) };

    await page.goto('./settings');
    await page.waitForTimeout(400);
    out['settings'] = { rings: await tabRings(page), checkboxes: await checkboxTargets(page) };

    await page.goto('./play');
    await page.waitForTimeout(400);
    out['choose-opponent'] = { rings: await tabRings(page), checkboxes: await checkboxTargets(page) };

    await openLesson(page, LESSON);
    await page.waitForTimeout(400);
    out['lesson-challenge'] = { rings: await tabRings(page) };

    // The checkpoint intro, with what is actually on it read back.
    await page.goto('./checkpoint/1.1');
    await page.waitForTimeout(1500);
    out['checkpoint-intro'] = await page.evaluate(() => ({
      url: location.href,
      heading: document.querySelector('h1,h2')?.textContent ?? null,
      visibleElements: [...document.querySelectorAll('*')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
      text: (document.body.innerText || '').slice(0, 300),
    }));
    out['checkpoint-intro-rings'] = await tabRings(page);

    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `focus-${c.tag}.json`), JSON.stringify(out, null, 1));
  });
}

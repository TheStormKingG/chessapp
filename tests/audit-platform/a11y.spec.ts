import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, startGame, typeMove } from './helpers';

const ENGINE_WAIT = 120_000;

const UNNAMED = `
  (() => {
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="checkbox"], [role="link"]';
    const out = [];
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('[aria-hidden="true"]')) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const byId = el.getAttribute('aria-labelledby');
      const byIdText = byId ? byId.split(/\\s+/).map((i) => document.getElementById(i)?.textContent ?? '').join(' ') : '';
      const wrapping = el.closest('label')?.textContent ?? '';
      const forLabel = el.id ? (document.querySelector('label[for="' + el.id + '"]')?.textContent ?? '') : '';
      const name = [el.getAttribute('aria-label'), el.getAttribute('title'), byIdText, wrapping, forLabel, el.textContent].join('').trim();
      if (!name) out.push(el.outerHTML.slice(0, 200));
    });
    return out;
  })()
`;

async function openGame(page: Page): Promise<void> {
  await enableTextEntry(page);
  await startGame(page, { tc: 'Untimed', colour: 'White' });
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
}

test.describe('accessibility on the Play screen', () => {
  test.setTimeout(180_000);

  test('every control has an accessible name', async ({ page }) => {
    await openGame(page);
    const unnamed = (await page.evaluate(UNNAMED)) as string[];
    expect(unnamed, `${String(unnamed.length)} unnamed controls:\n${unnamed.join('\n')}`).toEqual([]);
  });

  test('the board exposes exactly one live region that is not aria-hidden', async ({ page }) => {
    await openGame(page);
    const regions = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]'),
      );
      return els
        .filter((e) => e.getAttribute('aria-hidden') !== 'true' && !e.closest('[aria-hidden="true"]'))
        .map((e) => e.outerHTML.slice(0, 200));
    });
    expect(regions, `${String(regions.length)} live regions:\n${regions.join('\n')}`).toHaveLength(1);
  });

  test('there is exactly one tab stop inside the board container', async ({ page }) => {
    await openGame(page);
    const stops = await page.evaluate(() => {
      const root = document.querySelector('[role="application"]');
      if (!root) return ['no board container'];
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'),
      ).filter((e) => (e.getAttribute('tabindex') ?? '0') !== '-1');
      return focusable.map((e) => e.outerHTML.slice(0, 120));
    });
    // The container itself is the one stop; nothing inside it may be another.
    expect(stops, `extra tab stops inside the board:\n${stops.join('\n')}`).toEqual([]);
  });

  test('keyboard-only play works: navigate and make a move without the mouse', async ({ page }) => {
    // Text entry off for this one: the board's own keyboard cursor is the path.
    await page.goto('./play');
    await page.getByRole('button', { name: 'Start game' }).click();
    const board = page.locator('[role="application"]');
    await expect(board).toBeVisible({ timeout: ENGINE_WAIT });

    await board.focus();
    await expect(board).toBeFocused();
    // Cursor starts on a1 for White. Walk to e2, select, walk to e4, activate.
    await page.keyboard.press('ArrowRight'); // b1
    await page.keyboard.press('ArrowRight'); // c1
    await page.keyboard.press('ArrowRight'); // d1
    await page.keyboard.press('ArrowRight'); // e1
    await page.keyboard.press('ArrowUp'); // e2
    const status = page.locator('p[aria-label="Board announcements"]');
    await expect(status).toContainText('e2');
    await page.keyboard.press('Enter');
    await expect(status).toContainText(/Selected/);
    await page.keyboard.press('ArrowUp'); // e3
    await page.keyboard.press('ArrowUp'); // e4
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listitem').filter({ hasText: /^1\.\s+e4/ })).toBeVisible({ timeout: ENGINE_WAIT });
  });

  test('the colour-coded highlights carry a non-colour cue', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: 'Hint' }).click();
    const ring = page.locator('[style*="0px 0px 0px 5px inset"]').first();
    await expect(ring).toBeVisible({ timeout: 60_000 });
    const shape = await ring.evaluate((e) => {
      const s = getComputedStyle(e);
      return { boxShadow: s.boxShadow, outline: s.outline, backgroundImage: s.backgroundImage };
    });
    // A hue alone would be indistinguishable; the highlight must change shape.
    expect(
      shape.boxShadow !== 'none' || shape.outline.includes('dashed') || shape.backgroundImage !== 'none',
      JSON.stringify(shape),
    ).toBe(true);
  });

  test('the move the learner played is announced', async ({ page }) => {
    await openGame(page);
    await typeMove(page, 'e4');
    await expect(page.locator('p[aria-label="Board announcements"]')).toContainText(/You played e4\./);
  });
});

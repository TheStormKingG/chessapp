import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, startGame } from './helpers';

const ENGINE_WAIT = 120_000;

test.use({ viewport: { width: 1280, height: 800 } });

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

test.describe('desktop layout at 1280x800', () => {
  test.setTimeout(180_000);

  test('the navigation is a vertical rail, not a bottom bar', async ({ page }) => {
    await page.goto('./');
    const nav = await box(page, 'nav[aria-label="Main"]');
    const viewport = page.viewportSize()!;
    // Measured, not inferred from class names: a rail is tall and narrow and
    // starts at the top; a bottom bar is wide and sits at the foot.
    test.info().annotations.push({ type: 'nav-box', description: JSON.stringify(nav) });
    expect(nav.height, 'the nav is not tall enough to be a rail').toBeGreaterThan(viewport.height / 2);
    expect(nav.width, 'the nav is as wide as a bottom bar').toBeLessThan(viewport.width / 3);
    expect(nav.y, 'the nav is pinned to the bottom of the viewport').toBeLessThan(200);
  });

  test('nothing overflows horizontally on any top-level screen', async ({ page }) => {
    const bad: string[] = [];
    for (const path of ['./', './path', './puzzles', './play', './progress', './settings', './licences']) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      if (o.scroll > o.client + 1) bad.push(`${path}: scrollWidth ${String(o.scroll)} > clientWidth ${String(o.client)}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('the board and the coach sit side by side', async ({ page }) => {
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White' });
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
    // Force a coach line onto the screen so the bubble has geometry to measure.
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByRole('note', { name: /says$/ })).toBeVisible({ timeout: 60_000 });

    const board = await box(page, '[role="application"]');
    const coach = await box(page, '[role="note"]');
    test.info().annotations.push({
      type: 'geometry',
      description: `board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    });
    // Side by side = the coach starts to the right of the board's right edge
    // and their vertical extents overlap. Concept Note: "the board on the left
    // and the coach and lesson on the right".
    const sideBySide = coach.x >= board.x + board.width - 1 && coach.y < board.y + board.height;
    expect(
      sideBySide,
      `coach is below the board, not beside it: board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    ).toBe(true);
  });

  test('the board does not grow to fill a desktop column', async ({ page }) => {
    await page.goto('./play/game?tc=untimed&color=w&coach=1');
    const board = page.locator('[role="application"]');
    await expect(board).toBeVisible({ timeout: ENGINE_WAIT });
    const b = await box(page, '[role="application"]');
    test.info().annotations.push({ type: 'board-box', description: JSON.stringify(b) });
    expect(b.width, 'the board is not square').toBeCloseTo(b.height, -1);
  });
});

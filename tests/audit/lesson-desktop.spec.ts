import { test, expect, type Page } from '@playwright/test';
import { openLesson, readLesson } from './audit-helpers';

/**
 * Audit 1: the lesson player is the same single-column phone layout on a
 * desktop, so the board fills an 800px column and the coach and the primary
 * action fall below the fold. Concept Note 2 and the wireframe's desktop
 * screen ask for three parts side by side: the board on the left, the coach
 * and the lesson on the right. Measured geometry only — never class names.
 */

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

/** Open 1.1.1 and get to a challenge with a coach line on screen. */
async function openChallengeWithCoach(page: Page) {
  await openLesson(page, readLesson('1.1.1'));
  await expect(page.locator('#challenge-prompt')).toBeVisible();
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.getByRole('note', { name: /says$/ })).toBeVisible();
}

test.describe('the lesson player at 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the board and the coach sit side by side', async ({ page }) => {
    await openChallengeWithCoach(page);
    const board = await box(page, '[role="application"]');
    const coach = await box(page, '[role="note"]');
    test.info().annotations.push({
      type: 'geometry',
      description: `board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    });
    const sideBySide = coach.x >= board.x + board.width - 1 && coach.y < board.y + board.height;
    expect(
      sideBySide,
      `coach is below the board, not beside it: board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    ).toBe(true);
  });

  test('the board fits the viewport height and stays square', async ({ page }) => {
    await openChallengeWithCoach(page);
    // Measured from the top of the document: a board that only fits because the
    // page has been scrolled is exactly the defect under audit.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    const board = await box(page, '[role="application"]');
    test.info().annotations.push({ type: 'board-box', description: JSON.stringify(board) });
    expect(board.y, `the board starts above the fold: ${JSON.stringify(board)}`).toBeGreaterThanOrEqual(0);
    expect(board.width, 'the board is not square').toBeCloseTo(board.height, -1);
    expect(
      board.y + board.height,
      `the board runs past the fold: ${JSON.stringify(board)}`,
    ).toBeLessThanOrEqual(800);
  });

  test('the checkpoint renders through the same two-column player', async ({ page }) => {
    await page.goto('./checkpoint/1.1');
    await page.getByRole('button', { name: 'Start the checkpoint' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('#challenge-prompt')).toBeVisible();
    const board = await box(page, '[role="application"]');
    const prompt = await box(page, '#challenge-prompt');
    test.info().annotations.push({
      type: 'geometry',
      description: `board=${JSON.stringify(board)} prompt=${JSON.stringify(prompt)}`,
    });
    expect(
      prompt.x >= board.x + board.width - 1,
      `prompt is below the board: board=${JSON.stringify(board)} prompt=${JSON.stringify(prompt)}`,
    ).toBe(true);
    expect(board.y + board.height).toBeLessThanOrEqual(800);
  });

  test('nothing overflows horizontally in the lesson', async ({ page }) => {
    await openChallengeWithCoach(page);
    const o = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(o.scroll, `scrollWidth ${String(o.scroll)} > clientWidth ${String(o.client)}`).toBeLessThanOrEqual(
      o.client + 1,
    );
  });
});

test.describe('the lesson player at 390x844 is unchanged', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('one column: the prompt above the board, the coach below it', async ({ page }) => {
    await openChallengeWithCoach(page);
    const board = await box(page, '[role="application"]');
    const coach = await box(page, '[role="note"]');
    const prompt = await box(page, '#challenge-prompt');
    test.info().annotations.push({
      type: 'phone-geometry',
      description: `board=${JSON.stringify(board)} prompt=${JSON.stringify(prompt)} coach=${JSON.stringify(coach)}`,
    });
    expect(prompt.y, 'the prompt is no longer above the board').toBeLessThan(board.y);
    expect(coach.y, 'the coach is no longer below the board').toBeGreaterThanOrEqual(board.y + board.height - 1);
    expect(board.width, 'the board no longer fills the phone column').toBeGreaterThan(300);
    expect(coach.x, 'the coach has moved out of the single column').toBeLessThan(board.x + 2);
  });
});

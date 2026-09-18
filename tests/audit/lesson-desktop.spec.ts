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

  test('the board and the text column are a pair, not a board with a margin', async ({ page }) => {
    // PREMIUM-DELTA §1.1 measured the reference's pairing as a RATIO, not a
    // constant: a 424px board beside a 424px column with a 48px gutter at a
    // 1024px viewport. Literal 1:1 is the marketing hero's proportion and is
    // not reproducible here -- our board is height-constrained to 624px at
    // 800px tall, and 624 + 48 + 624 is 1296px, wider than the 1280px viewport
    // it has to live in. The reference class for a LESSON screen is the
    // in-product puzzles screen in §1.3, measured at the same 1280px width:
    // a 571px board against a right column of at most 1280 - 256 - 571 = 453px,
    // i.e. a ratio of about 1.4:1 with one item per row. That is the number
    // asserted here.
    //
    // Measured geometry only. The prompt is the full-width first item of the
    // right column, so its box IS the column's box.
    await openChallengeWithCoach(page);
    await page.evaluate(() => { window.scrollTo(0, 0); });
    const board = await box(page, '[role="application"]');
    const column = await box(page, '#challenge-prompt');
    const gutter = column.x - (board.x + board.width);
    const ratio = board.width / column.width;
    test.info().annotations.push({
      type: 'pairing',
      description: `board=${String(Math.round(board.width))} column=${String(Math.round(column.width))} gutter=${String(Math.round(gutter))} ratio=${ratio.toFixed(2)}`,
    });
    expect(ratio, `the text column is starved beside the board: board ${String(Math.round(board.width))}px vs column ${String(Math.round(column.width))}px`).toBeLessThanOrEqual(1.55);
    expect(gutter, `the gutter between the pair is ${String(Math.round(gutter))}px, below the reference's 48px`).toBeGreaterThanOrEqual(40);
    // Lower bound, so a fix can never be "shrink the board until the ratio
    // works": the board must still hold the share of the viewport that
    // §1.1 credits us with beating the reference on (45% in-product).
    expect(board.width / 1280, 'the board lost its scale advantage').toBeGreaterThanOrEqual(0.45);
  });

  test('the right column is one stack: no void between the prompt and the coach', async ({ page }) => {
    // PREMIUM-DELTA §3.2 measured ~250px of void in this column and Δ4.2
    // promised to close it: "prompt -> coach -> challenge index -> anchored
    // action ... one vertical stack, one item per row" (§1.3, chess.com's own
    // in-product pattern). The coach arrived; the stack did not. The board
    // spans two grid rows, so the slack is distributed BETWEEN the prompt and
    // everything under it instead of falling to the bottom of the column.
    //
    // What is asserted is the shape of the stack, not a pixel: consecutive
    // items in the right column are adjacent, and whatever free height the
    // column has ends up below the last of them.
    await openChallengeWithCoach(page);
    await page.evaluate(() => { window.scrollTo(0, 0); });
    const gaps = await page.evaluate(() => {
      const sec = document.querySelector('section')!;
      const board = document.querySelector('[role="application"]')!.getBoundingClientRect();
      const right = [...sec.children]
        .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent ?? '').trim().slice(0, 24) }))
        .filter((i) => i.r.width > 0 && i.r.height > 0 && i.r.x > board.x + board.width - 5)
        .sort((a, b) => a.r.y - b.r.y);
      return right.slice(1).map((i, n) => ({
        after: right[n]!.t,
        before: i.t,
        gap: Math.round(i.r.y - (right[n]!.r.y + right[n]!.r.height)),
      }));
    });
    test.info().annotations.push({ type: 'right-column-gaps', description: JSON.stringify(gaps) });
    // Negative control: a column with fewer than two items would report no gaps
    // and pass for the wrong reason.
    expect(gaps.length, 'the right column has fewer than two items to measure between').toBeGreaterThan(0);
    const worst = Math.max(...gaps.map((g) => g.gap));
    expect(worst, `void inside the right column: ${JSON.stringify(gaps)}`).toBeLessThanOrEqual(48);
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

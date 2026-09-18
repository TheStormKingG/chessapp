import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLesson, playThrough, readLesson, enableTextEntry, typeMove } from '../../tests/audit/audit-helpers';

/**
 * PREMIUM-DELTA P4d — re-shoot `docs/design/after/`.
 *
 * NEUMORPHIC-DELTA.md chunk N6 re-grounds the set: twelve screens x THREE
 * widths x ONE appearance = 36 files. 2000x1200 joins the matrix because §7 is
 * a claim about what a 2000px window does, and a set that stops at 1280 cannot
 * show whether it holds. `docs/design/before/` is never touched by this file,
 * and keeps its two-appearance set: it is the record of what the owner saw.
 *
 * Every shot is a viewport shot, not a full-page one: the review's questions
 * are about what a phone or a laptop actually shows at rest (how much of the
 * screen is void, whether the action is on the fold), and a full-page capture
 * answers a different question by silently extending the canvas.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'after');

const WIDTHS = [
  { tag: 'phone-390x844', width: 390, height: 844 },
  { tag: 'desktop-1280x800', width: 1280, height: 800 },
  { tag: 'desktop-2000x1200', width: 2000, height: 1200 },
] as const;

const APPEARANCES = [
  // One appearance (NEUMORPHIC-DELTA.md §4): one capture per screen and width.
  { suffix: '' },
] as const;

/** Settle: fonts loaded and one paint done, so type is never shot mid-swap. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => { requestAnimationFrame(r); }));
  });
  await page.waitForTimeout(150);
}

async function shoot(page: Page, name: string, tag: string, suffix: string) {
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await settle(page);
  await page.screenshot({ path: join(OUT, `${name}--${tag}${suffix}.png`) });
}

const LESSON = readLesson('1.1.1');

// The set is REPLACED, not merged -- the emptying is done by the caller before
// Playwright starts, never in a `beforeAll` that could fire again per worker and
// delete shots this run has already taken.
test.beforeAll(() => { mkdirSync(OUT, { recursive: true }); });

for (const w of WIDTHS) {
  for (const a of APPEARANCES) {
    test.describe(`${w.tag}${a.suffix}`, () => {
      test.use({ viewport: { width: w.width, height: w.height } });

      test('static screens', async ({ page }) => {
        await page.goto('./');
        await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
        // The lesson card's board is fetched, so Today is not shot until it is
        // there -- otherwise half the set would be missing the one thing P4b added.
        await expect(page.getByTestId('today-lesson-board')).toBeVisible({ timeout: 20_000 });
        await shoot(page, '01-today', w.tag, a.suffix);

        await page.goto('./path');
        await expect(page.getByRole('heading', { name: /path|foundations/i }).first()).toBeVisible();
        await shoot(page, '02-path', w.tag, a.suffix);

        await page.goto('./checkpoint/1.1');
        await expect(page.getByRole('button', { name: 'Start the checkpoint' })).toBeVisible();
        await shoot(page, '06-checkpoint-intro', w.tag, a.suffix);

        await page.goto('./play');
        await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();
        await shoot(page, '07-choose-opponent', w.tag, a.suffix);

        await page.goto('./progress');
        await expect(page.locator('main, section').first()).toBeVisible();
        await shoot(page, '09-progress', w.tag, a.suffix);

        await page.goto('./settings');
        await expect(page.getByLabel('Text move entry')).toBeVisible();
        await shoot(page, '10-settings', w.tag, a.suffix);

        await page.goto('./licences');
        await expect(page.locator('main, section').first()).toBeVisible();
        await shoot(page, '11-licences', w.tag, a.suffix);

        await page.goto('./no-such-route');
        await expect(page.getByRole('heading', { name: 'That page is not here' })).toBeVisible();
        await shoot(page, '12-not-found', w.tag, a.suffix);
      });

      test('the lesson, end to end', async ({ page }) => {
        await enableTextEntry(page);

        await page.goto(`./lesson/${LESSON.id}`);
        await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({ timeout: 20_000 });
        await shoot(page, '03-lesson-card', w.tag, a.suffix);

        await openLesson(page, LESSON);
        await expect(page.locator('#challenge-prompt')).toBeVisible();
        // A hint is asked for so the coach is on screen: the void the delta is
        // about is the one BELOW the coach, and a shot without it would be of a
        // state the learner barely sees.
        await page.getByRole('button', { name: 'Hint', exact: true }).click();
        await expect(page.getByRole('note', { name: /says$/ })).toBeVisible();
        await shoot(page, '04-lesson-challenge', w.tag, a.suffix);

        await playThrough(page, LESSON.challenges, { expectCorrect: false });
        await expect(page.getByText(/XP/).first()).toBeVisible({ timeout: 30_000 });
        await shoot(page, '05-lesson-close', w.tag, a.suffix);
      });

      test('a game in play', async ({ page }) => {
        await enableTextEntry(page);
        await page.goto('./play');
        await page.getByRole('button', { name: 'Untimed', exact: true }).click();
        await page.getByRole('button', { name: 'White', exact: true }).click();
        await page.getByRole('button', { name: 'Start game' }).click();
        await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: 120_000 });
        // Four plies, so the position is a game rather than the start position
        // and the move list has something in it.
        await typeMove(page, 'e4');
        await page.waitForTimeout(2500);
        await typeMove(page, 'Nf3');
        await page.waitForTimeout(2500);
        await shoot(page, '08-game-in-play', w.tag, a.suffix);
      });
    });
  }
}

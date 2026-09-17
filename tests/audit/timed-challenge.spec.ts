import { test, expect } from '@playwright/test';
import { ConsoleLog, enableTextEntry, openLesson, readLesson, typeMove } from './audit-helpers';

/**
 * REGRESSION for the removed promise. 1.1.1-c6 used to be authored with
 * `timeLimitS: 8` and a prompt that said "quickly", while nothing in `src/`
 * ever read the field: no countdown, no expiry, no penalty. A countdown is out
 * of Phase 0 scope (it needs timer chrome and star accounting in the player),
 * so the claim was withdrawn instead of half-kept. The app must not promise a
 * limit it does not run — in the content or on the screen.
 */
test('no challenge claims a time limit the app does not enforce', async ({ page }) => {
  const log = new ConsoleLog(page);
  await enableTextEntry(page);
  const lesson = readLesson('1.1.1');

  for (const c of lesson.challenges) {
    expect(c, `${c.id} declares no time limit`).not.toHaveProperty('timeLimitS');
    expect(c.prompt, `${c.id} does not promise speed`).not.toMatch(/quick|fast|hurry|seconds/i);
  }

  await openLesson(page, lesson);
  for (const c of lesson.challenges.slice(0, 5)) {
    if (c.type === 'find_them_all') {
      for (const sq of (c.answer as { squares: string[] }).squares) await typeMove(page, sq);
      await page.getByRole('button', { name: /^Check/ }).click();
    } else {
      await typeMove(page, (c.answer as { square: string }).square);
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  log.mark('sit on the last challenge of 1.1.1');
  await expect(page.getByText('6 of 6', { exact: true })).toBeVisible();
  const body = await page.locator('main').innerText();
  expect(body, 'and no countdown is shown either').not.toMatch(/\b\d+\s*s\b|seconds|time left/i);

  await page.waitForTimeout(10_000);
  await expect(page.getByText('6 of 6', { exact: true })).toBeVisible();
  await typeMove(page, 'c6');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('3 stars · 0 hints · 0 misses')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

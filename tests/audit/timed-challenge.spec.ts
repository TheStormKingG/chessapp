import { test, expect } from '@playwright/test';
import { ConsoleLog, enableTextEntry, openLesson, readLesson, typeMove } from './audit-helpers';

/**
 * DEFECT REPRODUCTION. Asserts the behaviour as it stands.
 *
 * 1.1.1-c6 is authored with `timeLimitS: 8` and a prompt that says "quickly".
 * `timeLimitS` appears nowhere in `src/` outside the type declaration, so
 * nothing counts, nothing shows, and nothing happens when the time passes.
 */
test('DEFECT: a challenge authored with a time limit has no timer at all', async ({ page }) => {
  const log = new ConsoleLog(page);
  await enableTextEntry(page);
  const lesson = readLesson('1.1.1');
  const timed = lesson.challenges[5]!;
  expect(timed.timeLimitS, 'fixture: this challenge declares a time limit').toBe(8);
  expect(timed.prompt).toContain('quickly');

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

  log.mark('sit on the timed challenge for longer than its limit');
  await expect(page.getByText('6 of 6')).toBeVisible();
  const body = await page.locator('main').innerText();
  expect(body, 'no countdown, clock or seconds-remaining is shown').not.toMatch(/\b\d+\s*s\b|seconds|time left/i);

  await page.waitForTimeout(10_000); // 2s past the authored limit
  // Nothing expired: the challenge is still accepting the answer, un-penalised.
  await expect(page.getByText('6 of 6')).toBeVisible();
  await typeMove(page, 'c6');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('3 stars · 0 hints · 0 misses')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

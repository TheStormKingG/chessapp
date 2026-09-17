import { test, expect } from '@playwright/test';
import { ConsoleLog, enableTextEntry, openLesson, readLesson } from './audit-helpers';

/**
 * Audit 2: a lesson left part-way is waiting for the learner, and the path and
 * Today have to say so. Leaving it at "Up next" hides work that has already
 * been done (PRD F-AC-1, and the resume record added in 8df54a1).
 */

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

test('an interrupted lesson reads as in progress on the path and on Today', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  const total = lesson.challenges.length;

  log.mark('fresh path says up next');
  await page.goto('./path');
  await expect(page.getByRole('link', { name: `1.1.1 ${lesson.title}. Up next` })).toBeVisible();
  await page.goto('./');
  await expect(page.getByText('Start this lesson')).toBeVisible();

  log.mark('leave 1.1.1 part-way');
  await openLesson(page, lesson);
  await expect(page.getByText(`1 of ${String(total)}`)).toBeVisible();
  await page.getByRole('button', { name: 'Exit lesson' }).click();
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(/\/path$/);

  log.mark('the path now offers to resume');
  await expect(
    page.getByRole('link', { name: `1.1.1 ${lesson.title}. In progress · 1 of ${String(total)}. Resume` }),
  ).toBeVisible();

  await page.goto('./');
  await expect(page.getByText(`In progress · 1 of ${String(total)}`)).toBeVisible();
  await expect(page.getByText('Resume this lesson')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

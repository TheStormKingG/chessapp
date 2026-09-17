import { test, expect } from '@playwright/test';
import { ConsoleLog, enableTextEntry, openLesson, readLesson, typeMove } from './audit-helpers';

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

test('reloading mid-lesson comes back on the challenge the learner was on', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible();

  log.mark('reload mid-lesson');
  await page.reload();

  // Fixed: the saved place is keyed by lesson id, so the run resumes on
  // challenge 2 rather than throwing the answered challenges away.
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('navigating away mid-challenge and back returns to the same challenge', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible();

  log.mark('leave via the Path tab and come back');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Path' }).click();
  await expect(page).toHaveURL(/\/path$/);
  // The path shows the lesson as unfinished, and now says where the run got to
  // and that the node resumes it rather than starting it over.
  await expect(
    page.getByRole('link', { name: /^1\.1\.1 The board\. In progress · 2 of 6\. Resume$/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('the browser back button leaves the lesson without a dead end', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await page.goto('./path');
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  log.mark('browser back from inside a lesson');
  await page.goBack();
  await expect(page).toHaveURL(/\/path$/);
  await expect(page.getByRole('link', { name: /1\.1\.1 The board/ })).toBeVisible();

  // Forward returns to the lesson. No challenge was reached before leaving, so
  // there is no place to resume to and the card is the right landing.
  await page.goForward();
  await expect(page).toHaveURL(/\/lesson\/1\.1\.1$/);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  expect(lesson.id).toBe('1.1.1');
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('the Exit control warns before leaving, and the place is kept', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  log.mark('press Exit lesson mid-run');
  await page.getByRole('button', { name: 'Exit lesson' }).click();
  // The learner is warned, and can change their mind.
  await expect(page.getByRole('heading', { name: 'Leave the lesson?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep going', exact: true }).click();
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Exit lesson' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page).toHaveURL(/\/path$/);
  // And the place survives the exit.
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('an unknown lesson id fails soft', async ({ page }) => {
  const log = new ConsoleLog(page);
  log.mark('open /lesson/9.9.9');
  await page.goto('./lesson/9.9.9');
  await expect(page.getByText('That lesson could not be loaded.')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Back to the path' }).click();
  await expect(page).toHaveURL(/\/path$/);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

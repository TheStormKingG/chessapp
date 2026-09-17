import { test, expect } from '@playwright/test';
import { ConsoleLog, enableTextEntry, openLesson, readLesson, typeMove } from './audit-helpers';

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

test('reloading mid-lesson restarts the lesson from the card', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('2 of 6')).toBeVisible();

  log.mark('reload mid-lesson');
  await page.reload();

  // Observed: the player comes back on the card, not on challenge 2 — three
  // answered challenges' worth of work is gone with no warning on the way out.
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('2 of 6')).toHaveCount(0);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('navigating away mid-challenge and back restarts the lesson', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('2 of 6')).toBeVisible();

  log.mark('leave via the Path tab and come back');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Path' }).click();
  await expect(page).toHaveURL(/\/path$/);
  // The path still shows the lesson as unfinished, which is right.
  await expect(page.getByRole('link', { name: /^1\.1\.1 The board\. Up next$/ })).toBeVisible();
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
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

  // Forward returns to the lesson, and it is usable (from the card again).
  await page.goForward();
  await expect(page).toHaveURL(/\/lesson\/1\.1\.1$/);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  expect(lesson.id).toBe('1.1.1');
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('the Exit control leaves a lesson in progress with no confirmation', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  log.mark('press Exit lesson mid-run');
  await page.getByRole('button', { name: 'Exit lesson' }).click();
  await expect(page).toHaveURL(/\/path$/);
  // No "are you sure" and no saved place: the next visit starts at the card.
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
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

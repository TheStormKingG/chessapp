import { test, expect, type Page } from '@playwright/test';
import {
  ConsoleLog,
  answerCorrectly,
  currentChallenge,
  enableTextEntry,
  openLesson,
  playThrough,
  readCheckpoint,
  readLesson,
} from './audit-helpers';

async function completeLesson(page: Page, id: string) {
  const lesson = readLesson(id);
  await openLesson(page, lesson);
  await playThrough(page, lesson.challenges);
  await page.getByRole('button', { name: 'Back to the path' }).click();
  await expect(page).toHaveURL(/\/path$/);
}

async function passCheckpoint(page: Page, unit: string) {
  const bank = readCheckpoint(unit);
  await page.goto(`./checkpoint/${unit}`);
  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 0; i < bank.sample; i++) {
    await expect(page.getByText(`${String(i + 1)} of ${String(bank.sample)}`)).toBeVisible();
    await answerCorrectly(page, await currentChallenge(page, bank.bank));
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'See your score' }).click();
}

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

test('a fresh path offers 1.1.1 and locks everything after it', async ({ page }) => {
  const log = new ConsoleLog(page);
  log.mark('fresh path');
  await page.goto('./path');
  await expect(page.getByRole('link', { name: /^1\.1\.1 The board\. Up next$/ })).toBeVisible();
  await expect(page.getByLabel('1.1.2 The rook. Locked')).toHaveAttribute('aria-disabled', 'true');
  // A built unit's checkpoint is attemptable from the start, to test out.
  await expect(
    page.getByRole('link', { name: /The board and the pieces checkpoint\. Attempt any time to test out/ }),
  ).toBeVisible();
  // Units 1.3 to 1.6 are "coming" and not clickable.
  for (const id of ['1.3.1', '1.4.1', '1.5.1', '1.6.1']) {
    const node = page.getByLabel(new RegExp(`^${id.replace(/\./g, '\\.')} .*Content coming$`));
    await expect(node).toHaveAttribute('aria-disabled', 'true');
    await expect(node.getByRole('link')).toHaveCount(0);
  }
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('completing a lesson marks it done with stars and activates the next', async ({ page }) => {
  const log = new ConsoleLog(page);
  log.mark('complete 1.1.1');
  await completeLesson(page, '1.1.1');
  await expect(page.getByRole('link', { name: '1.1.1 The board. 3 stars' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^1\.1\.2 The rook\. Up next$/ })).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('passing a checkpoint completes the unit and unlocks the next', async ({ page }) => {
  test.setTimeout(180_000);
  const log = new ConsoleLog(page);
  log.mark('pass checkpoint 1.1 cold');
  await passCheckpoint(page, '1.1');
  await expect(page.getByRole('heading', { name: 'Checkpoint passed' })).toBeVisible();
  await expect(page.getByText(/Unit 1\.1 complete/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to the path' }).click();

  await expect(
    page.getByRole('link', { name: /The board and the pieces checkpoint\. Passed/ }),
  ).toBeVisible();
  // Its lessons read as tested out, and unit 1.2 is now the active work.
  await expect(page.getByRole('link', { name: '1.1.1 The board. Tested out' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^1\.2\.1 .*Up next$/ })).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('Today points at the current node, and at the checkpoint once the lessons are done', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const log = new ConsoleLog(page);
  log.mark('today, cold');
  await page.goto('./');
  await expect(page.getByRole('link', { name: /Lesson 1\.1\.1/ })).toBeVisible();
  await page.getByRole('link', { name: /Lesson 1\.1\.1/ }).click();
  await expect(page).toHaveURL(/\/lesson\/1\.1\.1$/);

  log.mark('finish every lesson of unit 1.1');
  for (const id of ['1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8']) {
    await completeLesson(page, id);
  }

  await page.goto('./');
  const node = page.getByRole('link', { name: /Checkpoint 1\.1/ });
  await expect(node, 'Today must point at the checkpoint once the unit is taught').toBeVisible();
  await node.click();
  await expect(page).toHaveURL(/\/checkpoint\/1\.1$/);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('a replay is accepted and never lowers the recorded stars', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  await completeLesson(page, '1.1.1');
  await expect(page.getByRole('link', { name: '1.1.1 The board. 3 stars' })).toBeVisible();
  const xpAfterFirst = await xp(page);

  log.mark('replay 1.1.1 badly');
  await openLesson(page, lesson);
  // Two misses on the first challenge: a one-star run on its own.
  for (const bad of ['h1', 'h2']) {
    await page.getByLabel('Type a move').fill(bad);
    await page.getByLabel('Type a move').press('Enter');
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await playThrough(page, lesson.challenges.slice(1), {
    startIndex: 1,
    total: lesson.challenges.length,
  });
  await expect(page.getByText(/^[12] stars/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to the path' }).click();

  // The recorded stars are the best run, not the last.
  await expect(page.getByRole('link', { name: '1.1.1 The board. 3 stars' })).toBeVisible();
  // A replay still earns something, at half rate.
  expect(await xp(page)).toBeGreaterThan(xpAfterFirst);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

async function xp(page: Page): Promise<number> {
  await page.goto('./');
  return Number(/(\d+) XP so far/.exec(await page.locator('main').innerText())![1]);
}

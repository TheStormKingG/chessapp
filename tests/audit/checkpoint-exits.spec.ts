import { test, expect } from '@playwright/test';
import { ConsoleLog, currentChallenge, readCheckpoint } from './audit-helpers';

/**
 * The failure screen used to offer exactly one control, "Practise the missed
 * ideas", while every sibling screen (intro, pass, lesson close) offers a way
 * back to the path. It now offers both, in the siblings' wording and placement.
 */
test('the checkpoint failure screen offers a way back to the path', async ({ page }) => {
  test.setTimeout(120_000);
  const log = new ConsoleLog(page);
  const bank = readCheckpoint('1.1');
  log.mark('fail checkpoint 1.1');
  await page.goto('./checkpoint/1.1');
  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 0; i < bank.sample; i++) {
    await expect(page.getByText(`${String(i + 1)} of ${String(bank.sample)}`)).toBeVisible();
    await currentChallenge(page, bank.bank); // identify, for the record
    await page.getByRole('button', { name: 'Show me' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'See your score' }).click();

  await expect(page.getByRole('heading', { name: 'Not yet' })).toBeVisible();
  await expect(page.getByText('You scored 0 per cent')).toBeVisible();

  const buttons = await page.locator('main button, main a[href]').allInnerTexts();
  expect(buttons.map((b) => b.trim())).toEqual(['Practise the missed ideas', 'Back to the path']);
  await page.getByRole('button', { name: 'Back to the path' }).click();
  await expect(page).toHaveURL(/\/path$/);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('exiting a checkpoint mid-attempt warns, and the attempt is not resumed', async ({ page }) => {
  const log = new ConsoleLog(page);
  await page.goto('./checkpoint/1.1');
  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('1 of 10', { exact: true })).toBeVisible();

  log.mark('exit the checkpoint mid-attempt');
  await page.getByRole('button', { name: 'Exit checkpoint' }).click();
  // A graded attempt is deliberately NOT resumable, so the warning says so.
  await expect(page.getByRole('heading', { name: 'Leave the attempt?' })).toBeVisible();
  await expect(page.getByText(/would start it again from the beginning/)).toBeVisible();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page).toHaveURL(/\/path$/);
  // The attempt is not recorded at all, and the intro comes back clean.
  await page.goto('./checkpoint/1.1');
  await expect(page.getByRole('button', { name: 'Start the checkpoint' })).toBeVisible();
  await expect(page.getByText(/Three attempts without a pass/)).toHaveCount(0);
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

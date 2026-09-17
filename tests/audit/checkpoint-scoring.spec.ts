import { test, expect } from '@playwright/test';
import {
  ConsoleLog,
  answerCorrectly,
  answerWrongOnce,
  currentChallenge,
  enableTextEntry,
  readCheckpoint,
} from './audit-helpers';

/**
 * REGRESSION. `scoreAttempt` counts a challenge as correct when its result
 * carries `mastery`, and mastery now means answered unaided AND first time
 * (`hints === 0 && misses === 0`). A learner who misses every question, takes
 * the offered retry and then answers it has learned something — the retry is a
 * teaching move — but has demonstrated no mastery, so the checkpoint fails
 * them rather than testing them out of the unit (PRD 6.4).
 */
test('a checkpoint scores nothing for questions that were missed before they were answered', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const log = new ConsoleLog(page);
  const bank = readCheckpoint('1.1');
  await enableTextEntry(page);

  log.mark('checkpoint 1.1, one deliberate miss on every question');
  await page.goto('./checkpoint/1.1');
  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  let missed = 0;
  for (let i = 0; i < bank.sample; i++) {
    await expect(page.getByText(`${String(i + 1)} of ${String(bank.sample)}`)).toBeVisible();
    const c = await currentChallenge(page, bank.bank);
    await answerWrongOnce(page, c);
    // A retry must have been offered for the miss to be the "free" one.
    if ((await page.getByRole('button', { name: 'Next', exact: true }).count()) === 0) {
      missed += 1;
      await answerCorrectly(page, c);
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 30_000 });
  }
  await page.getByRole('button', { name: 'See your score' }).click();

  expect(missed, 'every question was missed once and then answered').toBe(bank.sample);
  await expect(page.getByRole('heading', { name: 'Checkpoint passed' })).toHaveCount(0);
  await expect(page.getByText('0 per cent')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

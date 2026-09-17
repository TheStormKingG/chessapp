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
 * DEFECT REPRODUCTION. Asserts the behaviour as it stands.
 *
 * `scoreAttempt` counts a challenge as correct when its result carries
 * `mastery`, and `LessonMachine` sets `mastery = hints === 0 && misses <= 1`.
 * Since a checkpoint allows no hints, that reduces to "correct, with at most
 * one miss" — so a learner can get every one of the ten questions wrong on the
 * first attempt, take the offered retry, and still score 100 per cent.
 */
test('DEFECT: a checkpoint scores 100 per cent when every question was missed once', async ({
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
  await expect(page.getByRole('heading', { name: 'Checkpoint passed' })).toBeVisible();
  await expect(page.getByText('100 per cent')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

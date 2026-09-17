import { test, expect, type Page } from '@playwright/test';
import { answerCorrectly, enableTextEntry, openLesson, readLesson } from './audit-helpers';

async function advanceTo(page: Page, lessonId: string, upto: number) {
  const lesson = readLesson(lessonId);
  await openLesson(page, lesson);
  for (let i = 0; i < upto; i++) {
    await answerCorrectly(page, lesson.challenges[i]!);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  return lesson;
}

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

/**
 * REGRESSION. The reason step used to be titled "Why is it safe?" / "Why is it
 * not safe?" over reasons authored as restated verdicts ("Yes, ...", "No, ..."),
 * so a learner who had just said the move was safe was offered two reasons that
 * opened by saying it was not. The step now asks one neutral question, the
 * authored reasons read as reasons, and the verdict can be taken back.
 */
test('the reason step asks a neutral question over reasons, not restated verdicts', async ({
  page,
}) => {
  // 1.2.4-c2: safe = true, reasons[1] is the right one.
  const lesson = await advanceTo(page, '1.2.4', 1);
  const c = lesson.challenges[1]!;
  expect((c.answer as { safe: boolean }).safe).toBe(true);

  // Each answer group is labelled with the question it answers (F-AX-1).
  await page
    .getByRole('group', { name: c.prompt })
    .getByRole('button', { name: 'Yes, it is safe' })
    .click();

  const group = page.getByRole('group', { name: 'Why?' });
  await expect(group).toBeVisible();
  const offered = await group.getByRole('button').allInnerTexts();
  expect(offered).toEqual(c.reasons);
  expect(
    offered.filter((r) => /^(Yes|No)[,:]/.test(r)),
    'no reason restates the verdict the learner has already given',
  ).toHaveLength(0);

  // And a mis-tapped verdict is correctable.
  await page.getByRole('button', { name: 'Change answer' }).click();
  await expect(page.getByRole('group', { name: c.prompt })).toBeVisible();
  await page.getByRole('button', { name: 'No, it is not safe' }).click();
  await expect(page.getByRole('group', { name: 'Why?' })).toBeVisible();
});

test('an is_it_safe challenge accepts its intended verdict and reason', async ({ page }) => {
  const lesson = await advanceTo(page, '1.2.1', 2);
  const c = lesson.challenges[2]!;
  await expect(page.getByText(`Proposed move: ${c.move!}. Is it safe?`)).toBeVisible();
  await answerCorrectly(page, c);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
});

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
 * DEFECT REPRODUCTION. Asserts the behaviour as it stands.
 *
 * `ChallengeView` asks the verdict, then offers the whole `reasons` array under
 * the label "Why is it safe?" / "Why is it not safe?". The authored reasons are
 * written as complete answers beginning "Yes, ..." or "No, ...", so a learner
 * who has just answered "Yes, it is safe" is asked *why it is safe* and offered
 * two reasons that open by saying it is not. All 16 is_it_safe challenges in
 * section 1 are authored this way.
 */
test('DEFECT: the reason list contradicts the verdict the learner just gave', async ({ page }) => {
  // 1.2.4-c2: safe = true, reasons[1] is the right one.
  const lesson = await advanceTo(page, '1.2.4', 1);
  const c = lesson.challenges[1]!;
  expect((c.answer as { safe: boolean }).safe).toBe(true);

  await page
    .getByRole('group', { name: 'Is the move safe?' })
    .getByRole('button', { name: 'Yes, it is safe' })
    .click();

  const group = page.getByRole('group', { name: 'Why is it safe?' });
  await expect(group).toBeVisible();
  const offered = await group.getByRole('button').allInnerTexts();
  expect(offered).toEqual(c.reasons);
  expect(
    offered.filter((r) => r.startsWith('No,')),
    'reasons offered under "Why is it safe?" that begin by saying it is not',
  ).toHaveLength(2);

  // There is also no way back: the verdict step is gone once answered, and the
  // only controls left are the three reasons plus the player's own footer.
  await expect(page.getByRole('group', { name: 'Is the move safe?' })).toHaveCount(0);
});

test('an is_it_safe challenge accepts its intended verdict and reason', async ({ page }) => {
  const lesson = await advanceTo(page, '1.2.1', 2);
  const c = lesson.challenges[2]!;
  await expect(page.getByText(`Proposed move: ${c.move!}. Is it safe?`)).toBeVisible();
  await answerCorrectly(page, c);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
});

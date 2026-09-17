import { test, expect, type Page } from '@playwright/test';
import { ConsoleLog, answerCorrectly, enableTextEntry, openLesson, readLesson, typeMove } from './audit-helpers';

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

test('a play_it_out drill is winnable and reports the goal met', async ({ page }) => {
  test.setTimeout(240_000);
  const log = new ConsoleLog(page);
  // 1.2.4-c6: "get a pawn to the far side", goal promote within 20 moves.
  const lesson = await advanceTo(page, '1.2.4', 5);
  const c = lesson.challenges[5]!;
  expect(c.goal).toEqual({ kind: 'promote', moves: 20 });

  log.mark('play out 1.2.4-c6');
  await expect(page.getByText('Moves used: 0 of 20')).toBeVisible({ timeout: 120_000 });

  const next = page.getByRole('button', { name: 'Next', exact: true });
  for (const m of ['b5', 'b6', 'b7', 'b8=Q']) {
    if (await next.isVisible()) break;
    await typeMove(page, m);
    await expect(page.getByText(`You played`)).toBeVisible();
    await page.waitForTimeout(1500);
  }
  await expect(next).toBeVisible({ timeout: 60_000 });
  // The drill was passed, not revealed: a met goal is scored as correct.
  await expect(page.getByRole('note', { name: /says$/ })).toContainText('Yes.');
  await next.click();
  await expect(page.getByText('3 stars · 0 hints · 0 misses')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

/**
 * DEFECT REPRODUCTION. Asserts the behaviour as it stands.
 *
 * `revealText` for a play_it_out is `Here is the idea. ${c.reason ?? ''}` and
 * `revealHighlights` returns {} for a challenge with no `hints`. All three
 * play_it_out challenges in section 1 have neither, so the learner's only way
 * out of a drill they cannot solve says "Here is the idea" and then shows none.
 */
test('DEFECT: Show me on a play_it_out reveals nothing', async ({ page }) => {
  test.setTimeout(180_000);
  const lesson = await advanceTo(page, '1.2.3', 5);
  const c = lesson.challenges[5]!;
  expect(c.type).toBe('play_it_out');
  expect(c.reason, 'fixture: no authored reason to fall back on').toBeUndefined();

  await expect(page.getByText('Moves used: 0 of 30')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Show me' }).click();

  await expect(page.getByRole('note', { name: /says$/ })).toHaveText('Here is the idea.');
  // Nothing else: no move named, no arrow, no highlight, board untouched.
  expect(await page.locator('path[stroke="#a23b3b"], path[stroke="#1f5f4a"]').count()).toBe(0);
  await expect(page.getByText('Moves used: 0 of 30')).toBeVisible();
});

/**
 * Observation, asserted as it stands: a play_it_out offers the same enabled
 * Hint control as every other challenge, and none of the three declares hints.
 */
test('DEFECT: the Hint control is offered on a drill that has no hints', async ({ page }) => {
  test.setTimeout(180_000);
  const lesson = await advanceTo(page, '1.2.5', 5);
  expect(lesson.challenges[5]!.hints).toBeUndefined();
  await expect(page.getByText('Moves used: 0 of 12')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeEnabled();
});

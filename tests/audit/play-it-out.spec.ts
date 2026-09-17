import { test, expect, type Page } from '@playwright/test';
import {
  ConsoleLog,
  accentSquares,
  answerCorrectly,
  enableTextEntry,
  openLesson,
  readLesson,
  typeMove,
} from './audit-helpers';

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
  // The drill was passed, not revealed: a met goal is scored as correct, and
  // the coach's line on a correct answer is the challenge's own authored reason.
  await expect(page.getByRole('note', { name: /says$/ })).toContainText(c.reason!);
  await next.click();
  await expect(page.getByText('3 stars · 0 hints · 0 misses')).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

/**
 * REGRESSION. "Show me" on a drill used to say four words and touch nothing,
 * because none of the three play_it_out challenges authored a `reason` or
 * `hints`. All three now author both, so the reveal names the plan and lights
 * up the squares it is played on.
 */
test('Show me on a play_it_out names the idea and shows it on the board', async ({ page }) => {
  test.setTimeout(180_000);
  const lesson = await advanceTo(page, '1.2.3', 5);
  const c = lesson.challenges[5]!;
  expect(c.type).toBe('play_it_out');
  expect(c.reason, 'fixture: the drill authors the idea').toBeTruthy();
  expect(c.hints, 'fixture: and the squares it is played on').toEqual({ piece: 'd1', square: 'a4' });

  await expect(page.getByText('Moves used: 0 of 30')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Show me' }).click();

  const said = page.getByRole('note', { name: /says$/ });
  await expect(said).toContainText('Here is the idea.');
  await expect(said, 'the learner comes away knowing what to do').toContainText(c.reason!);
  expect(await accentSquares(page), 'and where to do it').toEqual(['a4']);
  await expect(page.getByText('Moves used: 0 of 30')).toBeVisible();
});

/** REGRESSION: the Hint control on a drill now has something to give. */
test('the Hint control on a drill gives a hint', async ({ page }) => {
  test.setTimeout(180_000);
  const lesson = await advanceTo(page, '1.2.5', 5);
  expect(lesson.challenges[5]!.hints).toEqual({ piece: 'e1', square: 'd2' });
  await expect(page.getByText('Moves used: 0 of 12')).toBeVisible({ timeout: 120_000 });
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(hint).toBeEnabled();
  await hint.click();
  expect(await accentSquares(page)).toEqual(['e1']);
});

import { test, expect, type Page } from '@playwright/test';
import {
  ConsoleLog,
  accentSquares,
  answerCorrectly,
  enableTextEntry,
  openLesson,
  playThrough,
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

const HINT_COST = 'A move after a hint still earns progress, but no mastery credit.';

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

test('hint one highlights the piece, hint two the square, and the cost is announced', async ({
  page,
}) => {
  const log = new ConsoleLog(page);
  // 1.1.2-c3: which_square a8, hints { piece: a1, square: a8 } — the only
  // shape in which "piece then square" is even expressible.
  const lesson = await advanceTo(page, '1.1.2', 2);
  const c = lesson.challenges[2]!;
  expect(c.hints, 'fixture: this challenge declares both a piece and a square').toEqual({
    piece: 'a1',
    square: 'a8',
  });

  log.mark('take both hints on 1.1.2-c3');
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  // The honest-accounting note is reachable by a screen reader, not only on hover.
  await expect(hint).toHaveAccessibleDescription(HINT_COST);
  await hint.click();
  expect(await accentSquares(page)).toEqual([c.hints!.piece]);

  const hint2 = page.getByRole('button', { name: 'Second hint' });
  await expect(hint2).toHaveAccessibleDescription(HINT_COST);
  await hint2.click();
  expect(await accentSquares(page)).toEqual([c.hints!.square]);

  // No third hint.
  await expect(page.getByRole('button', { name: 'No more hints' })).toBeDisabled();

  // A correct answer after a hint still completes the challenge...
  await typeMove(page, (c.answer as { square: string }).square);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('a hint costs a star', async ({ page }) => {
  const lesson = readLesson('1.1.2');

  // Clean run first: three stars.
  await openLesson(page, lesson);
  await playThrough(page, lesson.challenges);
  await expect(page.getByText('3 stars · 0 hints · 0 misses')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the path' }).click();

  // Same lesson, one hint taken: two.
  await openLesson(page, lesson);
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await playThrough(page, lesson.challenges);
  await expect(page.getByText('2 stars · 1 hints · 0 misses')).toBeVisible();
});

test('the hint control on a challenge that declares no hints does nothing', async ({ page }) => {
  const log = new ConsoleLog(page);
  // 1.1.1-c1 declares no `hints` at all, but the control is still offered.
  const lesson = readLesson('1.1.1');
  expect(lesson.challenges[0]!.hints, 'fixture: this challenge declares no hints').toBeUndefined();
  await openLesson(page, lesson);

  log.mark('press Hint on a hintless challenge');
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(hint).toBeEnabled();
  await hint.click();
  await page.waitForTimeout(300);

  // Nothing is highlighted, no line is said, and the label does not advance:
  // the press is silently swallowed.
  expect(await accentSquares(page), 'no square is highlighted').toEqual([]);
  await expect(page.getByRole('note', { name: /says$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

/**
 * DEFECT REPRODUCTION. Asserts the behaviour as it stands.
 *
 * `LessonMachine`'s hint handler resolves the second hint as
 * `hints.square ?? hints.piece`. On a challenge that declares only one of the
 * two, the second hint therefore highlights the square the first one already
 * highlighted — while still charging a hint and costing a star.
 */
test('DEFECT: the second hint repeats the first when only one hint square is authored', async ({
  page,
}) => {
  // 1.2.1-c4 declares { piece: 'd3' } and no square.
  const lesson = await advanceTo(page, '1.2.1', 3);
  const c = lesson.challenges[3]!;
  expect(c.hints).toEqual({ piece: 'd3' });

  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  const first = await accentSquares(page);
  expect(first).toEqual(['d3']);

  await page.getByRole('button', { name: 'Second hint' }).click();
  const second = await accentSquares(page);
  expect(second, 'the second hint shows nothing the first did not').toEqual(first);

  // And it was charged: the run can no longer be a three-star one.
  await page.getByRole('button', { name: 'No more hints' }).isDisabled();
});

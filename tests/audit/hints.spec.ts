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

/**
 * REGRESSION. The first lesson a beginner opens used to author no hints at all
 * on any of its six challenges, while the control stayed enabled and swallowed
 * every press. Both halves are fixed: every lesson challenge now authors at
 * least one hint stage, and the machine publishes `hintAvailable` so the player
 * can disable the control where it has nothing to give.
 */
test('the first lesson gives a real hint on every challenge', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.1');
  for (const c of lesson.challenges) {
    expect(c.hints, `${c.id} authors a hint`).toBeTruthy();
  }
  await openLesson(page, lesson);

  log.mark('press Hint on the first challenge a beginner ever sees');
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(hint).toBeEnabled();
  await hint.click();

  // A which_square on an empty teaching board has no piece to light up, so the
  // hint names the file — something the position verifies (PRD F-CO-4).
  await expect(page.getByRole('note', { name: /says$/ })).toContainText('e-file');
  // And the second hint is a different fact, not the same one again.
  await page.getByRole('button', { name: 'Second hint' }).click();
  await expect(page.getByRole('note', { name: /says$/ })).toContainText('fourth rank');
  await expect(page.getByRole('button', { name: 'No more hints' })).toBeDisabled();
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

/**
 * REGRESSION. A challenge that authors only one hint square has exactly one
 * hint stage. The second press used to resolve to the same square while still
 * charging a hint and a star; now there is no second stage to spend, so the
 * press changes nothing and costs nothing.
 */
test('a second hint that would repeat the first is neither shown nor charged', async ({ page }) => {
  // 1.2.1-c4 declares { piece: 'd3' } and no square.
  const lesson = await advanceTo(page, '1.2.1', 3);
  const c = lesson.challenges[3]!;
  expect(c.hints).toEqual({ piece: 'd3' });

  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  expect(await accentSquares(page)).toEqual(['d3']);

  await page.getByRole('button', { name: 'Second hint' }).click();
  expect(await accentSquares(page), 'still the one square there was to show').toEqual(['d3']);

  // And the repeat was not charged: the close reports one hint, not two.
  for (let i = 3; i < lesson.challenges.length; i++) {
    await answerCorrectly(page, lesson.challenges[i]!);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByText(/· 1 hints ·/)).toBeVisible();
});

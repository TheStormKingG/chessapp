import { test, expect, type Page } from '@playwright/test';
import {
  ConsoleLog,
  answerCorrectly,
  enableTextEntry,
  openLesson,
  readLesson,
  refutationArrows,
  typeMove,
} from './audit-helpers';

/** Open `lessonId` and answer its challenges up to (not including) index `upto`. */
async function advanceTo(page: Page, lessonId: string, upto: number) {
  const lesson = readLesson(lessonId);
  await openLesson(page, lesson);
  for (let i = 0; i < upto; i++) {
    const c = lesson.challenges[i]!;
    await expect(page.getByText(`${String(i + 1)} of ${String(lesson.challenges.length)}`)).toBeVisible();
    await answerCorrectly(page, c);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  return lesson;
}

const coach = (page: Page) => page.getByRole('note', { name: /says$/ });

test.describe('the wrong-answer path', () => {
  test.beforeEach(async ({ page }) => {
    await enableTextEntry(page);
  });

  test('an authored wrong move gets its authored line and a retry', async ({ page }) => {
    const log = new ConsoleLog(page);
    // 1.1.2-c4: answer Rxa5, with authored feedback for Ra3.
    const lesson = await advanceTo(page, '1.1.2', 3);
    const c = lesson.challenges[3]!;
    expect(c.wrong?.['Ra3'], 'fixture: Ra3 must carry authored feedback').toBeTruthy();

    log.mark('play the authored wrong move Ra3');
    await typeMove(page, 'Ra3');

    await expect(coach(page)).toContainText(c.wrong!['Ra3']!);
    // A retry is offered: the answering surface is still live and the player
    // has not advanced.
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Type a move')).toBeEnabled();
    await expect(page.getByText('4 of 6', { exact: true })).toBeVisible();

    // And the retry actually accepts the right answer.
    await typeMove(page, 'Rxa5');
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });

  test('a wrong move with no authored line gets an engine refutation arrow and a coach line', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const log = new ConsoleLog(page);
    // 1.2.3-c2: answer Rxg2, no `wrong` map. Rg8 is legal and wrong.
    const lesson = await advanceTo(page, '1.2.3', 1);
    const c = lesson.challenges[1]!;
    expect(c.wrong, 'fixture: this challenge must have no authored wrong map').toBeUndefined();

    log.mark('play the unauthored wrong move Rg8');
    await typeMove(page, 'Rg8');

    // The generic line lands first; the engine line replaces it.
    await expect(coach(page)).toBeVisible();
    // The refuting move is drawn on the board as an arrow. A3 took red off the
    // board (DESIGN-SYSTEM.md 5), so the arrow is now the review mark rather
    // than #a23b3b, and its colour is resolved from the page by the helper so
    // this passes in either appearance. (The arrowhead <polygon> lives in a
    // <marker> and is never itself visible; the drawn line is the <path>.)
    await expect
      .poll(() => refutationArrows(page), { timeout: 60_000 })
      .toHaveLength(1);
    // The arrow names the refuting move in its marker id, e.g. "...-g2-e3".
    expect((await refutationArrows(page))[0]).toMatch(/-[a-h][1-8]-[a-h][1-8]\)$/);
    // ...and the coach says what the refutation costs.
    await expect(coach(page)).toHaveText(/After [^.]+, /, { timeout: 60_000 });
    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });

  test('two misses reveal the answer', async ({ page }) => {
    const log = new ConsoleLog(page);
    const lesson = await advanceTo(page, '1.1.2', 3);
    const c = lesson.challenges[3]!;

    log.mark('miss twice on 1.1.2-c4');
    await typeMove(page, 'Ra3');
    await expect(coach(page)).toContainText(c.wrong!['Ra3']!);
    await typeMove(page, 'Kf1');

    // The solution is stated, and the only way on is Next.
    await expect(coach(page)).toContainText('The answer is Rxa5');
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });
});

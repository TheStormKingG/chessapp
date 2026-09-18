import { test, expect } from '@playwright/test';
import {
  ConsoleLog,
  blurredShadows,
  boardElevationViolations,
  enableTextEntry,
  lessonIds,
  openLesson,
  playThrough,
  readLesson,
} from './audit-helpers';

/**
 * Every built lesson, driven end to end with the answers its own content JSON
 * declares. A lesson that cannot be completed this way is a critical defect.
 */
for (const id of lessonIds()) {
  test(`lesson ${id} can be completed with its authored answers`, async ({ page }) => {
    test.setTimeout(180_000);
    const log = new ConsoleLog(page);
    const lesson = readLesson(id);

    await enableTextEntry(page);
    log.mark(`lesson ${id}`);
    await openLesson(page, lesson);

    // PREMIUM-DELTA.md Δ1: depth is a crisp edge, never a blur, and elevation
    // stops at the board. Read off computed style on a real challenge screen.
    expect(await boardElevationViolations(page)).toEqual([]);
    expect(await blurredShadows(page)).toEqual([]);

    // The card carries the idea; the explain screens have been stepped through
    // by openLesson, which fails if any Next is missing.
    const { revealed } = await playThrough(page, lesson.challenges);

    // Close screen: stars, takeaway, XP.
    await expect(page.getByRole('heading', { name: 'Lesson done' })).toBeVisible();
    await expect(page.getByText(/^[123] stars · \d+ hints · \d+ misses$/)).toBeVisible();
    await expect(page.getByText(lesson.takeaway, { exact: true })).toBeVisible();
    await expect(page.getByText(`+${String(lesson.xp)} XP`)).toBeVisible();
    await page.getByRole('button', { name: 'Back to the path' }).click();
    await expect(page).toHaveURL(/\/path$/);

    // Report anything the run put on the console.
    const problems = log.problems();
    expect(problems.map((p) => `${p.type}: ${p.text}`), 'console was clean').toEqual([]);
    // Surface any challenge the driver could not answer directly.
    expect(revealed, `challenges with no declarable answer in ${id}`).toEqual(
      lesson.challenges.filter((c) => c.type === 'play_it_out').map((c) => c.id),
    );
  });
}

test('the card screen shows the lesson idea before any challenge', async ({ page }) => {
  const lesson = readLesson('1.1.1');
  await page.goto(`./lesson/${lesson.id}`);
  await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(lesson.card.idea, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (const e of lesson.explain) {
    await expect(page.getByText(e.text, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByText('1 of 6', { exact: true })).toBeVisible();
});

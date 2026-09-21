import { test, expect } from '@playwright/test';
import {
  ConsoleLog,
  driverCanPlay,
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

    // NEUMORPHIC-DELTA.md §2 reverses Δ1 rule 1: blur is the house style now,
    // so the guard allows exactly the sanctioned shadow tokens and nothing
    // else. Δ1 rule 4 is untouched -- elevation still stops at the board.
    // Read off computed style on a real challenge screen.
    expect(await boardElevationViolations(page)).toEqual([]);
    expect(await blurredShadows(page)).toEqual([]);

    // The negative control, in the same run and on the same page: a guard that
    // has just returned [] is reporting on two possibilities at once, and only
    // one of them is "the page is clean". A hand-rolled soft shadow must be
    // caught -- the numeric cap this replaced would have waved through anything
    // under its limit, so proving the token comparison bites is the point.
    // The marker is a CLASS, not an id: `blurredShadows` reports each element
    // as `tag.class :: shadow`, so an id would be invisible in its output and
    // the control would fail for the wrong reason.
    const MARKER = 'blur-negative-control';
    await page.evaluate((marker) => {
      const el = document.createElement('div');
      el.className = marker;
      el.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
      document.body.append(el);
    }, MARKER);
    const caught = await blurredShadows(page);
    await page.evaluate((marker) => document.querySelector(`.${marker}`)?.remove(), MARKER);
    expect(caught.some((e) => e.includes(MARKER))).toBe(true);

    // The card carries the idea; the explain screens have been stepped through
    // by openLesson, which fails if any Next is missing.
    const { revealed } = await playThrough(page, lesson.challenges);

    // Close screen: stars, takeaway, XP.
    await expect(page.getByRole('heading', { name: 'Lesson done' })).toBeVisible();
    await expect(
      page.getByText(/^(1 star|[23] stars) · (1 hint|\d+ hints) · (1 miss|\d+ misses)$/),
    ).toBeVisible();
    await expect(page.getByText(lesson.takeaway, { exact: true })).toBeVisible();
    await expect(page.getByText(`+${String(lesson.xp)} XP`)).toBeVisible();
    await page.getByRole('button', { name: 'Back to the path' }).click();
    await expect(page).toHaveURL(/\/path$/);

    // Report anything the run put on the console.
    const problems = log.problems();
    expect(problems.map((p) => `${p.type}: ${p.text}`), 'console was clean').toEqual([]);
    // Surface any challenge the driver could not answer directly.
    // A `play_it_out` is revealed only when the driver cannot work the move
    // out for itself. It can now play a mate in one (see `driverCanPlay`), so
    // those are ANSWERED and must not appear here. Deriving the list from the
    // same predicate the driver uses keeps the two from drifting; spelling the
    // condition out again here is how this assertion would silently start
    // expecting the wrong lesson's challenges.
    expect(revealed, `challenges with no declarable answer in ${id}`).toEqual(
      lesson.challenges.filter((c) => !driverCanPlay(c)).map((c) => c.id),
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

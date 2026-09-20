import { test, expect, type Page } from '@playwright/test';
import {
  ConsoleLog,
  answerCorrectly,
  currentChallenge,
  enableTextEntry,
  lessonIds,
  openLesson,
  playThrough,
  readCheckpoint,
  readLesson,
  typeMove,
  unitIds,
} from './audit-helpers';

/**
 * The PRD's Phase 0 exit criterion, mechanised:
 *
 *   "a tester with no chess knowledge completes Section 1 on a mid-range phone
 *    and plays a legal game against the bot."
 *
 * Claimable for the first time now that all six units are built, so it is
 * asserted rather than described. The viewport is the project default,
 * 390x844, which is the mid-range phone; the engine is the real Stockfish, in
 * the browser, which is why the budget is what it is.
 *
 * "No chess knowledge" is modelled the only way a script can model it: every
 * answer comes from the content's own authored answer, never from judgement
 * about the position -- the same thing a learner gets from the lesson in front
 * of them. Nothing here reaches past the UI to set progress directly; the
 * section is completed by working through it.
 *
 * One lesson per unit is played in full and the unit's checkpoint is then
 * passed, which is the path a learner who tests out takes; unit 1.6 -- the one
 * that closes the section -- is played in full, every lesson. Per-lesson
 * coverage of the other twenty-three is `lessons.spec.ts`, which drives all of
 * them; this spec's job is the end-to-end journey, not the corpus.
 */
test.describe('PRD Phase 0 exit criterion', () => {
  test.setTimeout(900_000);

  async function passCheckpoint(page: Page, unit: string): Promise<void> {
    const bank = readCheckpoint(unit);
    await page.goto(`./checkpoint/${unit}`);
    await page.getByRole('button', { name: 'Start the checkpoint' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    for (let i = 0; i < bank.sample; i++) {
      await expect(page.getByText(`${String(i + 1)} of ${String(bank.sample)}`)).toBeVisible({
        timeout: 30_000,
      });
      await answerCorrectly(page, await currentChallenge(page, bank.bank), { scored: true });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.getByRole('button', { name: 'See your score' }).click();
  }

  async function playLesson(page: Page, id: string): Promise<void> {
    const lesson = readLesson(id);
    await openLesson(page, lesson);
    await playThrough(page, lesson.challenges);
    await page.getByRole('button', { name: 'Back to the path' }).click();
    await expect(page).toHaveURL(/\/path$/);
  }

  test('Section 1 is completed end to end, then a legal game is played', async ({ page }) => {
    const log = new ConsoleLog(page);
    log.mark('phase 0 exit');
    await enableTextEntry(page);

    const units = unitIds();
    expect(units).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6']);

    // The whole section is on the path from the first screen, and nothing on it
    // is out of reach: no node anywhere says the content is still coming.
    await page.goto('./path');
    await expect(page.getByText('Content coming')).toHaveCount(0);
    for (const unit of units) {
      await expect(page.locator(`a[href="/checkpoint/${unit}"]`)).toHaveCount(1);
    }

    for (const [u, unit] of units.entries()) {
      const lessons = lessonIds().filter((id) => id.startsWith(`${unit}.`));
      // The unit's first lesson is the active node the moment the unit opens.
      await page.goto('./path');
      await expect(
        page.getByRole('link', { name: new RegExp(`^${lessons[0]!.replace(/\./g, '\\.')} .*Up next$`) }),
      ).toBeVisible();

      // Unit 1.6 closes the section, so it is played in full.
      const toPlay = unit === '1.6' ? lessons : [lessons[0]!];
      for (const id of toPlay) await playLesson(page, id);

      // A finished lesson is marked done, which is how the learner sees the
      // path move under them.
      await expect(
        page.getByRole('link', { name: new RegExp(`^${toPlay[0]!.replace(/\./g, '\\.')} .*stars?$`) }),
      ).toBeVisible();

      await passCheckpoint(page, unit);
      await expect(page.getByText(/passed/i).first()).toBeVisible({ timeout: 30_000 });

      // Passing the checkpoint completes the unit and opens the next one --
      // the unit-boundary advance, asserted at every boundary in the section.
      const next = units[u + 1];
      await page.goto('./path');
      await expect(page.locator(`a[href="/checkpoint/${unit}"]`)).toHaveCount(1);
      if (next) {
        const firstOfNext = lessonIds().find((id) => id.startsWith(`${next}.`))!;
        await expect(
          page.getByRole('link', {
            name: new RegExp(`^${firstOfNext.replace(/\./g, '\\.')} .*Up next$`),
          }),
        ).toBeVisible();
      }
    }

    // The section is finished: Today has nothing left to offer. (Today is the
    // app's index route, `/` -- `/today` is a 404.)
    await page.goto('./');
    await expect(
      page.getByText('You have finished everything that is built so far. More lessons are coming.'),
    ).toBeVisible();

    /* ------------------------------------------- and a legal game vs Rosa */

    await page.goto('./play');
    await page.getByRole('button', { name: 'Start game' }).click();
    const moveInput = page.getByLabel('Type a move');
    await expect(moveInput).toBeVisible({ timeout: 180_000 });

    const moves = page.getByRole('listitem').filter({ hasText: /^\d+\./ });
    // Four legal moves, each answered by Rosa. An illegal move would be
    // refused by the app, so a completed pair IS the legality assertion.
    for (const [i, san] of ['e4', 'Nf3', 'Bc4', 'O-O'].entries()) {
      await typeMove(page, san);
      await expect(moves.nth(i)).toHaveText(new RegExp(`^${String(i + 1)}\\.`), { timeout: 120_000 });
      await expect(moves.nth(i)).toHaveText(/\S+\s+\S+/, { timeout: 120_000 });
    }

    // ...played to a RESULT. Resignation is a result, and it is the one a
    // script can reach without playing a winning game of chess.
    await page.getByRole('button', { name: 'Resign' }).click();
    await expect(page.getByRole('heading', { name: 'Resign this game?' })).toBeVisible();
    await page.getByRole('button', { name: 'Resign' }).click();
    await expect(page.getByLabel(/of 3 crowns/)).toBeVisible({ timeout: 60_000 });

    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });
});

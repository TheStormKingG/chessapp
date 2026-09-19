import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, readEvents, resign, startGame, typeMove } from '../audit-platform/helpers';

/**
 * The review loop, end to end, against the real engine.
 *
 * SERIAL, on one page, and deliberately so. A full game plus a real analysis
 * pass plus the deeper second pass is minutes of engine time, and eight
 * independent cycles would be most of an hour for one feature. `sw-upgrade.spec.ts`
 * already establishes serial-with-shared-state as this suite's answer to an
 * expensive fixture, so this follows it rather than inventing a second
 * arrangement. The order below is the learner's order — analyse, read the
 * summary, work the moments, finish — so each test asserts on the stage the
 * previous one left, and a failure names the stage that broke.
 *
 * The OFFLINE case (F-RV-10) is NOT here: it needs a real service worker, and
 * `npm run test:e2e` serves this suite from the dev server, where
 * `devOptions.enabled: false` means no worker exists at all. It lives in
 * `tests/e2e/review-offline.spec.ts`, on the production-build fixtures that
 * `swFixtures.ts` already serves.
 */

const ENGINE_WAIT = 120_000;
const REVIEW_WAIT = 240_000;

const LABEL_WORDS = [
  'Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
];

function moveList(page: Page) {
  return page.getByRole('listitem').filter({ hasText: /^\d+\./ });
}
function momentCounter(page: Page) {
  return page.getByText(/^Moment \d+ of \d+$/);
}
function isOver(page: Page): Promise<boolean> {
  return page.getByLabel(/of 3 crowns/).isVisible().catch(() => false);
}

/**
 * Moves that are legal from the start in this order and hang material as they
 * go, so the analysis has real errors to label. A sound opening produces a
 * review with nothing in it, which would leave most of this file asserting on
 * an empty list.
 */
const SLOPPY = ['Na3', 'Nh3', 'Nb5', 'Ng5', 'Nxc7+', 'Nxh7'];

async function playAndFinish(page: Page): Promise<void> {
  await enableTextEntry(page);
  await startGame(page, { tc: 'Untimed', colour: 'White', coach: false });
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
  for (let i = 0; i < SLOPPY.length; i++) {
    if (await isOver(page)) break;
    await typeMove(page, SLOPPY[i]!);
    // Rosa must actually reply before the next move goes in — the pattern
    // tests/audit-platform/play.spec.ts already uses.
    await expect(moveList(page).nth(i)).toHaveText(/^\d+\.\s+\S+\s+\S+/, { timeout: ENGINE_WAIT });
  }
  if (!(await isOver(page))) await resign(page);
  await expect(page.getByLabel(/of 3 crowns/)).toBeVisible();
}

/** Click through to the review and return the gameId the route was given. */
async function openReview(page: Page): Promise<string> {
  await page.getByRole('button', { name: /review this game/i }).click();
  await expect(page).toHaveURL(/\/play\/review\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split('/').pop()!;
}

async function reviewedCount(page: Page, gameId: string): Promise<number> {
  const rows = await readEvents(page, 'game_reviewed');
  return rows.filter((r) => (r as { payload: { gameId: string } }).payload.gameId === gameId).length;
}

/** The XP the app is actually showing the learner (TodayScreen). */
async function shownXp(page: Page): Promise<number> {
  await page.goto('./');
  const text = await page.getByText(/\d+ XP so far/).innerText();
  return Number(/(\d+) XP so far/.exec(text)![1]);
}

/**
 * Work every key moment from here to the end, taking "Show me" on each one.
 * Enters from the summary if that is where we are, and resumes mid-run if an
 * earlier test in this serial file already stepped in — returning the number of
 * moments actually worked so a caller can refuse a run that saw none.
 */
async function walkMoments(page: Page): Promise<number> {
  const start = page.getByRole('button', { name: 'Start with the first moment' });
  if (await start.count()) await start.click();
  await expect(momentCounter(page)).toBeVisible({ timeout: 30_000 });
  let seen = 0;
  for (;;) {
    const before = await momentCounter(page).innerText();
    // Every moment asks before it reveals — the property the `key` on
    // KeyMomentView exists to keep.
    await expect(
      page.getByRole('button', { name: 'Show me' }),
      `${before} opened already revealed`,
    ).toBeVisible();
    await page.getByRole('button', { name: 'Show me' }).click();
    seen += 1;
    const finish = page.getByRole('button', { name: 'Finish' });
    if (await finish.count()) {
      await finish.click();
      return seen;
    }
    await page.getByRole('button', { name: 'Next moment' }).click();
    await expect(momentCounter(page)).not.toHaveText(before, { timeout: 30_000 });
  }
}

/**
 * The fix-it drill is only built from three or more logged errors, so a clean
 * game does not get one (`MIN_DRILL` in fixIt.ts). Returns whether it ran, so a
 * caller can assert on the branch it actually took instead of passing either way
 * in silence.
 */
async function completeDrillIfOffered(page: Page): Promise<boolean> {
  const done = page.getByRole('heading', { name: 'Review done' });
  if (!(await page.getByRole('button', { name: 'Show me' }).count()) && !(await done.count())) return false;
  for (let i = 0; i < 12; i++) {
    if (await done.count()) return true;
    const show = page.getByRole('button', { name: 'Show me' });
    if (await show.count()) await show.click();
    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (await next.count()) await next.click();
    else break;
  }
  return (await done.count()) > 0;
}

test.describe.configure({ mode: 'serial' });

test.describe('the review loop', () => {
  test.setTimeout(REVIEW_WAIT);

  let page: Page;
  let gameId: string;
  let drillRan = false;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await playAndFinish(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // 4. The progress bar is a readable quantity.
  test('while analysing, progress is a labelled quantity and not only a bar', async () => {
    gameId = await openReview(page);
    const bar = page.getByRole('progressbar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', /^\d+$/);
    await expect(bar).toHaveAttribute('aria-valuemax', /^\d+$/);
    // A bar alone is not a quantity anyone can read.
    await expect(page.getByText(/move \d+ of \d+/i)).toBeVisible();
  });

  // 8. Colour is never the only channel.
  test('every label chip carries its word, not only a glyph and a hue', async () => {
    await expect(page.getByRole('heading', { name: 'Game review' })).toBeVisible({ timeout: REVIEW_WAIT });
    const chips = page.getByRole('listitem').filter({ hasText: new RegExp(LABEL_WORDS.join('|')) });
    const n = await chips.count();
    expect(n, 'the summary showed no label chips at all').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const text = await chips.nth(i).innerText();
      expect(
        LABEL_WORDS.some((w) => text.includes(w)),
        `a chip read "${text}" — the label word is not in its accessible text`,
      ).toBe(true);
    }
  });

  // 7. 44px targets and a 32px root, at the screen's widest.
  test('the summary survives a 32px root with the definitions open, and its taps measure 44px', async () => {
    // The definitions expanded is the widest this screen ever gets.
    await page.getByRole('button', { name: /what do these mean/i }).click();
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(m.scrollW, `the review overflows by ${String(m.scrollW - m.clientW)}px`).toBeLessThanOrEqual(m.clientW + 1);

    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('.tap')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44 || r.width < 44) {
          out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    expect(small, small.join('; ')).toEqual([]);
  });

  // 6. One live region and one board on the key-moment screen.
  test('the key-moment screen has one board and one live region that is not hidden', async () => {
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.getByRole('button', { name: /what do these mean/i }).click();
    await page.getByRole('button', { name: 'Start with the first moment' }).click();
    await expect(momentCounter(page)).toBeVisible();

    await expect(page.getByTestId('review-board')).toHaveCount(1);

    /*
     * NOT a raw [aria-live] count. The board's drag-and-drop library adds a
     * live region of its own inside the role="application" container, and
     * Board.tsx neutralises it with aria-hidden="true" rather than removing it
     * — so the raw count is 2 by design and asserting 1 would be asserting a
     * third-party internal. The property that matters to a screen reader is
     * that exactly one region is actually announced.
     */
    const live = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-live]')].filter(
        (el) => !el.closest('[aria-hidden="true"]') && el.getAttribute('aria-hidden') !== 'true',
      ).length,
    );
    expect(live, 'more than one live region would talk over itself').toBe(1);
  });

  // 1. The loop closes, and 2. the event is banked before anything says "done".
  test('the loop closes: exactly one game_reviewed, banked before the review is left', async () => {
    expect(await reviewedCount(page, gameId), 'banked before the review was finished').toBe(0);

    const moments = await walkMoments(page);
    expect(moments, 'no key moments were shown at all').toBeGreaterThan(0);

    drillRan = await completeDrillIfOffered(page);
    if (drillRan) {
      // Design spec §8: the commit must not be attached to one particular exit,
      // or every other exit is silent loss. So the event is ALREADY banked at
      // the moment the screen first says the review is done.
      await expect(page.getByRole('heading', { name: 'Review done' })).toBeVisible();
      expect(await reviewedCount(page, gameId), 'the screen said done before the event was banked').toBe(1);
      await page.getByRole('button', { name: 'Back to the path' }).click();
    }

    // Either exit lands on the path, with the review already recorded and no
    // further click required to record it.
    await expect(page).toHaveURL(/\/path$/, { timeout: 30_000 });
    expect(await reviewedCount(page, gameId)).toBe(1);
  });

  /*
   * 3. A second visit does not double-count.
   *
   * DEVIATION from the plan, which asked for "the game_reviewed count for that
   * gameId is still 1". That is the wrong layer, and asserting it would have
   * been asserting a bug into existence. The event log is append-only and a
   * second review IS a second fact; `reduce.ts` says so where it handles the
   * event: "the same game reviewed twice, by two events with two ids. Both are
   * needed." The component's `banked` ref cannot prevent it either — a second
   * visit is a fresh mount and a fresh ref, by construction.
   *
   * What "does not double-count" actually promises is that the learner is not
   * paid twice, and that is the projection's job. So the log is asserted to
   * grow (the fact is recorded) while the XP the learner is shown does not
   * move, and the game is still counted once.
   */
  test('reviewing the same game again records the visit but does not pay twice', async () => {
    const xpBefore = await shownXp(page);
    const eventsBefore = await reviewedCount(page, gameId);
    expect(eventsBefore).toBe(1);

    await page.goto(`./play/review/${gameId}`);
    // Cached, so this returns without re-analysing.
    await expect(page.getByRole('heading', { name: 'Game review' })).toBeVisible({ timeout: REVIEW_WAIT });
    const moments = await walkMoments(page);
    expect(moments, 'the second visit showed no moments, so it proved nothing').toBeGreaterThan(0);
    await completeDrillIfOffered(page);
    await expect(page).toHaveURL(/\/path$/, { timeout: 30_000 });

    // The visit is recorded — if it were not, the XP assertion below would pass
    // for the uninteresting reason that nothing happened at all.
    expect(
      await reviewedCount(page, gameId),
      'the second review was not recorded, so this proves nothing about double-counting',
    ).toBe(2);

    // And the learner is not paid for it twice.
    expect(await shownXp(page), 'the same game was paid for twice').toBe(xpBefore);
  });
});

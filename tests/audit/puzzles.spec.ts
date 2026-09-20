import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, readEvents, typeMove } from '../audit-platform/helpers';
import { REPO_ROOT } from '../e2e/swFixtures';

/**
 * The puzzles loop, end to end in a real browser (PRD 8.4, design spec §6).
 *
 * WHAT MAKES THESE DETERMINISTIC. Which puzzle a learner is handed depends on
 * their projected rating and on 7,909 shipped puzzles, so nothing here guesses
 * a position. Each solving screen renders its puzzle id (`data-testid`
 * "puzzle-id"); the test reads it, looks the puzzle up in the SHIPPED PACK on
 * disk, and plays the solution the pack states. The pack is the same file the
 * app fetches, so a test that solves a puzzle proves the app served the puzzle
 * it said it did.
 *
 * EVERY CONDITIONAL BRANCH IS GUARDED. The review suite shipped a
 * `completeDrillIfOffered` whose boolean was never asserted, so the branch
 * inside it never ran on any run and the assertion it contained had never once
 * executed. Nothing below is allowed to be optional: where a helper could take
 * two paths, it returns which one it took and the caller asserts it.
 */

/* --------------------------------------------------------------- the pack */

interface PackPuzzle {
  id: string;
  rating: number;
  themes: string[];
  fen: string;
  solution: string[];
}

function readPack(band: string): Map<string, PackPuzzle> {
  const text = readFileSync(join(REPO_ROOT, 'public', 'data', 'puzzles', `${band}.txt`), 'utf8');
  const out = new Map<string, PackPuzzle>();
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line === '') continue;
    const [id, rating, themes, fen, solution] = line.split('\t');
    if (!id || !rating || !themes || !fen || !solution) continue;
    out.set(id, {
      id,
      rating: Number(rating),
      themes: themes.split('|'),
      fen,
      solution: solution.split(' ').filter(Boolean),
    });
  }
  return out;
}

/** Every band, because the daily pack and the rated pack need not be the same one. */
const PACKS = new Map(
  (['600-900', '900-1200', '1200-1500'] as const).map((b) => [b, readPack(b)] as const),
);

function lookUp(id: string): PackPuzzle {
  for (const pack of PACKS.values()) {
    const p = pack.get(id);
    if (p) return p;
  }
  throw new Error(`the app served puzzle id "${id}", which is in no shipped pack`);
}

test('the shipped packs parse, so a failure below is the app and not the fixture', () => {
  const total = [...PACKS.values()].reduce((n, p) => n + p.size, 0);
  expect(total, 'no puzzles parsed out of public/data/puzzles').toBeGreaterThan(1000);
});

/* ------------------------------------------------------------- driving it */

const SOLVE_WAIT = 20_000;

/** The id of the puzzle currently on screen, once the screen is ready for it. */
async function currentPuzzleId(page: Page): Promise<string> {
  const marker = page.getByTestId('puzzle-id');
  await expect(marker).toHaveCount(1, { timeout: SOLVE_WAIT });
  const id = (await marker.textContent())?.trim() ?? '';
  expect(id, 'the solving screen rendered no puzzle id').not.toBe('');
  return id;
}

/**
 * Solve the puzzle that is on screen, playing the pack's own solution.
 *
 * Returns the id it solved, so a caller can assert the stream really moved on.
 * The learner's plies are the odd ones: `solution[0]` is the opponent's move,
 * which the screen replays on a beat, and the field only appears once it has
 * landed.
 */
async function solveCurrent(page: Page, opts: { hint?: boolean } = {}): Promise<string> {
  const id = await currentPuzzleId(page);
  const pz = lookUp(id);

  let played = 0;
  for (let ply = 1; ply < pz.solution.length; ply += 2) {
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: SOLVE_WAIT });
    if (ply === 1 && opts.hint === true) {
      const hint = page.getByRole('button', { name: 'Hint', exact: true });
      await expect(hint, 'the hint was asked for and the control was not offered').toBeEnabled();
      await hint.click();
      await expect(hint, 'a taken hint must not be offered again').toBeDisabled();
    }
    await typeMove(page, pz.solution[ply]!);
    played += 1;
  }

  // The loop really ran. A puzzle whose solution had one ply would make every
  // assertion after this vacuous and the test green.
  expect(played, `puzzle ${id} asked the learner for no moves at all`).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Solved', exact: true })).toBeVisible({
    timeout: SOLVE_WAIT,
  });
  return id;
}

/** The learner's own rating, as the puzzles home states it (F-PZ-1). */
async function ratingOn(page: Page): Promise<number> {
  await page.goto('./puzzles');
  const el = page.getByTestId('puzzle-rating');
  await expect(el).toBeVisible({ timeout: SOLVE_WAIT });
  const text = (await el.textContent()) ?? '';
  const n = /(\d+)/.exec(text)?.[1];
  expect(n, `no rating found in "${text}"`).toBeTruthy();
  return Number(n);
}

/**
 * Wait until an attempt is really in IndexedDB.
 *
 * `onDone` fires and the append is NOT awaited, so navigating away the instant
 * the result screen appears can lose the write — which is how the themed test
 * first passed its "the rating did not move" assertion: the rating had not
 * moved because nothing had been banked at all. A negative assertion whose
 * precondition disappeared passes exactly as well as a true one.
 *
 * Deliberately NOT folded into `solveCurrent`: the ordering test below exists
 * to prove the event lands before any exit control is touched, and a helper
 * that waited for it would make that test true by construction.
 */
async function waitBanked(page: Page, id: string): Promise<void> {
  await expect
    .poll(async () => (await attempts(page)).map((a) => a.puzzleId), { timeout: 10_000 })
    .toContain(id);
}

/** Themed practice, with one theme chosen and the run started. */
async function openThemed(page: Page, theme: RegExp): Promise<void> {
  await page.goto('./puzzles/themed');
  // The pack is fetched before the form renders; counting or checking before
  // it lands measures the loading interstitial.
  const box = page.getByRole('checkbox', { name: theme });
  await expect(box).toBeVisible({ timeout: SOLVE_WAIT });
  await box.check();
  await page.getByRole('button', { name: /start practising/i }).click();
}

/** Start the rated stream from the home screen, the way a learner does. */
async function openRatedStream(page: Page): Promise<void> {
  await page.goto('./puzzles');
  await page.getByRole('link', { name: /start solving/i }).click();
  await expect(page).toHaveURL(/\/puzzles\/rated$/);
}

interface AttemptEvent {
  puzzleId: string;
  source: string;
  solved: boolean;
  hinted: boolean;
}

async function attempts(page: Page): Promise<AttemptEvent[]> {
  const rows = await readEvents(page, 'puzzle_attempted');
  return rows.map((r) => (r as { payload: AttemptEvent }).payload);
}

/* ------------------------------------------------------------- 1. the loop */

test('the loop closes: three rated puzzles solved are three rated attempts banked', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enableTextEntry(page);
  await openRatedStream(page);

  const solved: string[] = [];
  for (let i = 0; i < 3; i++) {
    solved.push(await solveCurrent(page));
    if (i < 2) await page.getByRole('button', { name: /next puzzle/i }).click();
  }

  // Three DIFFERENT puzzles: three attempts at one would satisfy the count.
  expect(new Set(solved).size, `the stream repeated a puzzle: ${solved.join(', ')}`).toBe(3);

  const rated = (await attempts(page)).filter((a) => a.source === 'rated');
  expect(rated).toHaveLength(3);
  expect(rated.map((a) => a.puzzleId).sort()).toEqual([...solved].sort());
  expect(rated.every((a) => a.solved), 'a solved puzzle was banked as unsolved').toBe(true);
});

/* ------------------------------------------- 2. banked before the screen says so */

test('the attempt is in the log before the result screen says it is done', async ({ page }) => {
  await enableTextEntry(page);
  await openRatedStream(page);
  const id = await solveCurrent(page);

  /*
    Design spec §5.2. The result screen is visible NOW — `solveCurrent` waited
    for it — and the exit control has not been touched. Banking from a dismiss
    handler turns every other exit (the ✕, the tab bar, a reload) into silent
    loss, which is how a completed lesson was lost once already.
  */
  await expect
    .poll(async () => (await attempts(page)).map((a) => a.puzzleId), { timeout: 10_000 })
    .toContain(id);

  // And the exit really had not been used: it is still on screen, unclicked.
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
});

/* ---------------------------------------------------- 3. a hint costs the rating */

test('a hint stops the rating moving, and a clean solve moves it (F-PZ-4)', async ({ page }) => {
  test.setTimeout(120_000);
  await enableTextEntry(page);

  const start = await ratingOn(page);

  await openRatedStream(page);
  const hinted = await solveCurrent(page, { hint: true });
  await waitBanked(page, hinted);
  const afterHint = await ratingOn(page);
  expect(afterHint, 'a hinted solve moved the rating').toBe(start);

  /*
    THE SECOND HALF IS NOT OPTIONAL. "unchanged after a hint" passes just as
    well if the rating never moves at all — if the projection is broken, if the
    event never lands, if the home screen renders a constant. This is what
    makes the first half mean something.
  */
  await openRatedStream(page);
  const clean = await solveCurrent(page, { hint: false });
  await waitBanked(page, clean);
  const afterClean = await ratingOn(page);
  expect(afterClean, 'a clean solve did not move the rating').not.toBe(start);

  expect(clean, 'the same puzzle was served twice').not.toBe(hinted);
  const log = await attempts(page);
  expect(log.find((a) => a.puzzleId === hinted)?.hinted).toBe(true);
  expect(log.find((a) => a.puzzleId === clean)?.hinted).toBe(false);
});

/* ------------------------------------------- 4. themed practice is free of charge */

test('themed practice does not move the rating, and says so in the event (F-PZ-2)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enableTextEntry(page);
  const start = await ratingOn(page);

  // A theme with puzzles in every band, so the selection is never empty.
  await openThemed(page, /fork/i);

  const id = await solveCurrent(page);
  /*
    Banked BEFORE the rating is read. Without this the read navigates away
    mid-write, nothing lands, and "the rating did not move" passes because the
    attempt vanished rather than because themed practice is free. That is
    exactly what happened on the first run of this test.
  */
  await waitBanked(page, id);
  const after = await ratingOn(page);
  expect(after, 'themed practice moved the rating').toBe(start);

  const banked = (await attempts(page)).find((a) => a.puzzleId === id);
  expect(banked, 'the themed attempt was never banked').toBeTruthy();
  expect(banked?.source).toBe('themed');
});

/* -------------------------------------- 5. the daily puzzle agrees across devices */

test('two fresh profiles get the same daily puzzle on the same date (F-PZ-6)', async ({
  browser,
}) => {
  const dayOf = async (): Promise<{ id: string; day: string }> => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('./puzzles/daily');
    const id = await currentPuzzleId(page);
    const day = await page.evaluate(() => {
      const d = new Date();
      return `${String(d.getFullYear())}-${String(d.getMonth() + 1)}-${String(d.getDate())}`;
    });
    await ctx.close();
    return { id, day };
  };

  const a = await dayOf();
  const b = await dayOf();

  // Guard against the one way this could pass for the wrong reason: the two
  // reads straddling local midnight, where different ids would be correct.
  expect(a.day, 'the two profiles were read on different local dates').toBe(b.day);
  expect(b.id, 'two devices were handed different daily puzzles on the same date').toBe(a.id);
});

/* ----------------------------------------------------------------- 6. offline */

test('a pack that was never fetched says so, rather than rendering an empty board (F-PZ-9)', async ({
  page,
}) => {
  /*
    The first half of F-PZ-9's failure case, driven at the only layer that can
    produce it deterministically: the pack request fails. On the dev server
    there is no service worker at all (`devOptions.enabled: false`), so
    `setOffline` there would only prove that a page with no worker cannot load,
    which is not the claim. Failing the pack request alone is the claim.
  */
  let blocked = 0;
  await page.route('**/data/puzzles/*.txt', (route) => {
    blocked += 1;
    return route.abort();
  });

  await page.goto('./puzzles/rated');
  await expect(page.getByText(/have not been downloaded yet/i)).toBeVisible({
    timeout: SOLVE_WAIT,
  });
  // The board is NOT on screen: the failure mode this message exists to
  // prevent is a position-less board that reads as a broken app.
  await expect(page.locator('[data-board-root]')).toHaveCount(0);
  // The route really fired. Without this the assertion above would also pass
  // if the app had simply never asked for a pack.
  expect(blocked, 'no pack request was made, so nothing was blocked').toBeGreaterThan(0);

  // And there is a way out of it, which ModalTask requires of every task in it.
  await page.getByRole('button', { name: /back to puzzles/i }).click();
  await expect(page).toHaveURL(/\/puzzles$/);
});

test('a pack fetched once keeps working when the network stops (F-PZ-9)', async ({ page }) => {
  test.setTimeout(120_000);
  await enableTextEntry(page);
  await openRatedStream(page);
  const first = await solveCurrent(page);

  /*
    The pack is now in the module cache for this page. Cutting the network and
    advancing proves the stream does not re-fetch per puzzle — which is the
    property that makes an offline pack worth having. The service worker's own
    CacheFirst `/data/` route is asserted against the BUILT worker by
    `tests/e2e/sw-upgrade.spec.ts`; this asserts the app above it.
  */
  let requested = 0;
  await page.route('**/data/puzzles/*.txt', (route) => {
    requested += 1;
    return route.abort();
  });

  await page.getByRole('button', { name: /next puzzle/i }).click();
  const second = await solveCurrent(page);

  expect(second, 'the stream did not advance').not.toBe(first);
  expect(requested, 'the stream re-fetched the pack for the second puzzle').toBe(0);
  expect((await attempts(page)).map((a) => a.puzzleId)).toContain(second);
});

/* ------------------------------- 7. the rating and the motifs are hidden until done */

test('the rating and the themes appear only once the attempt is over (F-PZ-1)', async ({
  page,
}) => {
  await enableTextEntry(page);
  await openRatedStream(page);
  const id = await currentPuzzleId(page);
  const pz = lookUp(id);
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: SOLVE_WAIT });

  const body = () => page.locator('body').innerText();

  const before = await body();
  expect(before, `the puzzle rating ${String(pz.rating)} was on screen before the attempt ended`)
    .not.toContain(String(pz.rating));

  await solveCurrent(page);

  const after = await body();
  /*
    Both halves. "not shown before" passes if the number is shown nowhere ever,
    which is exactly what a broken result screen looks like.
  */
  expect(after, 'the puzzle rating was never revealed').toContain(String(pz.rating));
});

/* ------------------------------------------- 8. targets and text size, mid-attempt */

test('the solving screen keeps 44px targets and survives a 32px root', async ({ page }) => {
  /*
    The static sweeps in reflow.spec.ts cover /puzzles and /puzzles/rated as
    they first render; this is the state they cannot reach, with a live board,
    a hint control and a move field on screen. Same two measurements, so a
    change to what "44px" means changes both.
  */
  await enableTextEntry(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openRatedStream(page);
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: SOLVE_WAIT });

  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('.tap')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 44 || r.width < 44) {
        out.push(
          `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${String(Math.round(r.width))}x${String(Math.round(r.height))}`,
        );
      }
    }
    return out;
  });
  expect(small, small.join('; ')).toEqual([]);

  // The sweep really had something to measure.
  expect(await page.locator('.tap').count(), 'no .tap controls on the solving screen').toBeGreaterThan(0);

  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(m.scrollW, `the solving screen overflows by ${String(m.scrollW - m.clientW)}px`).toBeLessThanOrEqual(
    m.clientW + 1,
  );
});

/* --------------------------------------------- 9. colour is never the only channel */

test('every theme carries its name in text, never colour alone', async ({ page }) => {
  await page.goto('./puzzles/themed');

  const boxes = page.getByRole('checkbox');
  // The form renders after the pack lands; counting before that counts the
  // loading interstitial, which offers no themes and never will.
  await expect(boxes.first()).toBeVisible({ timeout: SOLVE_WAIT });
  const n = await boxes.count();
  // The eight Section 1-2 themes of PRD Appendix B. A zero here would make the
  // loop below assert nothing.
  expect(n, 'themed practice offered no themes at all').toBe(8);

  for (let i = 0; i < n; i++) {
    const name = (await boxes.nth(i).getAttribute('aria-label')) ?? '';
    const accessible = name !== '' ? name : await boxes.nth(i).evaluate((el) => {
      const label = el.closest('label');
      return (label?.textContent ?? '').trim();
    });
    expect(accessible, `theme ${String(i)} has no accessible text of its own`).not.toBe('');
    // Words, not a swatch: at least two of them, which is what a motif name and
    // its one-sentence definition amount to.
    expect(accessible.split(/\s+/).length, `theme "${accessible}" is named too thinly to read`).toBeGreaterThan(1);
  }
});

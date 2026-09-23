import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, startGame } from './helpers';

const ENGINE_WAIT = 120_000;

test.use({ viewport: { width: 1280, height: 800 } });

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

test.describe('desktop layout at 1280x800', () => {
  test.setTimeout(180_000);

  test('the navigation is a vertical rail, not a bottom bar', async ({ page }) => {
    await page.goto('./');
    const nav = await box(page, 'nav[aria-label="Main"]');
    const viewport = page.viewportSize()!;
    // Measured, not inferred from class names: a rail is tall and narrow and
    // starts at the top; a bottom bar is wide and sits at the foot.
    test.info().annotations.push({ type: 'nav-box', description: JSON.stringify(nav) });
    expect(nav.height, 'the nav is not tall enough to be a rail').toBeGreaterThan(viewport.height / 2);
    expect(nav.width, 'the nav is as wide as a bottom bar').toBeLessThan(viewport.width / 3);
    expect(nav.y, 'the nav is pinned to the bottom of the viewport').toBeLessThan(200);
  });

  test('nothing overflows horizontally on any top-level screen', async ({ page }) => {
    const bad: string[] = [];
    for (const path of ['./', './path', './puzzles', './play', './progress', './settings', './licences']) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      if (o.scroll > o.client + 1) bad.push(`${path}: scrollWidth ${String(o.scroll)} > clientWidth ${String(o.client)}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('the board and the coach sit side by side', async ({ page }) => {
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White' });
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
    // Force a coach line onto the screen so the bubble has geometry to measure.
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByRole('note', { name: /says$/ })).toBeVisible({ timeout: 60_000 });

    const board = await box(page, '[role="application"]');
    const coach = await box(page, '[role="note"]');
    test.info().annotations.push({
      type: 'geometry',
      description: `board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    });
    // Side by side = the coach starts to the right of the board's right edge
    // and their vertical extents overlap. Concept Note: "the board on the left
    // and the coach and lesson on the right".
    const sideBySide = coach.x >= board.x + board.width - 1 && coach.y < board.y + board.height;
    expect(
      sideBySide,
      `coach is below the board, not beside it: board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    ).toBe(true);
  });

  test('the board does not grow to fill a desktop column', async ({ page }) => {
    await page.goto('./play/game?tc=untimed&color=w&coach=1');
    const board = page.locator('[role="application"]');
    await expect(board).toBeVisible({ timeout: ENGINE_WAIT });
    const b = await box(page, '[role="application"]');
    test.info().annotations.push({ type: 'board-box', description: JSON.stringify(b) });
    expect(b.width, 'the board is not square').toBeCloseTo(b.height, -1);
  });

  // The lesson player is the same shape as Play: the board on the left, the
  // coach and the lesson on the right. Mirrored here so the platform-level
  // desktop audit covers both surfaces (tests/audit/lesson-desktop.spec.ts
  // carries the phone half of the same assertion).
  test('the lesson board and the coach sit side by side', async ({ page }) => {
    await page.goto('./lesson/1.1.1');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    while (!(await page.locator('#challenge-prompt').isVisible())) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.getByRole('note', { name: /says$/ })).toBeVisible();

    const board = await box(page, '[role="application"]');
    const coach = await box(page, '[role="note"]');
    test.info().annotations.push({
      type: 'lesson-geometry',
      description: `board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    });
    expect(
      coach.x >= board.x + board.width - 1 && coach.y < board.y + board.height,
      `coach is below the lesson board, not beside it: board=${JSON.stringify(board)} coach=${JSON.stringify(coach)}`,
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    const settled = await box(page, '[role="application"]');
    expect(settled.width, 'the lesson board is not square').toBeCloseTo(settled.height, -1);
    expect(settled.y, 'the lesson board starts above the fold').toBeGreaterThanOrEqual(0);
    expect(settled.y + settled.height, 'the lesson board runs past the fold').toBeLessThanOrEqual(800);
  });
});

/**
 * NEUMORPHIC-DELTA.md §7: the desktop void, measured rather than looked at.
 *
 * §7.1 read Today's content column back as 752x545 in a 2000x1200 window --
 * **17% of the window**, with 496px dead on each flank and 655px dead below.
 * §7.3's answer is to cap and rank rather than stretch: a 1120px cap, a 2fr/1fr
 * grid on the reference's own 48px gutter, the lesson card at hero scale, and
 * the secondary column and the band carrying figures Today already computes.
 *
 * Everything below is read from `getBoundingClientRect`. A screenshot cannot
 * distinguish 41% from 45%, and the two earlier passes that "noticed" this void
 * had both looked at one (observation 0095).
 *
 * The share is the SAME quantity §7.1 tabulated: the screen `<section>`'s own
 * box over the viewport. Reading it that way reproduces §7.1's three published
 * figures exactly (64.6 / 40.0 / 17.1), so the before and after are on one
 * scale.
 */
type Share = { x: number; y: number; w: number; h: number; share: number; widestText: number; widestLabel: string };

async function contentShare(page: Page): Promise<Share> {
  return page.evaluate(() => {
    const sec = document.querySelector('main section');
    if (!sec) throw new Error('no screen section');
    const r = sec.getBoundingClientRect();
    let widestText = 0;
    let widestLabel = '';
    for (const el of sec.querySelectorAll('*')) {
      // Only elements that print text of their own: a full-width band is a
      // layout box, and capping IT at 720 would be capping the wrong thing.
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      if (!ownText) continue;
      const b = el.getBoundingClientRect();
      if (b.width > widestText) {
        widestText = b.width;
        widestLabel = `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      }
    }
    return {
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      share: (r.width * r.height) / (innerWidth * innerHeight),
      widestText,
      widestLabel,
    };
  });
}

for (const [w, h] of [
  [1280, 800],
  [2000, 1200],
] as const) {
  test.describe(`Today fills a ${String(w)}x${String(h)} window`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('the content is at least 45% of the window', async ({ page }) => {
      await page.goto('./');
      await page.waitForTimeout(400);
      // Negative control: an empty or missing section would satisfy nothing
      // below by accident -- the screen has to be the real one first.
      await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
      const m = await contentShare(page);
      test.info().annotations.push({ type: 'content-share', description: JSON.stringify(m) });
      expect(
        m.share,
        `content is ${(m.share * 100).toFixed(1)}% of ${String(w)}x${String(h)} (${String(Math.round(m.w))}x${String(Math.round(m.h))})`,
      ).toBeGreaterThanOrEqual(0.45);
    });

    test('the container is anchored to the top of the window and fills it', async ({ page }) => {
      await page.goto('./');
      await page.waitForTimeout(400);
      const m = await contentShare(page);
      // Both edges, because `min-h-*` is silently inert against an auto-height
      // parent: a rule that claims to fill has to be read back as a top AND a
      // bottom, never as a class on an element.
      expect(m.y, 'the content does not start at the top of the window').toBeLessThanOrEqual(1);
      expect(m.y + m.h, 'the content does not reach the foot of the window').toBeGreaterThanOrEqual(h - 1);
    });

    /*
     * The void, measured where it actually is.
     *
     * The share assertion above measures the CONTAINER's area, and the one below
     * it requires that container to reach the foot of the window -- so at 2000 x
     * 1200 the share cannot fall below about 47% however little the screen
     * carries. It is a real assertion about the horizontal void it was written
     * for, and it is silent about the vertical one: a container stretched to the
     * window with all its ink in the top 511px measures the same as a full page.
     *
     * This asserts the complementary thing, on leaf ink rather than on boxes:
     * merge every band of the window that carries text or a painted leaf, and
     * require the largest hole BETWEEN two bands to stay under a quarter of the
     * window. A hole is worse than a margin of the same size, because margin
     * below the last element reads as a page that ended and a hole between two
     * elements reads as something that failed to load -- which is what a fresh
     * profile showed at 2000 x 1200, at 605px, 50% of the window.
     *
     * Leaf ink, not boxes, and that is the whole point: a probe that counted
     * containers would report this screen full, which is how the defect survived
     * a passing suite.
     */
    test('no interior void: the largest empty band is under a quarter of the window', async ({ page }) => {
      await page.goto('./');
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const bands: [number, number][] = [];
        for (const el of document.querySelectorAll('main *')) {
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const b = el.getBoundingClientRect();
          if (b.height === 0 || b.width === 0) continue;
          const ownsText = [...el.childNodes].some(
            (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
          );
          const paintsLeaf =
            (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.boxShadow !== 'none') && el.children.length < 6;
          if (ownsText || paintsLeaf || el.tagName === 'IMG') bands.push([b.top, b.bottom]);
        }
        bands.sort((a, b) => a[0] - b[0]);
        const merged: [number, number][] = [];
        for (const [t, bo] of bands) {
          const last = merged.at(-1);
          if (last && t <= last[1] + 1) last[1] = Math.max(last[1], bo);
          else merged.push([t, bo]);
        }
        let biggest = 0;
        let where = '';
        for (let i = 0; i < merged.length - 1; i++) {
          const g = merged[i + 1]![0] - merged[i]![1];
          if (g > biggest) {
            biggest = g;
            where = `${String(Math.round(merged[i]![1]))} -> ${String(Math.round(merged[i + 1]![0]))}`;
          }
        }
        return { biggest, where, bands: merged.length, vh: window.innerHeight };
      });
      test.info().annotations.push({ type: 'void', description: JSON.stringify(m) });
      // Not vacuous: one merged band would make "the largest hole" undefined and
      // the check would pass over a screen that rendered nothing.
      expect(m.bands, 'the ink probe found fewer than three bands — it may be blind').toBeGreaterThanOrEqual(3);
      expect(
        m.biggest,
        `a ${String(Math.round(m.biggest))}px hole at ${m.where} — ${((100 * m.biggest) / m.vh).toFixed(0)}% of the window`,
      ).toBeLessThanOrEqual(m.vh * 0.25);
    });

    test('the measure is capped: no text runs wider than 720px', async ({ page }) => {
      await page.goto('./');
      await page.waitForTimeout(400);
      const m = await contentShare(page);
      expect(m.widestText, `${m.widestLabel} is ${String(Math.round(m.widestText))}px wide`).toBeLessThanOrEqual(720);
    });

    test('the flanks are margin, not void: the cap is 1120px', async ({ page }) => {
      await page.goto('./');
      await page.waitForTimeout(400);
      const m = await contentShare(page);
      const rail = (await box(page, 'nav[aria-label="Main"]')).width;
      const left = m.x - rail;
      const right = w - (m.x + m.w);
      test.info().annotations.push({ type: 'flanks', description: `left=${String(left)} right=${String(right)}` });
      expect(Math.abs(left - right), 'the content is not centred in what the rail leaves').toBeLessThanOrEqual(2);
      // 1120 plus the 8px page gutter on each side.
      expect(m.w).toBeLessThanOrEqual(1136);
      // §7.1's 496px flank at 2000 is the number this replaces.
      if (w === 2000) expect(left, 'the flank is still a void').toBeLessThanOrEqual(340);
    });

    test('two columns on the reference gutter, with the board at hero scale', async ({ page }) => {
      await page.goto('./');
      await page.waitForTimeout(600);
      const primary = await box(page, 'main section > div >> nth=0');
      const secondary = await box(page, 'main section [aria-label="This unit"]');
      const board = await box(page, '[data-testid="today-lesson-board"]');
      test.info().annotations.push({
        type: 'grid',
        description: `primary=${JSON.stringify(primary)} secondary=${JSON.stringify(secondary)} board=${JSON.stringify(board)}`,
      });
      expect(secondary.x, 'the secondary column is not beside the primary one').toBeGreaterThan(primary.x + primary.width - 1);
      expect(secondary.y, 'the secondary column starts below the primary one').toBeLessThan(primary.y + 40);
      // The reference's own 48px gutter (§3.1).
      expect(Math.round(secondary.x - (primary.x + primary.width))).toBe(48);
      expect(board.width, 'the hero board is not at hero scale').toBeCloseTo(240, 0);
    });
  });
}

test.describe('the phone layout is untouched', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Today measures exactly what it measured before the desktop pass', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(600);
    const m = await contentShare(page);
    const board = await box(page, '[data-testid="today-lesson-board"]');
    test.info().annotations.push({ type: 'compact', description: JSON.stringify({ ...m, board }) });
    // §7.1's compact row was 390 x 543, and the ~301px void beneath it was
    // recorded here as "Delta 4's unfinished business, deliberately not
    // re-opened". Pass 5 re-opened it on purpose: 757 now, so the void is ~87px.
    //
    // The history of this number is the point. 545 until chunk N2 retired
    // `--key-raised` (its 2px bottom border leaving the "On the path" card);
    // 543 until the unit meter came to the phone. Each time it is RE-PINNED
    // rather than given a tolerance, because a tolerance here would stop it
    // catching the drift it exists for -- the DESKTOP pass leaking onto the
    // phone by accident.
    //
    // What closed the void was a deliberate decision, not leakage: the phone
    // was being given the leftovers of a desktop layout. "This unit" -- a
    // two-line meter saying how far through the current unit the learner is --
    // was `hidden xl:block`, so a phone showed two cards and a bare link on a
    // 844px screen. It is now the one former desktop-only region that reaches
    // the phone, and it is named here rather than dropped from the list, so
    // this stays a statement about WHICH regions cross over instead of becoming
    // a weaker statement about how many.
    expect(Math.round(m.w)).toBe(390);
    expect(Math.round(m.h)).toBe(757);
    expect(board.width, 'the compact board is not 120px').toBeCloseTo(120, 0);
    // Deliberately on the phone now.
    await expect(page.getByRole('region', { name: 'This unit' })).toHaveCount(1);
    // ...and these two are still desktop-only, so the rule is not vacuous: a
    // desktop pass that leaked wholesale would still be caught here.
    for (const name of ['Up next', 'Recently finished']) {
      await expect(page.getByRole('region', { name })).toHaveCount(0);
    }
  });
});

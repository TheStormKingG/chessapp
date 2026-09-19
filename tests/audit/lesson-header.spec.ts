import { test, expect } from '@playwright/test';
import { ConsoleLog, lessonIds, readLesson } from './audit-helpers';

/**
 * The lesson header, measured at 390x844 for EVERY lesson in the section.
 *
 * Reported twice, independently: unit 1.4.3's title ("Touch move, draws,
 * resigning, notation, the clock") and 1.6.3's ("Your first full game with the
 * coach") crowded the close control and read as wrapping underneath it.
 *
 * Measuring showed nothing was overlapping. The title box began at x=60 --
 * exactly the right edge of the 44px control, with a zero gutter -- because the
 * `<h1>` was a plain flex sibling with `min-width:auto`, so it refused to shrink
 * below its longest word and took the space up to the control's edge. The fix is
 * layout: the control and the counter are `shrink-0`, the title is
 * `min-w-0 flex-1`, and a `gap-3` sits between them. No title was shortened.
 *
 * This spec is the guard, and it is a sweep rather than two cases: the defect
 * was a property of the header at a width, not of two strings, so a third long
 * title arriving in Section 2 must fail here rather than be reported again.
 */
const GAP = 12;

for (const id of lessonIds()) {
  test(`lesson ${id}: the header gives the title its own column at 390`, async ({ page }) => {
    const lesson = readLesson(id);
    const log = new ConsoleLog(page);
    log.mark(`header ${id}`);
    await page.goto(`./lesson/${id}`);

    const header = page.locator('header').first();
    const h1 = header.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText(`${id} · ${lesson.title}`);

    const box = async (l: typeof h1) => {
      const b = await l.boundingBox();
      expect(b, 'element is laid out').not.toBeNull();
      return b!;
    };
    const hb = await box(header);
    const bb = await box(header.locator('button'));
    const tb = await box(h1);

    // 1. The control keeps its full 44px tap target -- it is never the thing
    //    that gives way when the title is long.
    expect(bb.width).toBeGreaterThanOrEqual(44);
    expect(bb.height).toBeGreaterThanOrEqual(44);

    // 2. There is a real gutter between the control and the title. This is the
    //    number that was 0 and produced the report.
    expect(tb.x - (bb.x + bb.width)).toBeGreaterThanOrEqual(GAP - 0.5);

    // 3. Nothing overlaps the control, on any line the title takes.
    expect(tb.x).toBeGreaterThan(bb.x + bb.width);

    // 4. The title stays inside the header, and the header stays one control
    //    tall -- a long title wraps within its column instead of growing the
    //    row and pushing the lesson down the screen.
    expect(tb.x + tb.width).toBeLessThanOrEqual(hb.x + hb.width + 0.5);
    expect(hb.height).toBeLessThanOrEqual(44.5);

    // 5. Nothing is elided: the full title is present in the DOM and rendered,
    //    which is what makes this a layout fix rather than a truncation.
    expect(await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });
}

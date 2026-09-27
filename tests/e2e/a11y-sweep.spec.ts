import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SCREENS } from './screens';

/**
 * F-AX-5, first clause: "Every screen passes automated accessibility checks."
 *
 * WHAT WAS THERE BEFORE. `tests/audit-platform/a11y.spec.ts` checks accessible
 * names, live regions and tab stops -- carefully, and by hand. Two gaps: its
 * `describe` block is "accessibility on the Play screen", so it audits ONE
 * screen out of fourteen; and `tests/audit-platform` runs in no workflow, so
 * nothing ran it on a pull request or a deploy. A check that does not run is not
 * a gate, and "every screen" was one screen.
 *
 * So this lives in `tests/e2e`, which the deploy workflow runs against a
 * production build, and it is added to `ci.yml` so a pull request sees it too.
 *
 * WHY AXE AND NOT MORE HAND-WRITTEN RULES. The hand-written ones are better at
 * this app's own invariants -- "exactly one live region on the board" is not a
 * WCAG rule and axe will never find it. But "automated accessibility checks" in
 * the requirement means the standard ones, and there are about ninety of them.
 * Writing those by hand would be worse in every way. The two are complementary
 * and both are kept.
 *
 * WHY A REAL BROWSER. Contrast is the rule this app is most likely to break --
 * it has a single near-white surface (#E0E5EC) and a neumorphic palette derived
 * from it -- and `color-contrast` needs layout and computed colour, which jsdom
 * does not have. An axe run under vitest would report contrast as "incomplete"
 * and pass. That is the shape of false assurance this project keeps finding.
 */

/**
 * WCAG 2.0/2.1 A and AA. Not `best-practice`: those are advice rather than the
 * standard, and mixing them in means a gate that fails on a matter of opinion.
 * If a best-practice rule is worth enforcing it should be argued for by name.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * `react-chessboard` renders the board, and rules about its internals are not
 * ours to satisfy from here. Nothing is disabled at the time of writing; this
 * exists so that a disable, if one ever becomes necessary, has to be named and
 * justified in one place rather than buried in a call site.
 */
const DISABLED_RULES: string[] = [];

for (const screen of SCREENS) {
  const title = `${screen.path} passes WCAG 2.1 AA`;
  if (screen.skip) {
    test.skip(title, () => {
      throw new Error(screen.skip);
    });
    continue;
  }

  test(title, async ({ page }) => {
    await page.goto(screen.path);
    // Audit the rendered screen, never a suspense fallback: a fallback has no
    // headings, no landmarks and no controls, so it passes everything.
    await expect(page.locator(screen.ready).first()).toBeVisible({ timeout: 30_000 });

    const builder = new AxeBuilder({ page }).withTags(TAGS);
    const results = await (DISABLED_RULES.length > 0 ? builder.disableRules(DISABLED_RULES) : builder).analyze();

    // The whole violation is printed, not just the count. A failure that says
    // "3 violations" sends the reader to a browser; one that names the rule and
    // the element is actionable from the log.
    const detail = results.violations
      .map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
      .join('\n');
    expect(results.violations, `${screen.path}\n${detail}`).toEqual([]);
  });
}

/**
 * The control, and it is permanent rather than a one-off check I ran once.
 *
 * Every screen above passes with zero violations, which is the good outcome and
 * also indistinguishable from a harness that finds nothing because it is not
 * looking: a wrong `withTags`, an `analyze()` whose result shape changed, an axe
 * that failed to inject and returned an empty list. This project has already
 * shipped one test that asserted the defect and another that passed on an
 * undefined property, so "it went green" is not evidence.
 *
 * So the sweep proves itself on every run. A deliberate violation is injected
 * into a real screen and must be reported. `image-alt` is used because it is
 * WCAG 2.0 A -- inside `TAGS` -- and because it cannot be satisfied by accident:
 * an `img` with no `alt` attribute at all has no accessible name by any route.
 */
test('the sweep can fail: an injected violation is reported', async ({ page }) => {
  await page.goto('./settings');
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });

  const before = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(before.violations, 'the screen must be clean before the violation is injected').toEqual([]);

  await page.evaluate(() => {
    const img = document.createElement('img');
    // A 1x1 transparent GIF, inline, so nothing is fetched and the test does not
    // depend on a network or on a file in the build.
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.removeAttribute('alt');
    document.body.appendChild(img);
  });

  const after = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(after.violations.map((v) => v.id)).toContain('image-alt');
});

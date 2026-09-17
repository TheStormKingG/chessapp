import { test, expect } from '@playwright/test';
import { captureConsole } from './helpers';

const TABS = ['Today', 'Path', 'Puzzles', 'Play', 'Progress'];

test.describe('tab shell and navigation', () => {
  test('all five tabs are reachable and the back button behaves', async ({ page }) => {
    await page.goto('./');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const t of TABS) await expect(nav.getByRole('link', { name: t })).toBeVisible();

    await nav.getByRole('link', { name: 'Path' }).click();
    await expect(page).toHaveURL(/\/path$/);
    await nav.getByRole('link', { name: 'Puzzles' }).click();
    await expect(page).toHaveURL(/\/puzzles$/);
    await nav.getByRole('link', { name: 'Play' }).click();
    await expect(page.getByRole('heading', { name: 'Play a game' })).toBeVisible();
    await nav.getByRole('link', { name: 'Progress' }).click();
    await expect(page).toHaveURL(/\/progress$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/play$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/puzzles$/);
  });

  test('deep links load directly', async ({ page }) => {
    await page.goto('./lesson/1.1.1');
    // A lesson is a modal task, so the tab bar is deliberately not here: what a
    // deep link must produce is the task's own way out (DESIGN-SYSTEM.md B1,
    // `modality.md > Best practices`). This assertion used to require the Main
    // navigation, which encoded the defect rather than the requirement.
    await expect(page.getByRole('button', { name: 'Exit lesson' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    // Something lesson-shaped must render; an empty <main> would be the defect.
    await expect(page.locator('main')).not.toBeEmpty();

    await page.goto('./play/game?tc=untimed&color=w&coach=0');
    await expect(page.locator('main')).not.toBeEmpty();
  });

  /**
   * H-1: a lesson, a checkpoint and a game are single focused tasks. They are
   * presented modally — over the app, without the tab bar — and each one carries
   * its own dismiss control. `tab-bars.md > Best practices`: the tab bar stays
   * visible except "when a modal view covers the tab bar, because a modal is
   * temporary and self-contained". `modality.md > Best practices`: "Always give
   * people an obvious way to dismiss a modal view."
   */
  test('a modal task covers the tab bar and carries its own way out', async ({ page }) => {
    const modal = [
      { path: './lesson/1.1.1', exit: 'Exit lesson' },
      { path: './checkpoint/1.1', exit: 'Back to the path' },
      { path: './play/game?tc=untimed&color=w&coach=0', exit: 'Exit game' },
    ];
    for (const m of modal) {
      await page.goto(m.path);
      await expect(page.getByRole('navigation', { name: 'Main' }), `${m.path} still shows the tab bar`).toHaveCount(0);
      await expect(page.getByRole('button', { name: m.exit }), `${m.path} has no way out`).toBeVisible();
    }

    // The tab bar is back on a browsable section, and the browser's own back
    // button still leaves a modal task the way it arrived.
    await page.goto('./path');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await page.getByRole('link', { name: /1\.1\.1/ }).click();
    await expect(page.getByRole('button', { name: 'Exit lesson' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/path$/);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('an unknown route shows a 404 fallback rather than an empty shell', async ({ page }) => {
    await page.goto('./this-route-does-not-exist');
    // The in-app catch-all route names what happened and offers the two ways
    // back. An empty <main> under the tab bar was the defect.
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: /that page is not here/i })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Go to Today' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Go to the Path' })).toBeVisible();
    const mainText = (await main.innerText()).trim();
    expect(mainText.length, 'unknown route renders nothing inside <main>').toBeGreaterThan(0);

    await main.getByRole('link', { name: 'Go to Today' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('console is clean on every top-level page', async ({ page }) => {
    const con = captureConsole(page);
    const report: string[] = [];
    for (const path of ['./', './path', './puzzles', './play', './progress', './settings', './licences']) {
      await page.goto(path);
      const from = await con.mark(path);
      await page.waitForTimeout(800);
      for (const p of con.problems(from)) report.push(`${path} :: ${p.type} :: ${p.text} @ ${p.location}`);
    }
    test.info().annotations.push({ type: 'console', description: report.join('\n') || 'none' });
    expect(report, report.join('\n')).toEqual([]);
  });
});

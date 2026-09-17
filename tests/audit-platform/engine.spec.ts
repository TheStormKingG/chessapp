import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, startGame } from './helpers';

const ENGINE_WAIT = 120_000;

async function blockEngine(page: Page): Promise<void> {
  await page.route('**/engine/*.wasm', (r) => r.abort('failed'));
}

test.describe('engine unavailable', () => {
  test.setTimeout(180_000);

  test('the Play screen explains it in one line and the retry works', async ({ page }) => {
    await blockEngine(page);
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White' });

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    const text = await alert.innerText();
    expect(text).toContain('Could not download the engine');
    // One plain line plus the retry, not a stack trace or a wall of text.
    expect(text.split('\n').filter((l) => l.trim()).length, text).toBeLessThanOrEqual(2);

    // The learner must never be left on a board that silently rejects moves.
    await expect(page.getByLabel('Type a move')).toHaveCount(0);
    await expect(page.locator('[role="application"]')).toHaveCount(0);

    await page.unroute('**/engine/*.wasm');
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
  });

  test('a play_it_out lesson challenge explains it in one line and the retry works', async ({ page }) => {
    await blockEngine(page);
    await page.goto('./lesson/1.2.3');
    await page.getByRole('button', { name: 'Start' }).click();
    // Walk to challenge 6 of 6, the play_it_out drill: "Show me" reveals the
    // answer for a challenge that needs one, "Next" advances.
    // Two teaching pages come first; click through them to the first challenge.
    while (!(await page.getByText('1 of 6').isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Next' }).click();
    }
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByText(`${String(i)} of 6`)).toBeVisible({ timeout: 30_000 });
      const showMe = page.getByRole('button', { name: 'Show me' });
      if (await showMe.isVisible().catch(() => false)) await showMe.click();
      await page.getByRole('button', { name: 'Next' }).click();
    }
    await expect(page.getByText('6 of 6')).toBeVisible({ timeout: 30_000 });
    const alert = page.getByRole('alert');
    await expect(alert, 'no engine-failure message in the play_it_out drill').toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText(/engine/i);
    await expect(alert.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});

test.describe('engine download', () => {
  test.setTimeout(180_000);

  test('the progress indicator appears on a cold load and not on a warm one', async ({ page }) => {
    await page.route('**/engine/*.wasm', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      // The service worker re-issues the same request, so a handler can find
      // its route already settled; that is not a failure of the throttle.
      try {
        await route.continue();
      } catch {
        /* already handled */
      }
    });
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White' });
    const bar = page.getByRole('progressbar');
    await expect(bar, 'no progress indicator on a cold, slow engine download').toBeVisible({ timeout: 10_000 });
    await expect(bar).toHaveAttribute('aria-valuenow', /\d+/);
    await page.unroute('**/engine/*.wasm');
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });

    // Warm: the service worker has the binary. Reload and start again; the bar
    // must not flash for a file that is already on the device.
    await page.goto('./');
    await page.waitForTimeout(1500);
    let flashed = false;
    const watch = setInterval(() => {
      void bar
        .count()
        .then((n) => {
          if (n > 0) flashed = true;
        })
        .catch(() => undefined);
    }, 50);
    await startGame(page, { tc: 'Untimed', colour: 'White' });
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
    clearInterval(watch);
    expect(flashed, 'the download bar flashed on a warm load').toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import { readEvents } from './helpers';

test.describe('settings', () => {
  test('both toggles persist across a reload', async ({ page }) => {
    await page.goto('./settings');
    await page.getByLabel('Text move entry').check();
    await page.getByLabel('Mute the coach').check();
    await page.reload();
    await expect(page.getByLabel('Text move entry')).toBeChecked();
    await expect(page.getByLabel('Mute the coach')).toBeChecked();
  });

  test('clearing device data actually clears progress', async ({ page }) => {
    // Make some progress first: a settings_changed event is a real row.
    await page.goto('./settings');
    await page.getByLabel('Text move entry').check();
    await expect
      .poll(async () => (await readEvents(page, 'settings_changed')).length)
      .toBeGreaterThan(0);

    page.once('dialog', (d) => {
      void d.accept();
    });
    const t0 = Date.now();
    await page.getByRole('button', { name: /Clear this device/ }).click();
    // The button gives no feedback: measure how long the learner waits for the
    // reload that is the only sign anything happened.
    await page.waitForURL(/settings/, { timeout: 60_000 });
    await page.waitForLoadState('load');
    const elapsed = Date.now() - t0;
    test.info().annotations.push({ type: 'clear-latency-ms', description: String(elapsed) });
    expect(elapsed, `"Clear this device's data" took ${String(elapsed)}ms with no progress feedback`).toBeLessThan(
      5000,
    );
    await page.waitForTimeout(2000);
    const left = await readEvents(page, 'settings_changed');
    test.info().annotations.push({ type: 'observed', description: JSON.stringify(left) });
    expect(left, 'progress survived "clear this device\'s data"').toEqual([]);
  });

  test('clearing device data also clears the settings the confirmation promises to clear', async ({ page }) => {
    await page.goto('./settings');
    await page.getByLabel('Text move entry').check();
    await page.getByLabel('Mute the coach').check();

    const prompt = await new Promise<string>((resolve) => {
      page.once('dialog', (d) => {
        const m = d.message();
        void d.accept().then(() => {
          resolve(m);
        });
      });
      void page.getByRole('button', { name: /Clear this device/ }).click();
    });
    expect(prompt).toContain('setting');
    await page.waitForLoadState('load');
    // The confirmation says "every lesson, game and setting stored on this device".
    await expect(page.getByLabel('Text move entry'), 'a setting survived "clear this device\'s data"').not.toBeChecked();
    await expect(page.getByLabel('Mute the coach')).not.toBeChecked();
  });

  test('the account section renders its signed-out state and the deletion note is present', async ({ page }) => {
    await page.goto('./settings');
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    // Signed-out state = the magic-link form. NOT submitted: it sends real email.
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send me a sign-in link/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign out/ })).toHaveCount(0);
    await expect(page.getByText(/Deleting an account and the progress held on the server/)).toBeVisible();
  });

  test('every control on Settings has an accessible name', async ({ page }) => {
    await page.goto('./settings');
    const unnamed = await page.evaluate(() => {
      const sel = 'button, a[href], input, select, textarea, [role="button"], [role="checkbox"]';
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        if (el.closest('[aria-hidden="true"]')) return;
        const labelled = el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '';
        const byId = el.getAttribute('aria-labelledby');
        const byIdText = byId
          ? byId
              .split(/\s+/)
              .map((i) => document.getElementById(i)?.textContent ?? '')
              .join(' ')
          : '';
        const wrapping = el.closest('label')?.textContent ?? '';
        const forLabel = el.id ? (document.querySelector(`label[for="${el.id}"]`)?.textContent ?? '') : '';
        const name = `${labelled}${byIdText}${wrapping}${forLabel}${el.textContent ?? ''}`.trim();
        if (!name) out.push(el.outerHTML.slice(0, 160));
      });
      return out;
    });
    expect(unnamed, unnamed.join('\n')).toEqual([]);
  });
});

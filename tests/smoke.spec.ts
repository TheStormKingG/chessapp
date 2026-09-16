import { test, expect } from '@playwright/test';

test('live app loads with the tab bar', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'Path' })).toBeVisible();
});

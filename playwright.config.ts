import { defineConfig, devices } from '@playwright/test';

const smoke = !!process.env['SMOKE_URL'];

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    baseURL: process.env['SMOKE_URL'] ?? 'http://localhost:5173/',
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
  },
  webServer: smoke
    ? undefined
    : { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173/', reuseExistingServer: true },
});

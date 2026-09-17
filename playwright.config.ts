import { defineConfig, devices } from '@playwright/test';

const smoke = !!process.env['SMOKE_URL'];
// PREVIEW=1 serves a production build from `dist-e2e` instead of the dev
// server, so the e2e specs exercise the same bundle that ships. That build is
// made with `--base=/`, which is why the specs navigate with relative paths.
const preview = !!process.env['PREVIEW'];

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
    : {
        command: preview
          ? 'npm run preview -- --port 5173 --strictPort --base / --outDir dist-e2e'
          : 'npm run dev -- --port 5173',
        url: 'http://localhost:5173/',
        // Reusing a running server locally is convenient; in CI it would hide
        // a server that failed to start.
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});

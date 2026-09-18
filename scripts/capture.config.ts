import { defineConfig, devices } from '@playwright/test';

/**
 * PREMIUM-DELTA P4d: the capture harness for `docs/design/after/`.
 *
 * A separate config rather than a spec under `tests/`, so the capture never
 * runs as part of the audit suite and its 48 navigations never count as tests.
 *
 * `reuseExistingServer: false` unconditionally. The main config reuses a
 * running server when `CI` is unset, which is convenient for the suite and
 * wrong here: a stray dev server on 5173 would be photographed instead of the
 * production build, and the shots would be indistinguishable from correct ones.
 */
export default defineConfig({
  testDir: 'capture',
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173/',
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm run preview -- --port 5173 --strictPort --base / --outDir dist-e2e',
    url: 'http://localhost:5173/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

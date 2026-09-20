import { defineConfig, devices } from '@playwright/test';

const smoke = !!process.env['SMOKE_URL'];
// PREVIEW=1 serves a production build from `dist-e2e` instead of the dev
// server, so the e2e specs exercise the same bundle that ships. That build is
// made with `--base=/`, which is why the specs navigate with relative paths.
const preview = !!process.env['PREVIEW'];

// A run can take its own port and its own build directory. `reuseExistingServer`
// is true outside CI, so a stale server left on the default port is silently
// reused and the run measures a build nobody in this session made. Defaults are
// unchanged, so CI and the usual local invocation behave exactly as before.
const port = process.env['E2E_PORT'] ?? '5173';
const outDir = process.env['E2E_OUT_DIR'] ?? 'dist-e2e';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    baseURL: process.env['SMOKE_URL'] ?? `http://localhost:${port}/`,
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
  },
  webServer: smoke
    ? undefined
    : {
        // PREVIEW builds before serving. Only the deploy workflow ever built
        // `dist-e2e`, so a local PREVIEW run served whatever stale build was
        // on disk — green against code that was not the working tree. The
        // build is the same one the workflow runs, so CI is unaffected.
        command: preview
          ? `npx vite build --base=/ --outDir ${outDir} && npm run preview -- --port ${port} --strictPort --base / --outDir ${outDir}`
          : `npm run dev -- --port ${port}`,
        url: `http://localhost:${port}/`,
        // Reusing a running server locally is convenient; in CI it would hide
        // a server that failed to start.
        //
        // But NEVER reuse in PREVIEW mode. The command above builds before it
        // serves, precisely so a run cannot test a stale artefact — and reuse
        // skips the command entirely, so a server left running from an earlier
        // run keeps serving the old build and defeats the fix. That is not
        // hypothetical: it produced two checkpoint failures whose error said
        // "0 bank entries match prompt ..." because the page still showed a
        // prompt the working tree had already changed.
        reuseExistingServer: !process.env['CI'] && !preview,
        timeout: 120_000,
      },
});

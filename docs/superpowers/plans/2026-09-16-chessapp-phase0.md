# ChessApp Phase 0 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 0 foundations of ChessApp: a deployed, installable Vite + React PWA on GitHub Pages, backed by Supabase, in which a beginner completes Units 1.1 and 1.2 of Section 1 and plays a coached game against one bot.

**Architecture:** Client-heavy PWA. Pure, serialisable state machines (lesson, checkpoint, game) over FEN strings; chess.js wrapped in `src/rules`; Stockfish 19 lite in a Web Worker behind `EngineClient`; learner data as an append-only event log in IndexedDB (Dexie) with projections rebuilt by a reducer; Supabase Auth plus an `events` table with RLS for sync and merge. Content is versioned JSON verified by an engine-backed script in CI.

**Tech Stack:** Vite 8, React 19, TypeScript strict, Tailwind 4, react-router 7, zustand 5, Dexie 4, chess.js 1.4, react-chessboard 5.12, stockfish 19.0.0 (lite single), vite-plugin-pwa 1.3, @supabase/supabase-js 2, vitest 5, @testing-library/react, fake-indexeddb, Playwright 1.63, eslint 9.

**Spec:** `docs/superpowers/specs/2026-09-16-chessapp-phase0-design.md`. Each task names the spec section (or the PRD requirement id) a reviewer must check it against; the reviewer's reference is the spec and the PRD, never this plan's code (superpowers-plan-extras Rule 2).

**Repo root:** `/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp`. All paths below are relative to it. All commands run from it.

---

## File structure

| Path | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts` | Tooling |
| `index.html`, `src/main.tsx` | Entry |
| `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/Shell.tsx`, `src/app/theme.css` | Router, tab bar and rail, design tokens |
| `src/screens/*.tsx` | Today, Puzzles (placeholder), Progress (placeholder), Settings, Licences |
| `src/rules/*.ts` | chess.js wrapper, pure functions over FEN |
| `src/engine/EngineClient.ts`, `src/engine/uci.ts`, `src/engine/winPercent.ts` | Engine worker client, UCI parsing, expected-score formula |
| `src/board/Board.tsx`, `src/board/TextMoveEntry.tsx`, `src/board/useBoardA11y.ts`, `src/board/types.ts` | Board component and non-visual mode |
| `src/tagger/*.ts` | tagger-lite facts |
| `src/coach/CoachService.ts`, `src/coach/CoachBubble.tsx`, `content/coach/templates.json` | Coach lines |
| `src/bot/BotService.ts`, `src/bot/errorModel.ts`, `content/personas/rosa.json` | Bot |
| `src/lesson/types.ts`, `src/lesson/loader.ts`, `src/lesson/LessonMachine.ts`, `src/lesson/stars.ts`, `src/lesson/LessonPlayer.tsx`, `src/lesson/challenges/*.tsx` | Lesson content types and player |
| `src/checkpoint/CheckpointMachine.ts`, `src/checkpoint/CheckpointPlayer.tsx` | Checkpoints |
| `src/play/GameMachine.ts`, `src/play/PlayScreen.tsx`, `src/play/ChooseOpponent.tsx` | Coached play |
| `src/path/PathScreen.tsx`, `src/path/curriculum.ts` | Path and Section 1 unit list |
| `src/data/db.ts`, `src/data/events.ts`, `src/data/reduce.ts`, `src/data/store.ts` | Dexie, event types, projections, zustand store |
| `src/sync/supabaseClient.ts`, `src/sync/AuthContext.tsx`, `src/sync/flush.ts`, `src/sync/merge.ts` | Supabase auth and sync |
| `src/analytics/track.ts` | Analytics adapter |
| `src/pwa/UpdateNotice.tsx`, `src/pwa/EngineDownload.tsx` | PWA behaviours |
| `content/schema/lesson.schema.json`, `content/section-1/unit-1.1/*.json`, `content/section-1/unit-1.2/*.json` | Lesson and checkpoint content |
| `scripts/verify-content.mjs`, `scripts/gen-movement-challenges.mjs` | Content pipeline |
| `supabase/migrations/20260916_phase0_profiles_events.sql`, `supabase/dryrun/phase0.sql` | Schema and dry-run |
| `public/engine/*`, `public/404.html`, `public/pwa-*.png` | Static assets |
| `tests/e2e/*.spec.ts`, `tests/smoke.spec.ts` | Playwright |
| `.github/workflows/deploy.yml`, `.github/workflows/smoke.yml` | CI |

---

### Task 1: Scaffold the app, shell, and test tooling

**Spec reference:** spec sections 2, 3, 4.12. PRD F-AX-4 (44 px targets).

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/Shell.tsx`, `src/app/theme.css`, `src/screens/TodayScreen.tsx`, `src/screens/PuzzlesScreen.tsx`, `src/screens/ProgressScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/test/setup.ts`, `src/app/Shell.test.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "chessapp",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify:content": "node scripts/verify-content.mjs",
    "gen:movement": "node scripts/gen-movement-challenges.mjs"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.116.0",
    "chess.js": "^1.4.0",
    "dexie": "^4.4.6",
    "react": "^19.3.0",
    "react-chessboard": "^5.12.1",
    "react-dom": "^19.3.0",
    "react-router": "^7.9.6",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@playwright/test": "^1.63.0",
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.14.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "ajv": "^8.17.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.4.20",
    "fake-indexeddb": "^6.0.0",
    "globals": "^16.0.0",
    "jsdom": "^26.0.0",
    "stockfish": "^19.0.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.8.0",
    "typescript-eslint": "^8.30.0",
    "vite": "^8.3.0",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^5.0.1"
  }
}
```

Run: `npm install`
Expected: installs with no peer errors. If `react-chessboard` or `vite-plugin-pwa` reports a peer conflict with React 19 or Vite 8, rerun with `npm install --legacy-peer-deps` and add `"legacy-peer-deps=true"` to a new `.npmrc` so CI's `npm ci` behaves the same.

- [ ] **Step 2: Create vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /chessapp/ until a domain is chosen.
const base = process.env['NODE_ENV'] === 'production' ? '/chessapp/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ChessApp',
        short_name: 'ChessApp',
        description: 'Learn chess from zero to club level, free.',
        theme_color: '#1f5f4a',
        background_color: '#f6f5f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['engine/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/engine/'),
            handler: 'CacheFirst',
            options: { cacheName: 'engine', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 3: Create tsconfig.json and tsconfig.node.json**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "vite/client", "vite-plugin-pwa/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"], "@content/*": ["content/*"] }
  },
  "include": ["src", "content", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

Add to `vite.config.ts` under `resolve`: `resolve: { alias: { '@': '/src', '@content': '/content' } }` (place it as a sibling of `base`).

- [ ] **Step 4: Create eslint.config.js**

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'public/engine', 'node_modules', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 5: Create index.html, src/main.tsx, src/vite-env.d.ts, src/app/theme.css**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#1f5f4a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="ChessApp" />
    <meta name="description" content="Learn chess from zero to club level, free." />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <title>ChessApp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/theme.css';

// GitHub Pages SPA redirect: 404.html sends /chessapp/path as /chessapp/?/path
const l = window.location;
if (l.search.startsWith('?/')) {
  const decoded = l.search.slice(2).split('&').map((s) => s.replace(/~and~/g, '&'));
  const path = decoded[0] ?? '';
  const query = decoded.slice(1).join('&');
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}${path}${query ? `?${query}` : ''}${l.hash}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
```

`src/app/theme.css`:
```css
@import 'tailwindcss';

@theme {
  --color-ink: #1b1f1d;
  --color-ink-muted: #5f6763;
  --color-paper: #f6f5f0;
  --color-card: #ffffff;
  --color-line: #e3e2dc;
  --color-accent: #1f5f4a;
  --color-accent-soft: #dceee6;
  --color-review: #b8860b;
  --color-review-soft: #f7ecd0;
  --color-danger: #a23b3b;
  --color-square-light: #e8e4d6;
  --color-square-dark: #8fa889;
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

html, body, #root { height: 100%; }
body { background: var(--color-paper); color: var(--color-ink); font-family: var(--font-sans); }
.tap { min-height: 44px; min-width: 44px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

- [ ] **Step 6: Write the failing shell test**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

`src/app/Shell.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Shell } from './Shell';

test('shell shows the five tabs', () => {
  render(
    <MemoryRouter>
      <Shell><div>content</div></Shell>
    </MemoryRouter>,
  );
  for (const label of ['Today', 'Path', 'Puzzles', 'Play', 'Progress']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }
  expect(screen.getByText('content')).toBeInTheDocument();
});
```

Run: `npx vitest run src/app/Shell.test.tsx`
Expected: FAIL, cannot resolve `./Shell`.

- [ ] **Step 7: Create Shell, routes, App and placeholder screens**

`src/app/Shell.tsx`:
```tsx
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

const tabs = [
  { to: '/', label: 'Today', end: true },
  { to: '/path', label: 'Path' },
  { to: '/puzzles', label: 'Puzzles' },
  { to: '/play', label: 'Play' },
  { to: '/progress', label: 'Progress' },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl md:flex-row">
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card md:static md:w-48 md:border-t-0 md:border-r">
        <ul className="flex md:flex-col">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `tap flex flex-col items-center justify-center px-2 py-2 text-xs md:flex-row md:justify-start md:gap-2 md:px-4 md:text-sm ${isActive ? 'text-accent font-semibold' : 'text-ink-muted'}`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  );
}
```

`src/screens/TodayScreen.tsx`, `PuzzlesScreen.tsx`, `ProgressScreen.tsx`, `SettingsScreen.tsx` each export a component; for now:
```tsx
export function PuzzlesScreen() {
  return (
    <section className="p-4">
      <h1 className="text-xl font-semibold">Puzzles</h1>
      <p className="mt-2 text-ink-muted">Puzzles arrive in the next release. Lessons and play are ready now.</p>
    </section>
  );
}
```
(`ProgressScreen` says "Progress arrives in the next release." `TodayScreen` and `SettingsScreen` say "Today" and "Settings" with the same placeholder line; both are replaced in later tasks.)

`src/app/routes.tsx`:
```tsx
import { Routes, Route } from 'react-router';
import { Shell } from './Shell';
import { TodayScreen } from '@/screens/TodayScreen';
import { PuzzlesScreen } from '@/screens/PuzzlesScreen';
import { ProgressScreen } from '@/screens/ProgressScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

export function AppRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/path" element={<div className="p-4">Path</div>} />
        <Route path="/puzzles" element={<PuzzlesScreen />} />
        <Route path="/play" element={<div className="p-4">Play</div>} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </Shell>
  );
}
```

`src/app/App.tsx`:
```tsx
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Run test, lint, typecheck, build**

Run: `npx vitest run && npm run lint && npm run typecheck && npm run build`
Expected: test PASS; lint 0 warnings; build writes `dist/` with `sw.js` and `manifest.webmanifest`. Icons referenced by the manifest do not exist yet (Task 2 adds them); vite-plugin-pwa only warns.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite React PWA shell with five-tab navigation"
```

---

### Task 2: GitHub repo, Supabase project, CI deploy, icons, SPA fallback

**Spec reference:** spec sections 2 (CI), 4.11 (secrets), 4.13 (PWA), 8 (conventions). Reviewer checks against the preqal.org `deploy.yml` and MicroHabits `deploy.yml` shapes and the live GitHub Pages result, not this plan.

**Irreversible actions in this task:** creating the GitHub repo and the Supabase project. Both were approved by the owner on 2026-09-16. Creating the Supabase project is not reversible by editing a file; it is small, so no dry-run is needed, but the DB password is generated once and written to `.env.secrets` before the create command runs so it cannot be lost.

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/smoke.yml`, `public/404.html`, `public/favicon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/apple-touch-icon.png`, `scripts/render-icons.mjs`, `src/pwa/icons.test.ts`, `.env.local` (gitignored), `.env.secrets` (gitignored), `README.md`

- [ ] **Step 1: Create the GitHub repo and push**

```bash
gh repo create TheStormKingG/chessapp --public --description "ChessApp — free path from zero to club level. Vite + React PWA on Supabase." --source . --remote origin --push
```
Expected: repo created, `main` pushed. Verify: `gh repo view TheStormKingG/chessapp --json url`.

- [ ] **Step 2: Enable GitHub Pages with the Actions source**

```bash
gh api -X POST repos/TheStormKingG/chessapp/pages -f build_type=workflow
```
Expected: HTTP 201 (or 409 if already enabled).

- [ ] **Step 3: Create the Supabase project**

```bash
PW=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
printf '# NEVER commit this file — it is gitignored\nexport SUPABASE_DB_PASSWORD=%s\n' "$PW" > .env.secrets
supabase projects create ChessApp --org-id xtoswuzwnquyvqihxjhs --region sa-east-1 --db-password "$PW" --yes
```
Expected: output contains the new project ref. Record it: `supabase projects list | grep ChessApp`. Then:

```bash
REF=$(supabase projects list -o json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).find(p=>p.name==='ChessApp');console.log(p.id)})")
supabase link --project-ref "$REF" -p "$(sed -n 's/^export SUPABASE_DB_PASSWORD=//p' .env.secrets)"
supabase projects api-keys --project-ref "$REF" -o json
```
Write `VITE_SUPABASE_URL=https://$REF.supabase.co` and `VITE_SUPABASE_ANON_KEY=<anon key>` to `.env.local`; append `export SUPABASE_SERVICE_KEY=<service_role key>` and `export SUPABASE_PROJECT_REF=$REF` to `.env.secrets`. `supabase link` writes `supabase/config.toml` and `.temp/`; add `supabase/.temp/` to `.gitignore`.

- [ ] **Step 4: Set repo secrets**

```bash
gh secret set VITE_SUPABASE_URL -R TheStormKingG/chessapp --body "$(sed -n 's/^VITE_SUPABASE_URL=//p' .env.local)"
gh secret set VITE_SUPABASE_ANON_KEY -R TheStormKingG/chessapp --body "$(sed -n 's/^VITE_SUPABASE_ANON_KEY=//p' .env.local)"
gh secret list -R TheStormKingG/chessapp
```
Expected: both secrets listed.

- [ ] **Step 5: Create public/404.html (copied from preqal.org, with one path segment kept)**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <script>
      // Single Page Apps for GitHub Pages — https://github.com/rafgraph/spa-github-pages
      var pathSegmentsToKeep = 1; // keeps /chessapp/
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body>Redirecting...</body>
</html>
```

- [ ] **Step 6: Render icons once, locally, and commit them (codebase-ops rule 7)**

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f5f4a"/><path d="M32 12c-5 0-8 3-8 7 0 3 2 5 4 6l-6 16h20l-6-16c2-1 4-3 4-6 0-4-3-7-8-7zM18 44h28v6H18z" fill="#f6f5f0"/></svg>
```

`scripts/render-icons.mjs` (uses only Node and the `sharp`-free approach: a canvas is not available, so render with the `resvg` npm package installed as a dev dependency):
```bash
npm install -D @resvg/resvg-js
```
```js
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8');
for (const [name, size] of [['pwa-192x192.png', 192], ['pwa-512x512.png', 512], ['apple-touch-icon.png', 180]]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/${name}`, png);
  console.log(name, png.length, 'bytes');
}
```
Run: `node scripts/render-icons.mjs`
Expected: three PNGs written.

`src/pwa/icons.test.ts`:
```ts
import { readFileSync, statSync } from 'node:fs';

function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test.each([
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/apple-touch-icon.png', 180],
])('%s is %ix%i and under 60 KB', (path, size) => {
  expect(pngSize(path)).toEqual([size, size]);
  expect(statSync(path).size).toBeLessThan(60 * 1024);
});
```
Run: `npx vitest run src/pwa/icons.test.ts` → PASS.

- [ ] **Step 7: Create deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run verify:content
      - run: npm run build
        env:
          NODE_ENV: production
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Until Task 8 exists, `scripts/verify-content.mjs` must exist and exit 0. Create it now as:
```js
console.log('verify-content: no content yet');
```

- [ ] **Step 8: Create smoke.yml**

```yaml
name: Smoke Tests

on:
  workflow_run:
    workflows: ["Deploy to GitHub Pages"]
    types: [completed]
  workflow_dispatch:

jobs:
  smoke:
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: sleep 20
      - run: npx playwright test tests/smoke.spec.ts
        env:
          SMOKE_URL: https://thestormkingg.github.io/chessapp/
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

const smoke = !!process.env['SMOKE_URL'];

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL: process.env['SMOKE_URL'] ?? 'http://localhost:5173/',
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
  },
  webServer: smoke
    ? undefined
    : { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173/', reuseExistingServer: true },
});
```

`tests/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('live app loads with the tab bar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Path' })).toBeVisible();
});
```

- [ ] **Step 9: README, commit, push, watch the deploy**

`README.md`: title, one-paragraph description from the PRD summary, "Run locally" (`npm install`, copy `.env.local` values from Supabase, `npm run dev`), "Deploy" (push to `main`), and a pointer to `docs/product/PRD-v1.1.md`.

```bash
git add -A && git commit -m "ci: GitHub Pages deploy and smoke workflows, PWA icons, SPA fallback" && git push
gh run watch --exit-status $(gh run list -R TheStormKingG/chessapp -L 1 --json databaseId -q '.[0].databaseId')
```
Expected: deploy green; `curl -s -o /dev/null -w '%{http_code}' https://thestormkingg.github.io/chessapp/` prints 200; smoke run green.

---

### Task 3: Rules module

**Spec reference:** spec 4.1. PRD 10.2 (chess.js is the rules layer, wrapped).

**Files:**
- Create: `src/rules/index.ts`, `src/rules/rules.ts`, `src/rules/rules.test.ts`, `src/rules/types.ts`

- [ ] **Step 1: Write the failing tests**

`src/rules/rules.test.ts`:
```ts
import { START_FEN, legalMoves, applyMove, isCheck, isCheckmate, isStalemate, pieceAt, attackersOf, gameStatus, toSan } from './rules';

const scholars = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

test('start position has 20 legal moves', () => {
  expect(legalMoves(START_FEN)).toHaveLength(20);
});

test('applyMove accepts SAN and UCI and returns the new FEN', () => {
  const a = applyMove(START_FEN, 'e4');
  const b = applyMove(START_FEN, 'e2e4');
  expect(a.fen).toBe(b.fen);
  expect(a.san).toBe('e4');
  expect(a.uci).toBe('e2e4');
  expect(a.capture).toBe(false);
});

test('applyMove rejects illegal moves', () => {
  expect(() => applyMove(START_FEN, 'e5')).toThrow(/illegal/i);
});

test('Qxf7# is checkmate', () => {
  const { fen } = applyMove(scholars, 'Qxf7#');
  expect(isCheck(fen)).toBe(true);
  expect(isCheckmate(fen)).toBe(true);
  expect(gameStatus(fen)).toEqual({ over: true, result: 'checkmate', winner: 'w' });
});

test('stalemate is detected', () => {
  const fen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
  expect(isStalemate(fen)).toBe(true);
  expect(gameStatus(fen)).toEqual({ over: true, result: 'stalemate', winner: null });
});

test('pieceAt and attackersOf', () => {
  expect(pieceAt(START_FEN, 'e1')).toEqual({ type: 'k', color: 'w' });
  expect(pieceAt(START_FEN, 'e4')).toBeNull();
  expect(attackersOf(scholars, 'f7', 'w').sort()).toEqual(['c4', 'h5']);
});

test('toSan converts uci in context', () => {
  expect(toSan(scholars, 'h5f7')).toBe('Qxf7#');
});
```

Run: `npx vitest run src/rules` → FAIL (module missing).

- [ ] **Step 2: Implement**

`src/rules/types.ts`:
```ts
export type Square = `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${1|2|3|4|5|6|7|8}`;
export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece { type: PieceType; color: Color }
export interface MoveResult { fen: string; san: string; uci: string; capture: boolean; captured?: PieceType; promotion?: PieceType; check: boolean }
export interface LegalMove { from: Square; to: Square; san: string; uci: string; promotion?: PieceType; capture: boolean }
export type GameStatus =
  | { over: false }
  | { over: true; result: 'checkmate'; winner: Color }
  | { over: true; result: 'stalemate' | 'insufficient' | 'repetition' | 'fifty'; winner: null };
```

`src/rules/rules.ts`:
```ts
import { Chess, type Square as CjSquare } from 'chess.js';
import type { Color, GameStatus, LegalMove, MoveResult, Piece, PieceType, Square } from './types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function load(fen: string): Chess { return new Chess(fen); }

export function turn(fen: string): Color { return load(fen).turn(); }

export function legalMoves(fen: string, from?: Square): LegalMove[] {
  const c = load(fen);
  return c.moves({ verbose: true, ...(from ? { square: from as CjSquare } : {}) }).map((m) => ({
    from: m.from as Square, to: m.to as Square, san: m.san, uci: m.from + m.to + (m.promotion ?? ''),
    ...(m.promotion ? { promotion: m.promotion as PieceType } : {}), capture: m.flags.includes('c') || m.flags.includes('e'),
  }));
}

const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function applyMove(fen: string, move: string): MoveResult {
  const c = load(fen);
  const m = UCI.test(move)
    ? (() => { const [, from, to, promotion] = move.match(UCI)!; return c.move({ from: from!, to: to!, ...(promotion ? { promotion } : {}) }); })()
    : c.move(move);
  if (!m) throw new Error(`Illegal move ${move} in ${fen}`);
  return {
    fen: c.fen(), san: m.san, uci: m.from + m.to + (m.promotion ?? ''),
    capture: m.flags.includes('c') || m.flags.includes('e'),
    ...(m.captured ? { captured: m.captured as PieceType } : {}),
    ...(m.promotion ? { promotion: m.promotion as PieceType } : {}),
    check: c.inCheck(),
  };
}

export function toSan(fen: string, uci: string): string { return applyMove(fen, uci).san; }
export function toUci(fen: string, san: string): string { return applyMove(fen, san).uci; }
export function isCheck(fen: string): boolean { return load(fen).inCheck(); }
export function isCheckmate(fen: string): boolean { return load(fen).isCheckmate(); }
export function isStalemate(fen: string): boolean { return load(fen).isStalemate(); }

export function gameStatus(fen: string): GameStatus {
  const c = load(fen);
  if (c.isCheckmate()) return { over: true, result: 'checkmate', winner: c.turn() === 'w' ? 'b' : 'w' };
  if (c.isStalemate()) return { over: true, result: 'stalemate', winner: null };
  if (c.isInsufficientMaterial()) return { over: true, result: 'insufficient', winner: null };
  if (c.isThreefoldRepetition()) return { over: true, result: 'repetition', winner: null };
  if (c.isDrawByFiftyMoves()) return { over: true, result: 'fifty', winner: null };
  return { over: false };
}

export function pieceAt(fen: string, sq: Square): Piece | null {
  const p = load(fen).get(sq as CjSquare);
  return p ? { type: p.type as PieceType, color: p.color } : null;
}

export function attackersOf(fen: string, sq: Square, by: Color): Square[] {
  return load(fen).attackers(sq as CjSquare, by) as Square[];
}

export function piecesOf(fen: string, color: Color): { square: Square; piece: Piece }[] {
  const out: { square: Square; piece: Piece }[] = [];
  for (const row of load(fen).board()) for (const cell of row) if (cell && cell.color === color) out.push({ square: cell.square as Square, piece: { type: cell.type as PieceType, color: cell.color } });
  return out;
}

/** Same position but the other side to move; used by tagger-lite to ask "what could the opponent take". */
export function withTurn(fen: string, color: Color): string {
  const parts = fen.split(' ');
  parts[1] = color; parts[3] = '-';
  return parts.join(' ');
}
```

`src/rules/index.ts`: `export * from './rules'; export * from './types';`

- [ ] **Step 3: Run tests** — `npx vitest run src/rules` → PASS.

- [ ] **Step 4: Commit** — `git add src/rules && git commit -m "feat(rules): chess.js wrapper with pure FEN functions"`

---

### Task 4: Engine service

**Spec reference:** spec 4.2. PRD 10.3 (engine service), 10.6 (win per cent formula), F-ER-1, Appendix D (GPL notice).

**Files:**
- Create: `public/engine/stockfish-19-lite-single.js`, `public/engine/stockfish-19-lite-single.wasm`, `public/engine/LICENSE`, `public/engine/NOTICE`, `src/engine/uci.ts`, `src/engine/uci.test.ts`, `src/engine/winPercent.ts`, `src/engine/winPercent.test.ts`, `src/engine/EngineClient.ts`, `src/engine/EngineClient.test.ts`, `src/engine/index.ts`, `scripts/copy-engine.mjs`

- [ ] **Step 1: Copy the engine binaries with a script and record the notice**

`scripts/copy-engine.mjs`:
```js
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('public/engine', { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(`node_modules/stockfish/bin/${f}`, `public/engine/${f}`);
copyFileSync('node_modules/stockfish/README.md', 'public/engine/NOTICE');
writeFileSync('public/engine/SOURCE.txt', 'Stockfish.js 19.0.0 (GPL-3.0), unmodified. Source: https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.0\nStockfish: https://github.com/official-stockfish/Stockfish\n');
```
Download the GPL-3 text into `public/engine/LICENSE`: `curl -sL https://www.gnu.org/licenses/gpl-3.0.txt -o public/engine/LICENSE`. Add `"postinstall": "node scripts/copy-engine.mjs"` to package.json scripts, run it, and commit the copied files too (the postinstall keeps them current; committing keeps the deploy reproducible even if postinstall is skipped).

- [ ] **Step 2: Failing tests for UCI parsing and win per cent**

`src/engine/uci.test.ts`:
```ts
import { parseInfo, parseBestMove } from './uci';

test('parses a multipv info line with cp', () => {
  expect(parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1 nps 1 time 1 pv e7e5 g1f3 b8c6')).toEqual({
    depth: 12, multipv: 2, score: { cp: -35 }, pv: ['e7e5', 'g1f3', 'b8c6'],
  });
});

test('parses a mate score', () => {
  expect(parseInfo('info depth 5 multipv 1 score mate 2 pv h5f7')).toEqual({ depth: 5, multipv: 1, score: { mate: 2 }, pv: ['h5f7'] });
});

test('ignores lines without pv', () => {
  expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull();
});

test('parses bestmove', () => {
  expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
  expect(parseBestMove('bestmove (none)')).toBeNull();
});
```

`src/engine/winPercent.test.ts`:
```ts
import { toWinPercent, scoreToWinPercent } from './winPercent';

test('0 cp is 50 per cent, symmetric', () => {
  expect(toWinPercent(0)).toBeCloseTo(50, 5);
  expect(toWinPercent(100) + toWinPercent(-100)).toBeCloseTo(100, 5);
});

test('+300 cp is about 90 per cent (Lichess curve)', () => {
  expect(toWinPercent(300)).toBeGreaterThan(88);
  expect(toWinPercent(300)).toBeLessThan(92);
});

test('mate scores saturate', () => {
  expect(scoreToWinPercent({ mate: 3 })).toBe(100);
  expect(scoreToWinPercent({ mate: -1 })).toBe(0);
});
```

Run: `npx vitest run src/engine` → FAIL.

- [ ] **Step 3: Implement uci.ts and winPercent.ts**

`src/engine/uci.ts`:
```ts
export type Score = { cp: number } | { mate: number };
export interface InfoLine { depth: number; multipv: number; score: Score; pv: string[] }

export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ')) return null;
  const t = line.split(' ');
  const pvIdx = t.indexOf('pv');
  if (pvIdx < 0) return null;
  const num = (k: string, d: number) => { const i = t.indexOf(k); return i >= 0 ? Number(t[i + 1]) : d; };
  const si = t.indexOf('score');
  if (si < 0) return null;
  const score: Score = t[si + 1] === 'mate' ? { mate: Number(t[si + 2]) } : { cp: Number(t[si + 2]) };
  return { depth: num('depth', 0), multipv: num('multipv', 1), score, pv: t.slice(pvIdx + 1) };
}

export function parseBestMove(line: string): string | null {
  if (!line.startsWith('bestmove ')) return null;
  const mv = line.split(' ')[1];
  return mv && mv !== '(none)' ? mv : null;
}
```

`src/engine/winPercent.ts`:
```ts
import type { Score } from './uci';

/** Lichess published curve, PRD 10.6. Centipawns from the side to move's view. */
export function toWinPercent(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function scoreToWinPercent(s: Score): number {
  if ('mate' in s) return s.mate > 0 ? 100 : 0;
  return toWinPercent(s.cp);
}

/** PRD 10.6 per-move accuracy from the drop in win per cent. */
export function moveAccuracy(winDrop: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, winDrop)) - 3.1669));
}
```

- [ ] **Step 4: Failing test for EngineClient with a fake worker**

`src/engine/EngineClient.test.ts`:
```ts
import { EngineClient, type WorkerLike } from './EngineClient';

class FakeWorker implements WorkerLike {
  sent: string[] = [];
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  terminated = false;
  postMessage(msg: string) {
    this.sent.push(msg);
    const reply = (s: string) => queueMicrotask(() => this.onmessage?.({ data: s } as MessageEvent<string>));
    if (msg === 'uci') reply('uciok');
    if (msg === 'isready') reply('readyok');
    if (msg.startsWith('go')) {
      reply('info depth 8 multipv 1 score cp 30 pv e2e4 e7e5');
      reply('info depth 8 multipv 2 score cp 20 pv d2d4 d7d5');
      reply('bestmove e2e4');
    }
  }
  terminate() { this.terminated = true; }
}

test('analyse sends position and go, resolves lines sorted by multipv', async () => {
  const w = new FakeWorker();
  const e = new EngineClient(() => w, { idleMs: 10_000 });
  const res = await e.analyse({ fen: 'startpos', depth: 8, multiPv: 2 });
  expect(w.sent).toContain('setoption name MultiPV value 2');
  expect(w.sent).toContain('position fen startpos');
  expect(w.sent).toContain('go depth 8');
  expect(res.lines.map((l) => l.move)).toEqual(['e2e4', 'd2d4']);
  expect(res.lines[0]?.score).toEqual({ cp: 30 });
});

test('requests are serialised', async () => {
  const w = new FakeWorker();
  const e = new EngineClient(() => w, { idleMs: 10_000 });
  const [a, b] = await Promise.all([e.bestMove({ fen: 'f1', depth: 4 }), e.bestMove({ fen: 'f2', depth: 4 })]);
  expect(a).toBe('e2e4'); expect(b).toBe('e2e4');
  const goCount = w.sent.filter((s) => s.startsWith('go')).length;
  expect(goCount).toBe(2);
  expect(w.sent.indexOf('position fen f2')).toBeGreaterThan(w.sent.indexOf('go depth 4'));
});

test('idle timeout terminates the worker and a new request relaunches it', async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const e = new EngineClient(() => { const w = new FakeWorker(); workers.push(w); return w; }, { idleMs: 100 });
  const p = e.bestMove({ fen: 'f', depth: 1 });
  await vi.runAllTimersAsync();
  await p;
  vi.advanceTimersByTime(150);
  expect(workers[0]?.terminated).toBe(true);
  const p2 = e.bestMove({ fen: 'f', depth: 1 });
  await vi.runAllTimersAsync();
  await p2;
  expect(workers).toHaveLength(2);
  vi.useRealTimers();
});

test('worker failure rejects pending requests with EngineUnavailable', async () => {
  const e = new EngineClient(() => { throw new Error('no wasm'); }, { idleMs: 10 });
  await expect(e.bestMove({ fen: 'f', depth: 1 })).rejects.toThrow('EngineUnavailable');
});
```

Run: `npx vitest run src/engine/EngineClient.test.ts` → FAIL.

- [ ] **Step 5: Implement EngineClient**

`src/engine/EngineClient.ts`:
```ts
import { parseBestMove, parseInfo, type Score } from './uci';

export interface WorkerLike {
  postMessage(msg: string): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<string>) => void) | null;
}

export interface AnalyseRequest { fen: string; depth: number; multiPv?: number }
export interface AnalysisLine { move: string; pv: string[]; score: Score; depth: number }
export interface Analysis { lines: AnalysisLine[]; depth: number }

interface Job { fen: string; depth: number; multiPv: number; resolve: (a: Analysis) => void; reject: (e: Error) => void }

export class EngineUnavailable extends Error { constructor(cause: unknown) { super('EngineUnavailable'); this.cause = cause; } }

export class EngineClient {
  private worker: WorkerLike | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private lines = new Map<number, AnalysisLine>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;

  constructor(private readonly spawn: () => WorkerLike, private readonly opts: { idleMs: number } = { idleMs: 60_000 }) {}

  analyse(req: AnalyseRequest): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen: req.fen, depth: req.depth, multiPv: req.multiPv ?? 1, resolve, reject });
      void this.pump();
    });
  }

  async bestMove(req: AnalyseRequest): Promise<string> {
    const a = await this.analyse({ ...req, multiPv: 1 });
    const m = a.lines[0]?.move;
    if (!m) throw new EngineUnavailable('no bestmove');
    return m;
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; void this.pump(); }

  dispose() { this.stopIdle(); this.worker?.terminate(); this.worker = null; this.ready = null; }

  private ensure(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let w: WorkerLike;
      try { w = this.spawn(); } catch (e) { this.ready = null; reject(new EngineUnavailable(e)); return; }
      this.worker = w;
      w.onmessage = (e) => this.onLine(String(e.data), resolve);
      w.postMessage('uci');
    });
    return this.ready;
  }

  private onLine(line: string, onReady: () => void) {
    if (line === 'uciok') { this.worker?.postMessage('setoption name Hash value 16'); this.worker?.postMessage('setoption name Threads value 1'); this.worker?.postMessage('isready'); return; }
    if (line === 'readyok') { onReady(); return; }
    const job = this.current;
    if (!job) return;
    const info = parseInfo(line);
    if (info) { this.lines.set(info.multipv, { move: info.pv[0] ?? '', pv: info.pv, score: info.score, depth: info.depth }); return; }
    const best = parseBestMove(line);
    if (line.startsWith('bestmove')) {
      const lines = [...this.lines.values()].sort((a, b) => a.pv.length && b.pv.length ? 0 : 0);
      const ordered = [...this.lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      if (ordered.length === 0 && best) ordered.push({ move: best, pv: [best], score: { cp: 0 }, depth: job.depth });
      void lines;
      this.current = null;
      job.resolve({ lines: ordered, depth: job.depth });
      this.startIdle();
      void this.pump();
    }
  }

  private async pump() {
    if (this.current || this.paused) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    this.stopIdle();
    try { await this.ensure(); } catch (e) { this.current = null; job.reject(e as Error); this.queue.splice(0).forEach((j) => j.reject(e as Error)); return; }
    this.lines.clear();
    const w = this.worker!;
    w.postMessage(`setoption name MultiPV value ${job.multiPv}`);
    w.postMessage(job.fen === 'startpos' ? 'position startpos' : `position fen ${job.fen}`);
    w.postMessage(`go depth ${job.depth}`);
  }

  private startIdle() {
    this.stopIdle();
    this.idleTimer = setTimeout(() => { if (!this.current && this.queue.length === 0) { this.worker?.terminate(); this.worker = null; this.ready = null; } }, this.opts.idleMs);
  }
  private stopIdle() { if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; } }
}

/** Browser factory: the worker script locates its .wasm beside itself, so serve both from public/engine. */
export function createBrowserEngine(): EngineClient {
  return new EngineClient(() => new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`) as unknown as WorkerLike);
}

let shared: EngineClient | null = null;
export function getEngine(): EngineClient { return (shared ??= createBrowserEngine()); }
```

Remove the two dead lines (`const lines = ...` and `void lines;`) after the tests pass; they are scaffolding and lint will flag them.

Note on `position fen startpos`: the test uses the literal `startpos` only to check plumbing; real callers always pass a FEN.

- [ ] **Step 6: Run tests, lint** — `npx vitest run src/engine && npm run lint` → PASS, 0 warnings.

- [ ] **Step 7: Manual spike in the browser (drag-performance and load check, PRD open decision)**

Add a temporary route `/engine-spike` rendering a button that calls `getEngine().analyse({ fen: START_FEN, depth: 12, multiPv: 3 })` and prints the result. Run `npm run dev`, open the route, confirm three lines print within a few seconds and the Network tab shows the `.wasm` loading from `/engine/`. Remove the route before committing.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(engine): Stockfish 19 lite worker client with UCI parsing and win per cent"`

---

### Task 5: Board component with non-visual mode

**Spec reference:** spec 4.3. PRD F-AX-1, F-AX-2, F-AX-3, F-AX-4.

**Files:**
- Create: `src/board/types.ts`, `src/board/Board.tsx`, `src/board/TextMoveEntry.tsx`, `src/board/useBoardA11y.ts`, `src/board/Board.test.tsx`, `src/board/index.ts`

- [ ] **Step 1: Failing tests**

`src/board/Board.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from './Board';
import { START_FEN } from '@/rules';

test('text move entry submits a legal SAN move and announces it', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  const input = screen.getByLabelText('Type a move');
  await userEvent.type(input, 'e4{enter}');
  expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' });
  expect(screen.getByRole('status')).toHaveTextContent(/e4/);
});

test('text move entry reports an illegal move without calling onMove', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  await userEvent.type(screen.getByLabelText('Type a move'), 'e5{enter}');
  expect(onMove).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(/not a legal move/i);
});

test('keyboard navigation: arrows move the cursor, Enter selects then moves', () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  // cursor starts at a1 for white; go to e2: right x4, up x1
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' }); fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ uci: 'e2e4' }));
});

test('selectable mode reports square taps instead of moves', () => {
  const onSelect = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="select" onSelectSquare={onSelect} textEntry />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('a1');
});
```

Run: `npx vitest run src/board` → FAIL.

- [ ] **Step 2: Implement types and the a11y hook**

`src/board/types.ts`:
```ts
import type { Square } from '@/rules';
export type BoardMode = 'play' | 'select' | 'static';
export interface BoardMove { from: Square; to: Square; uci: string; san: string }
export interface Arrow { from: Square; to: Square; color?: 'accent' | 'review' | 'danger' }
export interface BoardProps {
  fen: string;
  orientation: 'w' | 'b';
  mode: BoardMode;
  onMove?: (m: BoardMove) => void;
  onSelectSquare?: (sq: Square) => void;
  highlights?: Partial<Record<Square, 'accent' | 'review' | 'danger' | 'selected'>>;
  arrows?: Arrow[];
  disabled?: boolean;
  textEntry?: boolean;
  announce?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}
```

`src/board/useBoardA11y.ts`:
```ts
import { useCallback, useState } from 'react';
import type { Square } from '@/rules';

const FILES = 'abcdefgh';
export function squareAt(file: number, rank: number): Square { return `${FILES[file]}${rank + 1}` as Square; }

export function useBoardA11y(orientation: 'w' | 'b', onActivate: (sq: Square) => void) {
  const [cursor, setCursor] = useState<Square>(orientation === 'w' ? 'a1' : 'h8');
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const f = FILES.indexOf(cursor[0]!); const r = Number(cursor[1]) - 1;
    const dir = orientation === 'w' ? 1 : -1;
    let nf = f, nr = r;
    switch (e.key) {
      case 'ArrowUp': nr = r + dir; break;
      case 'ArrowDown': nr = r - dir; break;
      case 'ArrowRight': nf = f + dir; break;
      case 'ArrowLeft': nf = f - dir; break;
      case 'Enter': case ' ': e.preventDefault(); onActivate(cursor); return;
      default: return;
    }
    e.preventDefault();
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return;
    setCursor(squareAt(nf, nr));
  }, [cursor, orientation, onActivate]);
  return { cursor, onKeyDown };
}
```

- [ ] **Step 3: Implement TextMoveEntry and Board**

`src/board/TextMoveEntry.tsx`:
```tsx
import { useState } from 'react';
export function TextMoveEntry({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSubmit(v.trim()); setV(''); } }}>
      <input aria-label="Type a move" className="tap flex-1 rounded border border-line px-3" placeholder="e.g. e4 or Nf3" value={v} onChange={(e) => setV(e.target.value)} autoCapitalize="off" autoCorrect="off" />
      <button type="submit" className="tap rounded bg-accent px-4 text-white">Move</button>
    </form>
  );
}
```

`src/board/Board.tsx`:
```tsx
import { useCallback, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { applyMove, legalMoves, pieceAt, type Square } from '@/rules';
import type { BoardProps, BoardMove } from './types';
import { TextMoveEntry } from './TextMoveEntry';
import { useBoardA11y } from './useBoardA11y';

const COLORS = { accent: 'rgba(31,95,74,0.55)', review: 'rgba(184,134,11,0.55)', danger: 'rgba(162,59,59,0.55)', selected: 'rgba(31,95,74,0.35)' };
const PIECE_NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function describeSquare(fen: string, sq: Square): string {
  const p = pieceAt(fen, sq);
  return p ? `${sq}, ${p.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[p.type]}` : `${sq}, empty`;
}

export function Board(props: BoardProps) {
  const { fen, orientation, mode, onMove, onSelectSquare, highlights = {}, arrows = [], disabled, textEntry, announce, onDragStart, onDragEnd } = props;
  const [selected, setSelected] = useState<Square | null>(null);
  const [status, setStatus] = useState('');

  const tryMove = useCallback((from: Square, to: Square): boolean => {
    if (disabled || mode !== 'play') return false;
    const lm = legalMoves(fen, from).find((m) => m.to === to);
    if (!lm) return false;
    const uci = lm.promotion ? `${from}${to}q` : lm.uci; // Phase 0: always promote to queen
    const r = applyMove(fen, uci);
    const mv: BoardMove = { from, to, uci: r.uci, san: r.san };
    setSelected(null);
    setStatus(`You played ${r.san}.`);
    onMove?.(mv);
    return true;
  }, [fen, mode, disabled, onMove]);

  const activate = useCallback((sq: Square) => {
    if (disabled) return;
    if (mode === 'select') { onSelectSquare?.(sq); setStatus(describeSquare(fen, sq)); return; }
    if (mode !== 'play') return;
    if (selected) { if (!tryMove(selected, sq)) { setSelected(null); setStatus(`Not a legal move to ${sq}.`); } return; }
    if (legalMoves(fen, sq).length > 0) { setSelected(sq); setStatus(`Selected ${describeSquare(fen, sq)}.`); }
    else setStatus(describeSquare(fen, sq));
  }, [disabled, mode, selected, fen, tryMove, onSelectSquare]);

  const { cursor, onKeyDown } = useBoardA11y(orientation, activate);

  const onText = useCallback((text: string) => {
    if (mode === 'select') { const sq = text.toLowerCase() as Square; if (/^[a-h][1-8]$/.test(sq)) onSelectSquare?.(sq); else setStatus(`${text} is not a square.`); return; }
    try { const r = applyMove(fen, text); onMove?.({ from: r.uci.slice(0, 2) as Square, to: r.uci.slice(2, 4) as Square, uci: r.uci, san: r.san }); setStatus(`You played ${r.san}.`); }
    catch { setStatus(`${text} is not a legal move.`); }
  }, [fen, mode, onMove, onSelectSquare]);

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    for (const [sq, kind] of Object.entries(highlights)) if (kind) s[sq] = { boxShadow: `inset 0 0 0 4px ${COLORS[kind]}` };
    if (selected) s[selected] = { background: COLORS.selected };
    s[cursor] = { ...(s[cursor] ?? {}), outline: '3px solid #1b1f1d', outlineOffset: '-3px' };
    return s;
  }, [highlights, selected, cursor]);

  const options = useMemo(() => ({
    position: fen,
    boardOrientation: orientation === 'w' ? 'white' as const : 'black' as const,
    allowDragging: mode === 'play' && !disabled,
    showAnimations: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    animationDurationInMs: 200,
    squareStyles,
    lightSquareStyle: { backgroundColor: '#e8e4d6' },
    darkSquareStyle: { backgroundColor: '#8fa889' },
    arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color === 'danger' ? '#a23b3b' : a.color === 'review' ? '#b8860b' : '#1f5f4a' })),
    onPieceDrag: () => onDragStart?.(),
    onPieceDragCancel: () => onDragEnd?.(),
    onPieceDrop: ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => { onDragEnd?.(); return !!targetSquare && tryMove(sourceSquare as Square, targetSquare as Square); },
    onSquareClick: ({ square }: { square: string }) => activate(square as Square),
  }), [fen, orientation, mode, disabled, squareStyles, arrows, tryMove, activate, onDragStart, onDragEnd]);

  return (
    <div className="w-full">
      <div role="application" aria-label={`Chess board, ${orientation === 'w' ? 'white' : 'black'} at the bottom. Cursor on ${describeSquare(fen, cursor)}`} tabIndex={0} onKeyDown={onKeyDown} className="w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Chessboard options={options} />
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announce ?? status}</p>
      {textEntry && <TextMoveEntry onSubmit={onText} />}
    </div>
  );
}
```

Check the exact `arrows` element shape and `onPieceDrop` argument names against `node_modules/react-chessboard/dist/types.d.ts` (`Arrow` and `PieceDropHandlerArgs`) and adjust the two mappings if the field names differ; the tests do not depend on them but the build does.

`src/board/index.ts`: `export * from './Board'; export * from './types';`

- [ ] **Step 4: Run tests, lint, typecheck** — `npx vitest run src/board && npm run lint && npm run typecheck` → PASS.

- [ ] **Step 5: Commit** — `git add src/board && git commit -m "feat(board): shared board with text move entry and keyboard navigation"`

---

### Task 6: Tagger-lite

**Spec reference:** spec 4.4. PRD 10.3 (motif tagger, first-release subset restricted here to the facts the coach and bot need), F-PL-3.

**Files:**
- Create: `src/tagger/tagger.ts`, `src/tagger/tagger.test.ts`, `src/tagger/index.ts`

- [ ] **Step 1: Failing tests**

`src/tagger/tagger.test.ts`:
```ts
import { hangingPieces, winningCaptures, mateInOne, justCastled, facts } from './tagger';

// Black knight on e5 attacked by white pawn on d4, undefended.
const hang = '4k3/8/8/4n3/3P4/8/8/4K3 w - - 0 1';
// White queen on h5 can take undefended pawn f7 (black to move can't; white to move).
const freePawn = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3';
const scholars = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

test('hangingPieces finds an attacked undefended piece', () => {
  expect(hangingPieces(hang, 'b')).toEqual([{ square: 'e5', piece: 'n', value: 3 }]);
  expect(hangingPieces(hang, 'w')).toEqual([]);
});

test('winningCaptures lists captures that win material', () => {
  const c = winningCaptures(freePawn);
  expect(c.map((x) => x.san)).toContain('Qxf7+');
});

test('mateInOne finds Qxf7#', () => {
  expect(mateInOne(scholars)).toBe('Qxf7#');
  expect(mateInOne(hang)).toBeNull();
});

test('justCastled detects castling from the SAN', () => {
  expect(justCastled('O-O')).toBe(true);
  expect(justCastled('Nf3')).toBe(false);
});

test('facts summarises a position for the side to move', () => {
  const f = facts(scholars);
  expect(f.mateInOne).toBe('Qxf7#');
  expect(f.inCheck).toBe(false);
  expect(f.captures.length).toBeGreaterThan(0);
});
```

Run: `npx vitest run src/tagger` → FAIL.

- [ ] **Step 2: Implement**

`src/tagger/tagger.ts`:
```ts
import { applyMove, attackersOf, isCheck, isCheckmate, legalMoves, pieceAt, piecesOf, withTurn, turn, PIECE_VALUE, type Color, type PieceType, type Square } from '@/rules';

export interface HangingPiece { square: Square; piece: PieceType; value: number }
export interface CaptureFact { san: string; uci: string; gain: number; target: Square }

function lowestAttackerValue(fen: string, sq: Square, by: Color): number | null {
  const atk = attackersOf(fen, sq, by);
  if (atk.length === 0) return null;
  return Math.min(...atk.map((a) => PIECE_VALUE[pieceAt(fen, a)!.type]));
}

/** Pieces of `color` that are attacked and either undefended or attacked by something cheaper. Kings excluded. */
export function hangingPieces(fen: string, color: Color): HangingPiece[] {
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const out: HangingPiece[] = [];
  for (const { square, piece } of piecesOf(fen, color)) {
    if (piece.type === 'k') continue;
    const atk = lowestAttackerValue(fen, square, enemy);
    if (atk === null) continue;
    const defended = attackersOf(fen, square, color).length > 0;
    const value = PIECE_VALUE[piece.type];
    if (!defended || atk < value) out.push({ square, piece: piece.type, value });
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Captures for the side to move that win material by a one-ply exchange estimate. */
export function winningCaptures(fen: string): CaptureFact[] {
  const me = turn(fen);
  const out: CaptureFact[] = [];
  for (const m of legalMoves(fen).filter((x) => x.capture)) {
    const victim = pieceAt(fen, m.to);
    const victimValue = victim ? PIECE_VALUE[victim.type] : 1; // en passant
    const after = applyMove(fen, m.uci).fen;
    const recaptured = attackersOf(after, m.to, me === 'w' ? 'b' : 'w').length > 0;
    const mover = pieceAt(fen, m.from)!;
    const gain = recaptured ? victimValue - PIECE_VALUE[mover.type] : victimValue;
    if (gain > 0) out.push({ san: m.san, uci: m.uci, gain, target: m.to });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

export function mateInOne(fen: string): string | null {
  for (const m of legalMoves(fen)) if (isCheckmate(applyMove(fen, m.uci).fen)) return m.san;
  return null;
}

export function justCastled(san: string): boolean { return san === 'O-O' || san === 'O-O-O' || san.startsWith('O-O'); }

/** Would the opponent, if it were their move, have a winning capture or mate? */
export function threatsAgainst(fen: string): { captures: CaptureFact[]; mate: string | null } {
  const me = turn(fen);
  const flipped = withTurn(fen, me === 'w' ? 'b' : 'w');
  if (isCheck(flipped)) return { captures: [], mate: null }; // illegal to flip while my king is attacked; treat as no threats
  return { captures: winningCaptures(flipped), mate: mateInOne(flipped) };
}

export interface Facts { inCheck: boolean; mateInOne: string | null; captures: CaptureFact[]; myHanging: HangingPiece[]; theirHanging: HangingPiece[]; threats: ReturnType<typeof threatsAgainst> }

export function facts(fen: string): Facts {
  const me = turn(fen);
  return { inCheck: isCheck(fen), mateInOne: mateInOne(fen), captures: winningCaptures(fen), myHanging: hangingPieces(fen, me), theirHanging: hangingPieces(fen, me === 'w' ? 'b' : 'w'), threats: threatsAgainst(fen) };
}
```

`src/tagger/index.ts`: `export * from './tagger';`

- [ ] **Step 3: Run tests** → PASS. If `winningCaptures` for `freePawn` fails because chess.js's `attackers` counts the king on e8 as a defender of f7 (it does), the test expectation is wrong, not the code: a queen taking a king-defended pawn loses material. Replace the `freePawn` FEN with `4k3/8/8/8/8/8/3p4/4K1Q1 w - - 0 1` (queen g1 takes the pawn d2 for free; expect `Qxd2+`... verify with `legalMoves` output and pin the actual SAN). Record the reasoning in the test as a comment.

- [ ] **Step 4: Commit** — `git add src/tagger && git commit -m "feat(tagger): tagger-lite facts for coach and bot"`

---

### Task 7: Coach templates and CoachService

**Spec reference:** spec 4.5. PRD F-CO-1, F-CO-2, F-CO-4, F-PL-3 (once per move, mutable).

**Files:**
- Create: `content/coach/templates.json`, `src/coach/CoachService.ts`, `src/coach/CoachService.test.ts`, `src/coach/CoachBubble.tsx`, `src/coach/index.ts`

- [ ] **Step 1: Write templates.json**

```json
{
  "persona": { "name": "Coach", "style": "warm, dry, plain words" },
  "templates": {
    "lessonIntro": ["Let's look at one idea. Take your time."],
    "correct": ["{reason}", "Yes. {reason}"],
    "wrongAuthored": ["{feedback}"],
    "wrongEngine": ["Not that one. After {refutationSan}, {consequence}. Try again."],
    "reveal": ["Here it is: {solutionSan}. {reason}"],
    "hintPiece": ["Look at the {pieceName} on {square}."],
    "hintSquare": ["The {pieceName} wants to go to {square}."],
    "takeaway": ["{takeaway}"],
    "hang": ["Careful, your {pieceName} on {square} can be taken for free.", "Your {pieceName} on {square} is hanging."],
    "missedCapture": ["You could have taken the {pieceName} on {square} for free.", "There was a free {pieceName} on {square}."],
    "goodCapture": ["Good. Free {pieceName}.", "Nice, you took the {pieceName}."],
    "castled": ["Castled. Your king is safer now.", "Good, king tucked away."],
    "check": ["Check. Look at all three ways out: move the king, block, or capture."],
    "threatIgnored": ["Your opponent was threatening {threatSan}. Always look at their last move first."],
    "mateAvailable": ["There is a checkmate here. Look for it."],
    "gameWon": ["You did it. Well played."],
    "gameLost": ["That one got away. The review will show why, next time."],
    "gameDrawn": ["A draw. Fair result."]
  }
}
```

- [ ] **Step 2: Failing tests**

`src/coach/CoachService.test.ts`:
```ts
import { CoachService } from './CoachService';

const coach = new CoachService(() => 0); // deterministic: always the first template

test('fills a template from facts', () => {
  expect(coach.line('hang', { pieceName: 'knight', square: 'e5' })).toBe('Careful, your knight on e5 can be taken for free.');
});

test('refuses a template whose facts are missing', () => {
  expect(() => coach.line('hang', { pieceName: 'knight' })).toThrow(/missing fact square/);
});

test('picks by rng among variants', () => {
  const c2 = new CoachService(() => 0.99);
  expect(c2.line('hang', { pieceName: 'rook', square: 'a1' })).toBe('Your rook on a1 is hanging.');
});

test('pieceName helper', () => {
  expect(CoachService.pieceName('n')).toBe('knight');
});

test('muted coach returns null', () => {
  const c = new CoachService(() => 0); c.muted = true;
  expect(c.line('castled', {})).toBeNull();
});
```

Run → FAIL.

- [ ] **Step 3: Implement**

`src/coach/CoachService.ts`:
```ts
import templates from '@content/coach/templates.json';
import type { PieceType } from '@/rules';

export type CoachEvent = keyof typeof templates.templates;
export type CoachFacts = Record<string, string | number | undefined>;

const NAMES: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export class CoachService {
  muted = false;
  constructor(private readonly rng: () => number = Math.random) {}

  static pieceName(t: PieceType): string { return NAMES[t]; }

  /** Returns one line for the event, or null when muted. Throws if a template needs a fact the caller did not supply — the coach never invents. */
  line(event: CoachEvent, facts: CoachFacts): string | null {
    if (this.muted) return null;
    const variants = templates.templates[event];
    const t = variants[Math.min(variants.length - 1, Math.floor(this.rng() * variants.length))]!;
    return t.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = facts[k];
      if (v === undefined || v === '') throw new Error(`coach template ${event} missing fact ${k}`);
      return String(v);
    });
  }
}

export const coachName = templates.persona.name;
```

`src/coach/CoachBubble.tsx`:
```tsx
import { coachName } from './CoachService';
export function CoachBubble({ text, tone = 'neutral' }: { text: string | null; tone?: 'neutral' | 'good' | 'bad' }) {
  if (!text) return null;
  const ring = tone === 'good' ? 'border-accent' : tone === 'bad' ? 'border-danger' : 'border-line';
  return (
    <div className={`mt-3 flex gap-3 rounded-xl border ${ring} bg-card p-3`} role="note" aria-label={`${coachName} says`}>
      <div aria-hidden className="h-8 w-8 shrink-0 rounded-full bg-accent-soft" />
      <p className="text-sm leading-snug">{text}</p>
    </div>
  );
}
```

`src/coach/index.ts`: `export * from './CoachService'; export * from './CoachBubble';`

- [ ] **Step 4: Run tests, lint** → PASS. **Step 5: Commit** — `git add content/coach src/coach && git commit -m "feat(coach): template bank and CoachService keyed on verified facts"`

---

### Task 8: Lesson content format, types, loader and the verification script

**Spec reference:** spec 4.7 (JSON shape), PRD 7.3, 7.4, 9.2 (four checks), 9.4.

**Files:**
- Create: `content/schema/lesson.schema.json`, `content/schema/checkpoint.schema.json`, `src/lesson/types.ts`, `src/lesson/loader.ts`, `src/lesson/loader.test.ts`, `scripts/verify-content.mjs` (replace stub), `content/section-1/unit-1.1/lesson-1.1.1.json` (first real lesson, used by the tests)

- [ ] **Step 1: Types**

`src/lesson/types.ts`:
```ts
import type { Square } from '@/rules';

export type ChallengeType = 'find_the_move' | 'find_the_sequence' | 'find_them_all' | 'is_it_safe' | 'which_square' | 'name_the_pattern' | 'play_it_out' | 'guess_the_move';

export interface Hints { piece?: Square; square?: Square }

interface Base { id: string; fen: string; prompt: string; hints?: Hints; reason?: string; concept: string }

export type Challenge =
  | (Base & { type: 'find_the_move'; answer: { moves: string[] }; wrong?: Record<string, string> })
  | (Base & { type: 'find_the_sequence'; answer: { line: string[] }; wrong?: Record<string, string> })
  | (Base & { type: 'find_them_all'; answer: { squares: Square[] } })
  | (Base & { type: 'is_it_safe'; move: string; answer: { safe: boolean; reason: number }; reasons: [string, string, string] })
  | (Base & { type: 'which_square'; answer: { square: Square }; timeLimitS?: number })
  | (Base & { type: 'name_the_pattern'; options: [string, string, string]; answer: { option: number } })
  | (Base & { type: 'play_it_out'; goal: { kind: 'mate_in' | 'promote' | 'capture_all' | 'survive'; moves: number }; opponentDepth?: number })
  | (Base & { type: 'guess_the_move'; answer: { moves: string[] }; commentary: string });

export interface Lesson {
  id: string; unit: string; title: string; xp: number;
  card: { idea: string; diagrams: string[]; habit?: string };
  explain: { fen: string; text: string; arrows?: [Square, Square][]; highlights?: Square[] }[];
  challenges: Challenge[];
  takeaway: string;
}

export interface CheckpointBank { unit: string; title: string; passMark: number; sample: number; bank: Challenge[] }

export interface UnitGuide { unit: string; title: string; lessons: string[]; guidebook: string }
```

- [ ] **Step 2: JSON schema**

`content/schema/lesson.schema.json` (ajv draft-07):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "unit", "title", "xp", "card", "explain", "challenges", "takeaway"],
  "properties": {
    "id": { "type": "string", "pattern": "^[1-4]\\.[0-9]+\\.[0-9]+$" },
    "unit": { "type": "string", "pattern": "^[1-4]\\.[0-9]+$" },
    "title": { "type": "string", "minLength": 1 },
    "xp": { "type": "integer", "minimum": 10, "maximum": 20 },
    "card": { "type": "object", "required": ["idea", "diagrams"], "properties": { "idea": { "type": "string", "maxLength": 400 }, "diagrams": { "type": "array", "items": { "type": "string" }, "maxItems": 3 }, "habit": { "type": "string" } } },
    "explain": { "type": "array", "minItems": 1, "maxItems": 3, "items": { "type": "object", "required": ["fen", "text"], "properties": { "fen": { "type": "string" }, "text": { "type": "string", "maxLength": 420 }, "arrows": { "type": "array" }, "highlights": { "type": "array" } } } },
    "challenges": { "type": "array", "minItems": 5, "maxItems": 10, "items": { "$ref": "#/definitions/challenge" } },
    "takeaway": { "type": "string", "minLength": 1, "maxLength": 200 }
  },
  "definitions": {
    "challenge": {
      "type": "object",
      "required": ["id", "type", "fen", "prompt", "concept"],
      "properties": {
        "id": { "type": "string" },
        "type": { "enum": ["find_the_move", "find_the_sequence", "find_them_all", "is_it_safe", "which_square", "name_the_pattern", "play_it_out", "guess_the_move"] },
        "fen": { "type": "string" },
        "prompt": { "type": "string", "maxLength": 200 },
        "concept": { "type": "string" },
        "hints": { "type": "object" },
        "reason": { "type": "string" },
        "answer": { "type": "object" },
        "wrong": { "type": "object" },
        "goal": { "type": "object" },
        "options": { "type": "array" },
        "reasons": { "type": "array" },
        "move": { "type": "string" },
        "commentary": { "type": "string" },
        "timeLimitS": { "type": "integer" },
        "opponentDepth": { "type": "integer" }
      }
    }
  }
}
```

`content/schema/checkpoint.schema.json`: object with required `unit`, `title`, `passMark` (number 0.75), `sample` (integer 8 to 12), `bank` (array minItems 30 of the same challenge definition, copy the definition block).

- [ ] **Step 3: First real lesson (used by the loader test and later by the player)**

`content/section-1/unit-1.1/lesson-1.1.1.json` — "The board":
```json
{
  "id": "1.1.1", "unit": "1.1", "title": "The board", "xp": 10,
  "card": { "idea": "The board has 64 squares. Columns are files, named a to h from your left. Rows are ranks, numbered 1 to 8 from your side. Every square has a name: file then rank.", "diagrams": ["8/8/8/8/8/8/8/8 w - - 0 1"] },
  "explain": [
    { "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "text": "Files run up the board, a to h. The a-file is on your left when you play White.", "highlights": ["a1","a2","a3","a4","a5","a6","a7","a8"] },
    { "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "text": "Ranks run across. Rank 1 is nearest you as White. Put file and rank together and every square has a name, like e4.", "highlights": ["a4","b4","c4","d4","e4","f4","g4","h4"] }
  ],
  "challenges": [
    { "id": "1.1.1-c1", "type": "which_square", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "prompt": "Tap e4.", "answer": { "square": "e4" }, "concept": "square-names", "reason": "e is the fifth file, 4 is the fourth rank." },
    { "id": "1.1.1-c2", "type": "which_square", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "prompt": "Tap a1.", "answer": { "square": "a1" }, "concept": "square-names", "reason": "a1 is the corner on your left as White." },
    { "id": "1.1.1-c3", "type": "which_square", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "prompt": "Tap h8.", "answer": { "square": "h8" }, "concept": "square-names", "reason": "h8 is the far corner on your right." },
    { "id": "1.1.1-c4", "type": "find_them_all", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "prompt": "Tap every square on the d-file.", "answer": { "squares": ["d1","d2","d3","d4","d5","d6","d7","d8"] }, "concept": "files" },
    { "id": "1.1.1-c5", "type": "find_them_all", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "prompt": "Tap every square on the 7th rank.", "answer": { "squares": ["a7","b7","c7","d7","e7","f7","g7","h7"] }, "concept": "ranks" },
    { "id": "1.1.1-c6", "type": "which_square", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "prompt": "Tap c6, quickly.", "answer": { "square": "c6" }, "timeLimitS": 8, "concept": "square-names", "reason": "Third file, sixth rank." }
  ],
  "takeaway": "File first, then rank: e4 is the e-file, fourth rank."
}
```

- [ ] **Step 4: Failing loader test**

`src/lesson/loader.test.ts`:
```ts
import { loadLesson, listLessons, loadCheckpoint } from './loader';

test('lists lessons in unit order', async () => {
  const ids = listLessons('1.1');
  expect(ids[0]).toBe('1.1.1');
});

test('loads a lesson by id', async () => {
  const l = await loadLesson('1.1.1');
  expect(l.title).toBe('The board');
  expect(l.challenges.length).toBeGreaterThanOrEqual(5);
});

test('unknown lesson rejects', async () => {
  await expect(loadLesson('9.9.9')).rejects.toThrow(/unknown lesson/i);
});

test('loadCheckpoint rejects for a unit with no bank yet', async () => {
  await expect(loadCheckpoint('9.9')).rejects.toThrow(/unknown checkpoint/i);
});
```

- [ ] **Step 5: Implement loader with Vite glob imports**

`src/lesson/loader.ts`:
```ts
import type { CheckpointBank, Lesson } from './types';

const lessonModules = import.meta.glob<{ default: Lesson }>('/content/section-*/unit-*/lesson-*.json');
const checkpointModules = import.meta.glob<{ default: CheckpointBank }>('/content/section-*/unit-*/checkpoint.json');

function idFromPath(p: string): string { return p.match(/lesson-([\d.]+)\.json$/)![1]!; }
function unitFromPath(p: string): string { return p.match(/unit-([\d.]+)\/checkpoint\.json$/)![1]!; }

const byId = new Map(Object.entries(lessonModules).map(([p, m]) => [idFromPath(p), m]));
const cpByUnit = new Map(Object.entries(checkpointModules).map(([p, m]) => [unitFromPath(p), m]));

function numeric(id: string): number[] { return id.split('.').map(Number); }
function cmp(a: string, b: string): number { const x = numeric(a), y = numeric(b); for (let i = 0; i < 3; i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; } return 0; }

export function listLessons(unit: string): string[] { return [...byId.keys()].filter((id) => id.startsWith(`${unit}.`)).sort(cmp); }
export function hasCheckpoint(unit: string): boolean { return cpByUnit.has(unit); }

export async function loadLesson(id: string): Promise<Lesson> {
  const m = byId.get(id); if (!m) throw new Error(`Unknown lesson ${id}`);
  return (await m()).default;
}
export async function loadCheckpoint(unit: string): Promise<CheckpointBank> {
  const m = cpByUnit.get(unit); if (!m) throw new Error(`Unknown checkpoint ${unit}`);
  return (await m()).default;
}
```

Run: `npx vitest run src/lesson/loader.test.ts` → PASS (vitest supports `import.meta.glob`).

- [ ] **Step 6: The verification script**

`scripts/verify-content.mjs` replaces the stub. It runs in Node, loads the stockfish lite-single build as a Node worker thread using the npm package, and enforces PRD 9.2:

```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import Ajv from 'ajv';
import { Chess } from 'chess.js';

const ajv = new Ajv({ allErrors: true });
const lessonSchema = ajv.compile(JSON.parse(readFileSync('content/schema/lesson.schema.json', 'utf8')));
const cpSchema = ajv.compile(JSON.parse(readFileSync('content/schema/checkpoint.schema.json', 'utf8')));

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

function walk(dir, out = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p, out) : p.endsWith('.json') && out.push(p); } return out; }

// ---- engine over a worker thread; the stockfish package runs under Node ----
function startEngine() {
  const w = new Worker(new URL('../node_modules/stockfish/bin/stockfish-19-lite-single.js', import.meta.url));
  const listeners = [];
  w.on('message', (line) => listeners.forEach((l) => l(String(line))));
  const send = (s) => w.postMessage(s);
  const until = (pred) => new Promise((res) => { const l = (line) => { if (pred(line)) { listeners.splice(listeners.indexOf(l), 1); res(line); } }; listeners.push(l); });
  return {
    async init() { send('uci'); await until((l) => l === 'uciok'); send('setoption name MultiPV value 2'); send('isready'); await until((l) => l === 'readyok'); },
    async top2(fen, depth = 14) {
      const lines = new Map();
      const l = (line) => { const m = line.match(/multipv (\d+) score (cp|mate) (-?\d+) .*? pv (\S+)/); if (m) lines.set(Number(m[1]), { kind: m[2], v: Number(m[3]), move: m[4] }); };
      listeners.push(l);
      send(`position fen ${fen}`); send(`go depth ${depth}`);
      await until((x) => x.startsWith('bestmove'));
      listeners.splice(listeners.indexOf(l), 1);
      return [lines.get(1), lines.get(2)];
    },
    close() { w.terminate(); },
  };
}

function scoreCp(s) { return s.kind === 'mate' ? (s.v > 0 ? 10000 : -10000) : s.v; }

const engine = startEngine();
await engine.init();

async function checkChallenge(where, c) {
  let chess;
  try { chess = new Chess(c.fen); } catch (e) { return fail(where, `bad FEN: ${e.message}`); }
  const legal = chess.moves({ verbose: true });
  const ok = (san) => legal.some((m) => m.san === san);
  switch (c.type) {
    case 'find_the_move': {
      for (const s of c.answer.moves) if (!ok(s)) fail(where, `solution ${s} is not legal`);
      for (const w of Object.keys(c.wrong ?? {})) if (!ok(w)) fail(where, `wrong-move key ${w} is not legal`);
      if (c.answer.moves.length === 1 && legal.length > 1) {
        const [a, b] = await engine.top2(c.fen);
        const best = legal.find((m) => m.from + m.to + (m.promotion ?? '') === a?.move);
        if (!best || best.san !== c.answer.moves[0]) fail(where, `engine best is ${best?.san ?? a?.move}, solution says ${c.answer.moves[0]}`);
        else if (b && scoreCp(a) - scoreCp(b) < 100) fail(where, `second-best ${b.move} is within 100cp; not a single-solution challenge`);
      }
      break;
    }
    case 'find_the_sequence': {
      const g = new Chess(c.fen);
      for (const s of c.answer.line) { if (!g.move(s)) { fail(where, `line move ${s} illegal`); break; } }
      break;
    }
    case 'find_them_all': {
      if (!Array.isArray(c.answer.squares) || c.answer.squares.length === 0) fail(where, 'find_them_all needs squares');
      break;
    }
    case 'is_it_safe': {
      if (!ok(c.move)) fail(where, `is_it_safe move ${c.move} is not legal`);
      if (!(c.reasons?.length === 3) || c.answer.reason < 0 || c.answer.reason > 2) fail(where, 'is_it_safe needs 3 reasons and a valid index');
      break;
    }
    case 'which_square': if (!/^[a-h][1-8]$/.test(c.answer.square)) fail(where, 'which_square needs a square'); break;
    case 'name_the_pattern': if (!(c.options?.length === 3) || c.answer.option < 0 || c.answer.option > 2) fail(where, 'name_the_pattern needs 3 options'); break;
    case 'play_it_out': if (!c.goal?.kind || !(c.goal.moves > 0)) fail(where, 'play_it_out needs a goal with moves'); break;
    case 'guess_the_move': { const g = new Chess(c.fen); for (const s of c.answer.moves) if (!g.move(s)) { fail(where, `guess move ${s} illegal`); break; } break; }
    default: fail(where, `unknown type ${c.type}`);
  }
  if (c.hints?.piece && !chess.get(c.hints.piece)) fail(where, `hint piece square ${c.hints.piece} is empty`);
}

const files = walk('content/section-1');
const seenIds = new Set();
for (const f of files) {
  const doc = JSON.parse(readFileSync(f, 'utf8'));
  const isCp = f.endsWith('checkpoint.json');
  const valid = isCp ? cpSchema(doc) : lessonSchema(doc);
  if (!valid) { fail(f, ajv.errorsText(isCp ? cpSchema.errors : lessonSchema.errors)); continue; }
  const challenges = isCp ? doc.bank : doc.challenges;
  for (const c of challenges) {
    if (seenIds.has(c.id)) fail(f, `duplicate challenge id ${c.id}`); seenIds.add(c.id);
    await checkChallenge(`${f} ${c.id}`, c);
  }
  if (!isCp) for (const [i, e] of doc.explain.entries()) if (e.text.split(/\s+/).length > 60) fail(f, `explain[${i}] over 60 words`);
}
engine.close();
if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length} content error(s)`); process.exit(1); }
console.log(`verify-content: ${files.length} files, ${seenIds.size} challenges OK`);
```

If the stockfish worker script does not run under `worker_threads` (it targets Web Workers first), replace `startEngine` with a `child_process.spawn('node', ['node_modules/stockfish/bin/stockfish-19-lite-single.js'])` reading stdout line by line; the package README says the WASM builds run under supported Node versions.

Run: `npm run verify:content`
Expected: `verify-content: 1 files, 6 challenges OK`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(content): lesson schema, loader, first lesson and engine-backed verifier"`

---

### Task 9: LessonMachine, hint accounting and stars

**Spec reference:** spec 4.7 (machine rules). PRD 7.3 (feedback and close), F-PA-5, F-PA-6, F-PZ-4 (hint accounting).

**Files:**
- Create: `src/lesson/LessonMachine.ts`, `src/lesson/LessonMachine.test.ts`, `src/lesson/stars.ts`, `src/lesson/stars.test.ts`, `src/lesson/answers.ts`, `src/lesson/answers.test.ts`

- [ ] **Step 1: Failing tests for stars and answer checking**

`src/lesson/stars.test.ts`:
```ts
import { stars } from './stars';
test('three stars: no hints, at most one miss', () => { expect(stars({ hints: 0, misses: 1 })).toBe(3); });
test('two stars: any hint or two misses', () => { expect(stars({ hints: 1, misses: 0 })).toBe(2); expect(stars({ hints: 0, misses: 2 })).toBe(2); });
test('one star otherwise', () => { expect(stars({ hints: 3, misses: 5 })).toBe(1); });
```

`src/lesson/answers.test.ts`:
```ts
import { checkAnswer } from './answers';
import type { Challenge } from './types';

const ftm: Challenge = { id: 'x', type: 'find_the_move', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', prompt: '', concept: 'mate', answer: { moves: ['Qxf7#'] }, wrong: { Bxf7+: 'Check, but the king escapes.' } };

test('find_the_move accepts SAN or UCI form of a solution', () => {
  expect(checkAnswer(ftm, { kind: 'move', uci: 'h5f7' })).toEqual({ correct: true });
  expect(checkAnswer(ftm, { kind: 'move', uci: 'c4f7' })).toEqual({ correct: false, authored: 'Check, but the king escapes.' });
  expect(checkAnswer(ftm, { kind: 'move', uci: 'g1f3' })).toEqual({ correct: false });
});

test('find_them_all requires the exact set', () => {
  const c: Challenge = { id: 'y', type: 'find_them_all', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: '', concept: 'f', answer: { squares: ['d1', 'd2'] } };
  expect(checkAnswer(c, { kind: 'squares', squares: ['d2', 'd1'] })).toEqual({ correct: true });
  expect(checkAnswer(c, { kind: 'squares', squares: ['d1'] })).toEqual({ correct: false, missing: ['d2'], extra: [] });
});

test('which_square, name_the_pattern, is_it_safe', () => {
  expect(checkAnswer({ id: 'a', type: 'which_square', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: '', concept: 'c', answer: { square: 'e4' } }, { kind: 'square', square: 'e4' })).toEqual({ correct: true });
  expect(checkAnswer({ id: 'b', type: 'name_the_pattern', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: '', concept: 'c', options: ['Fork', 'Pin', 'Skewer'], answer: { option: 1 } }, { kind: 'option', option: 0 })).toEqual({ correct: false });
  expect(checkAnswer({ id: 'c', type: 'is_it_safe', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', prompt: '', concept: 'c', move: 'e4', reasons: ['a', 'b', 'c'], answer: { safe: true, reason: 0 } }, { kind: 'safe', safe: true, reason: 0 })).toEqual({ correct: true });
});
```

- [ ] **Step 2: Implement stars.ts and answers.ts**

`src/lesson/stars.ts`:
```ts
export function stars(s: { hints: number; misses: number }): 1 | 2 | 3 {
  if (s.hints === 0 && s.misses <= 1) return 3;
  if (s.hints > 0 || s.misses === 2) return 2;
  return 1;
}
```

`src/lesson/answers.ts`:
```ts
import { applyMove, type Square } from '@/rules';
import type { Challenge } from './types';

export type Attempt =
  | { kind: 'move'; uci: string }
  | { kind: 'squares'; squares: Square[] }
  | { kind: 'square'; square: Square }
  | { kind: 'option'; option: number }
  | { kind: 'safe'; safe: boolean; reason: number }
  | { kind: 'goal'; met: boolean };

export type Verdict = { correct: true } | { correct: false; authored?: string; missing?: Square[]; extra?: Square[] };

function sanOf(fen: string, move: string): string | null { try { return applyMove(fen, move).san; } catch { return null; } }

export function checkAnswer(c: Challenge, a: Attempt): Verdict {
  switch (c.type) {
    case 'find_the_move': case 'guess_the_move': {
      if (a.kind !== 'move') return { correct: false };
      const san = sanOf(c.fen, a.uci);
      const solutions = c.answer.moves.map((m) => sanOf(c.fen, m));
      if (san && solutions.includes(san)) return { correct: true };
      const authored = c.type === 'find_the_move' && san ? c.wrong?.[san] : undefined;
      return authored ? { correct: false, authored } : { correct: false };
    }
    case 'find_the_sequence': {
      // The player checks one ply at a time against answer.line via checkSequenceStep; a full attempt here is the first move.
      if (a.kind !== 'move') return { correct: false };
      const san = sanOf(c.fen, a.uci);
      return san && sanOf(c.fen, c.answer.line[0]!) === san ? { correct: true } : (san && c.wrong?.[san] ? { correct: false, authored: c.wrong[san] } : { correct: false });
    }
    case 'find_them_all': {
      if (a.kind !== 'squares') return { correct: false };
      const want = new Set(c.answer.squares), got = new Set(a.squares);
      const missing = [...want].filter((s) => !got.has(s)), extra = [...got].filter((s) => !want.has(s));
      return missing.length === 0 && extra.length === 0 ? { correct: true } : { correct: false, missing, extra };
    }
    case 'which_square': return a.kind === 'square' && a.square === c.answer.square ? { correct: true } : { correct: false };
    case 'name_the_pattern': return a.kind === 'option' && a.option === c.answer.option ? { correct: true } : { correct: false };
    case 'is_it_safe': return a.kind === 'safe' && a.safe === c.answer.safe && a.reason === c.answer.reason ? { correct: true } : { correct: false };
    case 'play_it_out': return a.kind === 'goal' && a.met ? { correct: true } : { correct: false };
  }
}

/** For find_the_sequence: returns the authored reply after the learner's i-th correct move, or null when the line is complete. */
export function sequenceReply(c: Extract<Challenge, { type: 'find_the_sequence' }>, learnerMoveIndex: number): string | null {
  const replyIdx = learnerMoveIndex * 2 + 1;
  return c.answer.line[replyIdx] ?? null;
}
```

Run: `npx vitest run src/lesson/stars.test.ts src/lesson/answers.test.ts` → PASS.

- [ ] **Step 3: Failing tests for the machine**

`src/lesson/LessonMachine.test.ts`:
```ts
import { initLesson, reduce, type LessonState } from './LessonMachine';
import type { Lesson } from './types';

const lesson: Lesson = {
  id: '9.9.1', unit: '9.9', title: 't', xp: 10, card: { idea: 'i', diagrams: [] },
  explain: [{ fen: '8/8/8/8/8/8/8/8 w - - 0 1', text: 'e' }],
  challenges: [
    { id: 'c1', type: 'which_square', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: 'p', concept: 'x', answer: { square: 'e4' }, hints: { square: 'e4' }, reason: 'because' },
    { id: 'c2', type: 'find_the_move', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', prompt: 'p', concept: 'y', answer: { moves: ['Qxf7#'] }, hints: { piece: 'h5', square: 'f7' } },
  ],
  takeaway: 'tk',
};

function run(...actions: Parameters<typeof reduce>[1][]): LessonState { return actions.reduce((s, a) => reduce(s, a), initLesson(lesson)); }

test('walks card → explain → challenges → close', () => {
  let s = initLesson(lesson);
  expect(s.phase).toEqual({ kind: 'card' });
  s = reduce(s, { type: 'next' }); expect(s.phase).toEqual({ kind: 'explain', index: 0 });
  s = reduce(s, { type: 'next' }); expect(s.phase).toMatchObject({ kind: 'challenge', index: 0, status: 'attempting' });
});

test('correct first try records credit and moves on with next', () => {
  const s = run({ type: 'next' }, { type: 'next' }, { type: 'attempt', attempt: { kind: 'square', square: 'e4' } });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 0, status: 'correct' });
  expect(s.results['c1']).toEqual({ correct: true, hints: 0, misses: 0, mastery: true });
  expect(s.feedback).toBe('because');
});

test('first miss → retry; second miss → reveal; hint removes mastery credit', () => {
  let s = run({ type: 'next' }, { type: 'next' }, { type: 'attempt', attempt: { kind: 'square', square: 'a1' } });
  expect(s.phase).toMatchObject({ kind: 'challenge', status: 'retry' });
  s = reduce(s, { type: 'hint' });
  expect(s.hintLevel).toBe(1);
  expect(s.highlights).toEqual({ e4: 'accent' });
  s = reduce(s, { type: 'attempt', attempt: { kind: 'square', square: 'b2' } });
  expect(s.phase).toMatchObject({ kind: 'challenge', status: 'revealed' });
  expect(s.results['c1']).toEqual({ correct: false, hints: 1, misses: 2, mastery: false });
});

test('correct after a hint: progress credit, no mastery', () => {
  const s = run({ type: 'next' }, { type: 'next' }, { type: 'hint' }, { type: 'attempt', attempt: { kind: 'square', square: 'e4' } });
  expect(s.results['c1']).toEqual({ correct: true, hints: 1, misses: 0, mastery: false });
});

test('close computes stars and xp', () => {
  let s = run({ type: 'next' }, { type: 'next' }, { type: 'attempt', attempt: { kind: 'square', square: 'e4' } }, { type: 'next' });
  s = reduce(s, { type: 'attempt', attempt: { kind: 'move', uci: 'h5f7' } });
  s = reduce(s, { type: 'next' });
  expect(s.phase).toEqual({ kind: 'close', stars: 3, xp: 10 });
});

test('hints disabled flag blocks hints (checkpoints)', () => {
  const s0 = { ...initLesson(lesson), hintsAllowed: false };
  const s = reduce(reduce(reduce(s0, { type: 'next' }), { type: 'next' }), { type: 'hint' });
  expect(s.hintLevel).toBe(0);
});
```

- [ ] **Step 4: Implement LessonMachine**

`src/lesson/LessonMachine.ts`:
```ts
import type { Square } from '@/rules';
import { checkAnswer, type Attempt } from './answers';
import { stars } from './stars';
import type { Challenge, Lesson } from './types';

export type Phase =
  | { kind: 'card' }
  | { kind: 'explain'; index: number }
  | { kind: 'challenge'; index: number; status: 'attempting' | 'retry' | 'correct' | 'revealed' }
  | { kind: 'close'; stars: 1 | 2 | 3; xp: number };

export interface ChallengeResult { correct: boolean; hints: number; misses: number; mastery: boolean }

export interface LessonState {
  lesson: Lesson; phase: Phase; hintLevel: 0 | 1 | 2; hintsAllowed: boolean;
  results: Record<string, ChallengeResult>; feedback: string | null; feedbackTone: 'neutral' | 'good' | 'bad';
  highlights: Partial<Record<Square, 'accent' | 'review' | 'danger' | 'selected'>>;
  refutation: { from: Square; to: Square } | null; totalHints: number; totalMisses: number;
}

export type Action =
  | { type: 'next' } | { type: 'hint' } | { type: 'attempt'; attempt: Attempt } | { type: 'reveal' }
  | { type: 'engineRefutation'; from: Square; to: Square; text: string };

export function initLesson(lesson: Lesson, hintsAllowed = true): LessonState {
  return { lesson, phase: { kind: 'card' }, hintLevel: 0, hintsAllowed, results: {}, feedback: null, feedbackTone: 'neutral', highlights: {}, refutation: null, totalHints: 0, totalMisses: 0 };
}

export function currentChallenge(s: LessonState): Challenge | null { return s.phase.kind === 'challenge' ? s.lesson.challenges[s.phase.index] ?? null : null; }

function startChallenge(s: LessonState, index: number): LessonState {
  return { ...s, phase: { kind: 'challenge', index, status: 'attempting' }, hintLevel: 0, feedback: null, feedbackTone: 'neutral', highlights: {}, refutation: null };
}

function finish(s: LessonState): LessonState {
  const st = stars({ hints: s.totalHints, misses: s.totalMisses });
  return { ...s, phase: { kind: 'close', stars: st, xp: s.lesson.xp }, highlights: {}, feedback: s.lesson.takeaway, feedbackTone: 'neutral' };
}

export function reduce(s: LessonState, a: Action): LessonState {
  const p = s.phase;
  switch (a.type) {
    case 'next': {
      if (p.kind === 'card') return s.lesson.explain.length ? { ...s, phase: { kind: 'explain', index: 0 } } : startChallenge(s, 0);
      if (p.kind === 'explain') return p.index + 1 < s.lesson.explain.length ? { ...s, phase: { kind: 'explain', index: p.index + 1 } } : startChallenge(s, 0);
      if (p.kind === 'challenge' && (p.status === 'correct' || p.status === 'revealed')) return p.index + 1 < s.lesson.challenges.length ? startChallenge(s, p.index + 1) : finish(s);
      return s;
    }
    case 'hint': {
      const c = currentChallenge(s);
      if (!c || !s.hintsAllowed || p.kind !== 'challenge' || (p.status !== 'attempting' && p.status !== 'retry') || s.hintLevel >= 2) return s;
      const level = (s.hintLevel + 1) as 1 | 2;
      const sq = level === 1 ? (c.hints?.piece ?? c.hints?.square) : (c.hints?.square ?? c.hints?.piece);
      if (!sq) return s;
      const r = s.results[c.id] ?? { correct: false, hints: 0, misses: 0, mastery: false };
      return { ...s, hintLevel: level, totalHints: s.totalHints + 1, highlights: { [sq]: 'accent' }, results: { ...s.results, [c.id]: { ...r, hints: r.hints + 1, mastery: false } } };
    }
    case 'attempt': {
      const c = currentChallenge(s);
      if (!c || p.kind !== 'challenge' || (p.status !== 'attempting' && p.status !== 'retry')) return s;
      const r = s.results[c.id] ?? { correct: false, hints: 0, misses: 0, mastery: false };
      const v = checkAnswer(c, a.attempt);
      if (v.correct) {
        const mastery = r.hints === 0 && r.misses <= 1;
        return { ...s, phase: { ...p, status: 'correct' }, feedback: c.reason ?? 'Yes.', feedbackTone: 'good', highlights: {}, refutation: null, results: { ...s.results, [c.id]: { ...r, correct: true, mastery } } };
      }
      const misses = r.misses + 1;
      const results = { ...s.results, [c.id]: { ...r, misses, mastery: false } };
      if (misses >= 2) return { ...s, phase: { ...p, status: 'revealed' }, results, totalMisses: s.totalMisses + 1, feedback: revealText(c), feedbackTone: 'neutral', highlights: revealHighlights(c) };
      const fb = v.authored ?? (v.missing || v.extra ? `Not quite. ${v.missing?.length ? `You missed ${v.missing.length}.` : ''} ${v.extra?.length ? `${v.extra.length} of those don't belong.` : ''}`.trim() : 'Not that one. Try again.');
      return { ...s, phase: { ...p, status: 'retry' }, results, totalMisses: s.totalMisses + 1, feedback: fb, feedbackTone: 'bad' };
    }
    case 'engineRefutation': return p.kind === 'challenge' && p.status === 'retry' ? { ...s, refutation: { from: a.from, to: a.to }, feedback: a.text } : s;
    case 'reveal': {
      const c = currentChallenge(s);
      if (!c || p.kind !== 'challenge' || (p.status !== 'attempting' && p.status !== 'retry')) return s;
      const r = s.results[c.id] ?? { correct: false, hints: 0, misses: 0, mastery: false };
      return { ...s, phase: { ...p, status: 'revealed' }, results: { ...s.results, [c.id]: { ...r, mastery: false } }, feedback: revealText(c), highlights: revealHighlights(c) };
    }
  }
}

function revealText(c: Challenge): string {
  switch (c.type) {
    case 'find_the_move': case 'guess_the_move': return `The answer is ${c.answer.moves[0]}. ${c.reason ?? ''}`.trim();
    case 'find_the_sequence': return `The line starts ${c.answer.line[0]}. ${c.reason ?? ''}`.trim();
    case 'which_square': return `That square is ${c.answer.square}. ${c.reason ?? ''}`.trim();
    case 'find_them_all': return `Here they all are. ${c.reason ?? ''}`.trim();
    case 'name_the_pattern': return `It is ${c.options[c.answer.option]}. ${c.reason ?? ''}`.trim();
    case 'is_it_safe': return `${c.answer.safe ? 'Safe' : 'Not safe'}: ${c.reasons[c.answer.reason]}`;
    case 'play_it_out': return `Here is the idea. ${c.reason ?? ''}`.trim();
  }
}

function revealHighlights(c: Challenge): LessonState['highlights'] {
  if (c.type === 'find_them_all') return Object.fromEntries(c.answer.squares.map((s) => [s, 'accent'])) as LessonState['highlights'];
  if (c.type === 'which_square') return { [c.answer.square]: 'accent' };
  if (c.hints?.square) return { [c.hints.square]: 'accent', ...(c.hints.piece ? { [c.hints.piece]: 'selected' } : {}) };
  return {};
}
```

Run: `npx vitest run src/lesson` → PASS.

- [ ] **Step 5: Commit** — `git add src/lesson && git commit -m "feat(lesson): pure lesson state machine with hint accounting and stars"`

---

### Task 10: Challenge components and LessonPlayer

**Spec reference:** spec 4.7 (player), wireframes screens 6 to 9, PRD 7.3, 7.4, F-PA-4, F-PA-6, F-AX-1.

**Files:**
- Create: `src/lesson/LessonPlayer.tsx`, `src/lesson/LessonPlayer.test.tsx`, `src/lesson/challenges/ChallengeView.tsx`, `src/lesson/challenges/FindThemAll.tsx`, `src/lesson/challenges/Options.tsx`, `src/lesson/challenges/PlayItOut.tsx`, `src/lesson/challenges/Sequence.tsx`, `src/lesson/useEngineRefutation.ts`, `src/app/settings.ts`

- [ ] **Step 1: Settings store (text entry, coach mute, reduced motion)**

`src/app/settings.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Settings { textEntry: boolean; coachMuted: boolean; setTextEntry: (v: boolean) => void; setCoachMuted: (v: boolean) => void }
export const useSettings = create<Settings>()(persist((set) => ({
  textEntry: false, coachMuted: false,
  setTextEntry: (textEntry) => set({ textEntry }), setCoachMuted: (coachMuted) => set({ coachMuted }),
}), { name: 'chessapp-settings' }));
```

- [ ] **Step 2: Failing player test**

`src/lesson/LessonPlayer.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonPlayer } from './LessonPlayer';
import type { Lesson } from './types';

const lesson: Lesson = {
  id: '9.9.1', unit: '9.9', title: 'Test lesson', xp: 10, card: { idea: 'An idea', diagrams: [] },
  explain: [{ fen: '8/8/8/8/8/8/8/8 w - - 0 1', text: 'Explain this' }],
  challenges: [
    { id: 'c1', type: 'name_the_pattern', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: 'Which is it?', concept: 'x', options: ['Fork', 'Pin', 'Skewer'], answer: { option: 1 }, reason: 'A pin.' },
    { id: 'c2', type: 'which_square', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: 'Type e4', concept: 'x', answer: { square: 'e4' } },
  ],
  takeaway: 'Remember this.',
};

test('plays a lesson through to the close screen', async () => {
  const onComplete = vi.fn();
  render(<LessonPlayer lesson={lesson} onComplete={onComplete} onExit={() => {}} textEntry />);
  expect(screen.getByText('An idea')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  expect(screen.getByText('Explain this')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Fork' }));
  expect(screen.getByText(/try again/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
  expect(screen.getByText('A pin.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  await userEvent.type(screen.getByLabelText('Type a move'), 'e4{enter}');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText('Remember this.')).toBeInTheDocument();
  expect(screen.getByText(/2 stars|3 stars|1 star/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to the path/i }));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ lessonId: '9.9.1', stars: 2, xp: 10 }));
});
```

- [ ] **Step 3: Implement the challenge views**

`src/lesson/challenges/Options.tsx` (used by `name_the_pattern` and `is_it_safe`):
```tsx
export function Options({ options, onPick, disabled }: { options: string[]; onPick: (i: number) => void; disabled?: boolean }) {
  return (
    <div className="mt-3 grid gap-2">
      {options.map((o, i) => (
        <button key={o} type="button" disabled={disabled} onClick={() => onPick(i)} className="tap rounded-lg border border-line bg-card px-4 py-3 text-left hover:border-accent disabled:opacity-60">{o}</button>
      ))}
    </div>
  );
}
```

`src/lesson/challenges/FindThemAll.tsx`:
```tsx
import { useState } from 'react';
import { Board } from '@/board';
import type { Square } from '@/rules';

export function FindThemAll({ fen, onSubmit, disabled, textEntry, highlights }: { fen: string; onSubmit: (squares: Square[]) => void; disabled?: boolean; textEntry?: boolean; highlights: Partial<Record<Square, 'accent' | 'review' | 'danger' | 'selected'>> }) {
  const [picked, setPicked] = useState<Square[]>([]);
  const toggle = (sq: Square) => setPicked((p) => (p.includes(sq) ? p.filter((x) => x !== sq) : [...p, sq]));
  const merged = { ...highlights, ...Object.fromEntries(picked.map((s) => [s, 'selected'])) } as typeof highlights;
  return (
    <>
      <Board fen={fen} orientation="w" mode="select" onSelectSquare={toggle} highlights={merged} disabled={disabled} textEntry={textEntry} announce={`${picked.length} squares selected: ${picked.join(', ')}`} />
      <button type="button" className="tap mt-3 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={disabled || picked.length === 0} onClick={() => { onSubmit(picked); setPicked([]); }}>Check ({picked.length})</button>
    </>
  );
}
```

`src/lesson/challenges/Sequence.tsx` (find_the_sequence: learner plays, authored reply auto-plays):
```tsx
import { useEffect, useState } from 'react';
import { Board } from '@/board';
import { applyMove } from '@/rules';
import { sequenceReply } from '../answers';
import type { Challenge } from '../types';

type Seq = Extract<Challenge, { type: 'find_the_sequence' }>;
export function Sequence({ c, onStep, onDone, onWrong, disabled, textEntry }: { c: Seq; onStep: () => void; onDone: () => void; onWrong: (san: string) => void; disabled?: boolean; textEntry?: boolean }) {
  const [fen, setFen] = useState(c.fen);
  const [i, setI] = useState(0);
  useEffect(() => { setFen(c.fen); setI(0); }, [c]);
  return (
    <Board fen={fen} orientation={c.fen.split(' ')[1] === 'b' ? 'b' : 'w'} mode="play" disabled={disabled} textEntry={textEntry} onMove={(m) => {
      const want = applyMove(fen, c.answer.line[i * 2]!).san;
      if (m.san !== want) { onWrong(m.san); return; }
      let next = applyMove(fen, m.uci).fen;
      const reply = sequenceReply(c, i);
      if (reply) { next = applyMove(next, reply).fen; setFen(next); setI(i + 1); onStep(); }
      else { setFen(next); onDone(); }
    }} />
  );
}
```

`src/lesson/challenges/PlayItOut.tsx` (learner vs engine until the goal):
```tsx
import { useEffect, useRef, useState } from 'react';
import { Board } from '@/board';
import { applyMove, gameStatus, pieceAt, piecesOf, turn, type Square } from '@/rules';
import { getEngine } from '@/engine';
import type { Challenge } from '../types';

type PIO = Extract<Challenge, { type: 'play_it_out' }>;

export function goalMet(c: PIO, fen: string, learner: 'w' | 'b', learnerMoves: number): boolean | null {
  const st = gameStatus(fen);
  switch (c.goal.kind) {
    case 'mate_in': if (st.over && st.result === 'checkmate' && st.winner === learner) return true; if (st.over || learnerMoves >= c.goal.moves) return false; return null;
    case 'promote': { const back = learner === 'w' ? '8' : '1'; const promoted = piecesOf(fen, learner).some((p) => p.piece.type === 'q' && p.square.endsWith(back)); if (promoted) return true; if (st.over || learnerMoves >= c.goal.moves) return false; return null; }
    case 'capture_all': { const enemy = learner === 'w' ? 'b' : 'w'; if (piecesOf(fen, enemy).every((p) => p.piece.type === 'k')) return true; if (st.over || learnerMoves >= c.goal.moves) return false; return null; }
    case 'survive': if (st.over && st.result === 'checkmate' && st.winner !== learner) return false; if (learnerMoves >= c.goal.moves) return true; return null;
  }
}

export function PlayItOut({ c, onResult, disabled, textEntry }: { c: PIO; onResult: (met: boolean) => void; disabled?: boolean; textEntry?: boolean }) {
  const learner = turn(c.fen);
  const [fen, setFen] = useState(c.fen);
  const [moves, setMoves] = useState(0);
  const [thinking, setThinking] = useState(false);
  const done = useRef(false);
  useEffect(() => { setFen(c.fen); setMoves(0); done.current = false; }, [c]);
  const settle = (f: string, n: number) => { const g = goalMet(c, f, learner, n); if (g !== null && !done.current) { done.current = true; onResult(g); return true; } return false; };
  return (
    <>
      <Board fen={fen} orientation={learner} mode="play" disabled={disabled || thinking} textEntry={textEntry} onMove={async (m) => {
        const after = applyMove(fen, m.uci).fen; const n = moves + 1; setFen(after); setMoves(n);
        if (settle(after, n)) return;
        setThinking(true);
        try { const reply = await getEngine().bestMove({ fen: after, depth: c.opponentDepth ?? 6 }); const f2 = applyMove(after, reply).fen; setFen(f2); settle(f2, n); }
        catch { /* engine unavailable: learner keeps the move; PRD F-ER-1 */ }
        finally { setThinking(false); }
      }} />
      <p className="mt-2 text-sm text-ink-muted">Moves used: {moves} of {c.goal.moves}{pieceAt(fen, 'e1' as Square) ? '' : ''}</p>
    </>
  );
}
```
(Remove the no-op `pieceAt` fragment at the end of the paragraph; it is there only so the import list matches during drafting. Final code: `<p ...>Moves used: {moves} of {c.goal.moves}</p>` and drop `pieceAt`, `Square` from the import.)

`src/lesson/useEngineRefutation.ts` (F-PA-6 fallback when no authored feedback):
```ts
import { useEffect } from 'react';
import { applyMove, toSan, type Square } from '@/rules';
import { getEngine } from '@/engine';
import { facts } from '@/tagger';
import { CoachService } from '@/coach';
import type { Action, LessonState } from './LessonMachine';

export function useEngineRefutation(s: LessonState, lastWrongUci: string | null, dispatch: (a: Action) => void, coach: CoachService) {
  useEffect(() => {
    if (s.phase.kind !== 'challenge' || s.phase.status !== 'retry' || !lastWrongUci) return;
    const c = s.lesson.challenges[s.phase.index]!;
    if (c.type !== 'find_the_move' && c.type !== 'find_the_sequence') return;
    if (s.feedback && s.feedback !== 'Not that one. Try again.') return; // authored feedback present
    let cancelled = false;
    (async () => {
      try {
        const after = applyMove(c.fen, lastWrongUci).fen;
        const reply = await getEngine().bestMove({ fen: after, depth: 10 });
        if (cancelled) return;
        const f = facts(applyMove(after, reply).fen);
        const consequence = f.mateInOne ? 'you are about to be mated' : f.myHanging[0] ? `your ${CoachService.pieceName(f.myHanging[0].piece)} on ${f.myHanging[0].square} is lost` : 'your idea no longer works';
        const text = coach.line('wrongEngine', { refutationSan: toSan(after, reply), consequence }) ?? '';
        dispatch({ type: 'engineRefutation', from: reply.slice(0, 2) as Square, to: reply.slice(2, 4) as Square, text });
      } catch { /* engine unavailable: keep the generic retry line (F-ER-1) */ }
    })();
    return () => { cancelled = true; };
  }, [s.phase, lastWrongUci, s.lesson.challenges, s.feedback, dispatch, coach]);
}
```

- [ ] **Step 4: Implement LessonPlayer**

`src/lesson/LessonPlayer.tsx`:
```tsx
import { useMemo, useReducer, useState } from 'react';
import { Board } from '@/board';
import { CoachBubble, CoachService } from '@/coach';
import { useSettings } from '@/app/settings';
import { initLesson, reduce, currentChallenge, type LessonState } from './LessonMachine';
import { Options } from './challenges/Options';
import { FindThemAll } from './challenges/FindThemAll';
import { Sequence } from './challenges/Sequence';
import { PlayItOut } from './challenges/PlayItOut';
import { useEngineRefutation } from './useEngineRefutation';
import type { Lesson } from './types';

export interface LessonOutcome { lessonId: string; stars: 1 | 2 | 3; xp: number; results: LessonState['results'] }

export function LessonPlayer({ lesson, onComplete, onExit, textEntry: forceText, hintsAllowed = true, title }: { lesson: Lesson; onComplete: (o: LessonOutcome) => void; onExit: () => void; textEntry?: boolean; hintsAllowed?: boolean; title?: string }) {
  const settings = useSettings();
  const textEntry = forceText ?? settings.textEntry;
  const coach = useMemo(() => { const c = new CoachService(); c.muted = settings.coachMuted; return c; }, [settings.coachMuted]);
  const [s, dispatch] = useReducer(reduce, lesson, (l) => initLesson(l, hintsAllowed));
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  useEngineRefutation(s, lastWrong, dispatch, coach);
  const c = currentChallenge(s);
  const ph = s.phase;
  const hintLabel = s.hintLevel === 0 ? 'Hint' : s.hintLevel === 1 ? 'Second hint' : 'No more hints';
  const busy = ph.kind === 'challenge' && ph.status !== 'attempting' && ph.status !== 'retry';

  return (
    <section className="flex min-h-full flex-col p-4">
      <header className="flex items-center justify-between">
        <button type="button" className="tap" aria-label="Exit lesson" onClick={onExit}>✕</button>
        <h1 className="text-sm text-ink-muted">{title ?? `${lesson.id} · ${lesson.title}`}</h1>
        <span className="text-sm text-ink-muted">{ph.kind === 'challenge' ? `${ph.index + 1} of ${lesson.challenges.length}` : ''}</span>
      </header>

      {ph.kind === 'card' && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">{lesson.title}</h2>
          <p className="mt-3">{lesson.card.idea}</p>
          {lesson.card.habit && <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm">Habit: {lesson.card.habit}</p>}
          {lesson.card.diagrams[0] && <div className="mt-4"><Board fen={lesson.card.diagrams[0]} orientation="w" mode="static" /></div>}
          <button type="button" className="tap mt-auto w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white" onClick={() => dispatch({ type: 'next' })}>Start</button>
        </div>
      )}

      {ph.kind === 'explain' && (() => { const e = lesson.explain[ph.index]!; return (
        <div className="mt-4">
          <Board fen={e.fen} orientation="w" mode="static" arrows={(e.arrows ?? []).map(([from, to]) => ({ from, to }))} highlights={Object.fromEntries((e.highlights ?? []).map((h) => [h, 'accent']))} />
          <CoachBubble text={e.text} />
          <button type="button" className="tap mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white" onClick={() => dispatch({ type: 'next' })}>Next</button>
        </div>
      ); })()}

      {ph.kind === 'challenge' && c && (
        <div className="mt-4">
          <p className="font-semibold">{c.prompt}</p>
          {(c.type === 'find_the_move' || c.type === 'guess_the_move' || c.type === 'which_square') && (
            <Board fen={c.fen} orientation={c.fen.split(' ')[1] === 'b' ? 'b' : 'w'} mode={c.type === 'which_square' ? 'select' : 'play'} disabled={busy} textEntry={textEntry}
              highlights={s.highlights} arrows={s.refutation ? [{ ...s.refutation, color: 'danger' }] : []}
              onMove={(m) => { setLastWrong(m.uci); dispatch({ type: 'attempt', attempt: { kind: 'move', uci: m.uci } }); }}
              onSelectSquare={(sq) => dispatch({ type: 'attempt', attempt: { kind: 'square', square: sq } })} />
          )}
          {c.type === 'find_the_sequence' && (
            <Sequence c={c} disabled={busy} textEntry={textEntry} onStep={() => {}} onDone={() => dispatch({ type: 'attempt', attempt: { kind: 'move', uci: c.answer.line[0]! } })} onWrong={(san) => { setLastWrong(san); dispatch({ type: 'attempt', attempt: { kind: 'move', uci: 'a1a1' } }); }} />
          )}
          {c.type === 'find_them_all' && <FindThemAll fen={c.fen} disabled={busy} textEntry={textEntry} highlights={s.highlights} onSubmit={(squares) => dispatch({ type: 'attempt', attempt: { kind: 'squares', squares } })} />}
          {c.type === 'name_the_pattern' && (<><Board fen={c.fen} orientation="w" mode="static" highlights={s.highlights} /><Options options={c.options} disabled={busy} onPick={(option) => dispatch({ type: 'attempt', attempt: { kind: 'option', option } })} /></>)}
          {c.type === 'is_it_safe' && (<><Board fen={c.fen} orientation="w" mode="static" highlights={s.highlights} /><p className="mt-2">Proposed move: <strong>{c.move}</strong>. Is it safe?</p><Options options={c.reasons.map((r, i) => `${i === c.answer.reason && c.answer.safe ? 'Yes' : i === c.answer.reason ? 'No' : i % 2 ? 'No' : 'Yes'}: ${r}`)} disabled={busy} onPick={(reason) => dispatch({ type: 'attempt', attempt: { kind: 'safe', safe: reason === c.answer.reason ? c.answer.safe : !c.answer.safe, reason } })} /></>)}
          {c.type === 'play_it_out' && <PlayItOut c={c} disabled={busy} textEntry={textEntry} onResult={(met) => dispatch({ type: 'attempt', attempt: { kind: 'goal', met } })} />}

          <CoachBubble text={s.feedback} tone={s.feedbackTone} />
          <div className="mt-4 flex gap-2">
            {!busy && s.hintsAllowed && <button type="button" className="tap flex-1 rounded-lg border border-line px-3" onClick={() => dispatch({ type: 'hint' })} disabled={s.hintLevel >= 2} title="Hints cost mastery credit: a move after a hint earns progress but no mastery.">{hintLabel}</button>}
            {!busy && <button type="button" className="tap flex-1 rounded-lg border border-line px-3" onClick={() => dispatch({ type: 'reveal' })}>Show me</button>}
            {busy && <button type="button" className="tap flex-1 rounded-lg bg-accent px-3 font-semibold text-white" onClick={() => dispatch({ type: 'next' })}>Next</button>}
          </div>
        </div>
      )}

      {ph.kind === 'close' && (
        <div className="mt-6 text-center">
          <p className="text-3xl" aria-label={`${ph.stars} stars`}>{'★'.repeat(ph.stars)}{'☆'.repeat(3 - ph.stars)}</p>
          <p className="mt-1 text-sm text-ink-muted">{ph.stars} stars · {s.totalHints} hints · {s.totalMisses} misses</p>
          <h2 className="mt-4 text-xl font-semibold">Lesson done</h2>
          <p className="mt-3 rounded-lg bg-accent-soft p-3">{lesson.takeaway}</p>
          <p className="mt-3 text-ink-muted">+{ph.xp} XP</p>
          <button type="button" className="tap mt-6 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white" onClick={() => onComplete({ lessonId: lesson.id, stars: ph.stars, xp: ph.xp, results: s.results })}>Back to the path</button>
        </div>
      )}
    </section>
  );
}
```

The `is_it_safe` option rendering above is convoluted; simplify it to two steps in the UI: first "Yes / No" buttons, then the three reasons. Implement that as a small local state `safePick` in the player: when `safePick === null` show `Options(['Yes, it is safe', 'No, it is not safe'])` mapping to `true/false`; once picked, show `Options(c.reasons)` and dispatch `{ kind: 'safe', safe: safePick, reason }`. Reset `safePick` on `next`. Adjust the test if needed (the test above does not exercise `is_it_safe`).

- [ ] **Step 5: Run tests, lint, typecheck** — `npx vitest run src/lesson && npm run lint && npm run typecheck` → PASS. Fix the `find_the_sequence` wrong-attempt hack: instead of dispatching a fake `a1a1`, add an action `{ type: 'miss'; san: string }` to `LessonMachine` that applies the same miss/retry logic as a wrong `attempt` (extract the wrong-branch into `applyMiss(s, c, authored?)`) and use it from `Sequence.onWrong`. Add a unit test for `miss` mirroring the "first miss → retry" test.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(lesson): lesson player with all eight challenge types"`

---

### Task 11: Learner data: Dexie, events, projections, store

**Spec reference:** spec 4.10 (Dexie tables, projections rebuilt by a reducer). PRD F-AC-1 (guest, offline), F-AC-3 (append-only, client ids, device day, duplicates count once).

**Files:**
- Create: `src/data/events.ts`, `src/data/db.ts`, `src/data/reduce.ts`, `src/data/reduce.test.ts`, `src/data/store.ts`, `src/data/store.test.ts`, `src/data/index.ts`

- [ ] **Step 1: Event types**

`src/data/events.ts`:
```ts
export type EventPayload =
  | { type: 'lesson_started'; lessonId: string }
  | { type: 'challenge_attempted'; lessonId: string; challengeId: string; correct: boolean; hints: number; misses: number; mastery: boolean; context: 'lesson' | 'checkpoint' }
  | { type: 'lesson_completed'; lessonId: string; stars: 1 | 2 | 3; xp: number; replay: boolean }
  | { type: 'checkpoint_attempted'; unit: string; score: number; passed: boolean; attempt: number; missedConcepts: string[] }
  | { type: 'unit_tested_out'; unit: string }
  | { type: 'game_started'; gameId: string; persona: string; color: 'w' | 'b'; timeControl: 'untimed' | '10+0'; coach: boolean }
  | { type: 'game_finished'; gameId: string; result: 'win' | 'loss' | 'draw'; moves: number; hints: number; takebacks: number; crowns: 0 | 1 | 2 | 3; pgn: string }
  | { type: 'settings_changed'; key: string; value: string | boolean | number };

export interface LearnerEvent { id: string; deviceDay: string; createdAt: string; payload: EventPayload; synced: 0 | 1 }

export function newEvent(payload: EventPayload, now = new Date()): LearnerEvent {
  return { id: crypto.randomUUID(), deviceDay: localDay(now), createdAt: now.toISOString(), payload, synced: 0 };
}

/** Day in the device's local time zone, PRD F-EN-1 / F-AC-3. */
export function localDay(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 2: Failing reducer tests**

`src/data/reduce.test.ts`:
```ts
import { reduceProgress, emptyProgress } from './reduce';
import { newEvent } from './events';

test('lesson completion marks the lesson and adds xp once per id', () => {
  const e = newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: false });
  const p = reduceProgress(emptyProgress(), [e, e]); // duplicate id counts once
  expect(p.lessons['1.1.1']).toEqual({ stars: 3, completed: true });
  expect(p.xp).toBe(10);
});

test('best stars are kept; replay earns half xp', () => {
  const a = newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 2, xp: 10, replay: false });
  const b = newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: true });
  const p = reduceProgress(emptyProgress(), [a, b]);
  expect(p.lessons['1.1.1']?.stars).toBe(3);
  expect(p.xp).toBe(15);
});

test('checkpoint pass completes the unit; test-out marks lessons too', () => {
  const p = reduceProgress(emptyProgress(), [
    newEvent({ type: 'checkpoint_attempted', unit: '1.1', score: 0.8, passed: true, attempt: 1, missedConcepts: [] }),
    newEvent({ type: 'unit_tested_out', unit: '1.2' }),
  ]);
  expect(p.units['1.1']).toEqual({ passed: true, attempts: 1, testedOut: false });
  expect(p.units['1.2']).toEqual({ passed: true, attempts: 0, testedOut: true });
});

test('concept mastery counts mastery-credit attempts only', () => {
  const p = reduceProgress(emptyProgress(), [
    newEvent({ type: 'challenge_attempted', lessonId: '1.1.1', challengeId: 'c1', correct: true, hints: 0, misses: 0, mastery: true, context: 'lesson' }),
    newEvent({ type: 'challenge_attempted', lessonId: '1.1.1', challengeId: 'c2', correct: true, hints: 1, misses: 0, mastery: false, context: 'lesson' }),
  ]);
  expect(p.attempts).toBe(2);
  expect(p.masteryAttempts).toBe(1);
});

test('games: consecutive losses are tracked for the cool-down rule', () => {
  const loss = (id: string) => newEvent({ type: 'game_finished', gameId: id, result: 'loss', moves: 30, hints: 0, takebacks: 0, crowns: 3, pgn: '' });
  const p = reduceProgress(emptyProgress(), [loss('a'), loss('b')]);
  expect(p.consecutiveLosses).toBe(2);
  expect(p.games).toBe(2);
});
```

- [ ] **Step 3: Implement reducer**

`src/data/reduce.ts`:
```ts
import type { LearnerEvent } from './events';

export interface Progress {
  lessons: Record<string, { stars: 1 | 2 | 3; completed: boolean }>;
  units: Record<string, { passed: boolean; attempts: number; testedOut: boolean }>;
  xp: number; attempts: number; masteryAttempts: number; games: number; consecutiveLosses: number; lastEventAt: string | null;
}

export function emptyProgress(): Progress { return { lessons: {}, units: {}, xp: 0, attempts: 0, masteryAttempts: 0, games: 0, consecutiveLosses: 0, lastEventAt: null }; }

export function reduceProgress(start: Progress, events: LearnerEvent[]): Progress {
  const seen = new Set<string>();
  const p: Progress = structuredClone(start);
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const e of sorted) {
    if (seen.has(e.id)) continue; seen.add(e.id);
    p.lastEventAt = e.createdAt;
    const x = e.payload;
    switch (x.type) {
      case 'lesson_completed': {
        const prev = p.lessons[x.lessonId];
        p.lessons[x.lessonId] = { stars: prev ? (Math.max(prev.stars, x.stars) as 1 | 2 | 3) : x.stars, completed: true };
        p.xp += x.replay ? Math.floor(x.xp / 2) : x.xp;
        break;
      }
      case 'challenge_attempted': p.attempts += 1; if (x.mastery) p.masteryAttempts += 1; break;
      case 'checkpoint_attempted': { const u = p.units[x.unit] ?? { passed: false, attempts: 0, testedOut: false }; p.units[x.unit] = { ...u, attempts: u.attempts + 1, passed: u.passed || x.passed }; if (x.passed) p.xp += 50; break; }
      case 'unit_tested_out': { const u = p.units[x.unit] ?? { passed: false, attempts: 0, testedOut: false }; p.units[x.unit] = { ...u, passed: true, testedOut: true }; break; }
      case 'game_finished': p.games += 1; p.consecutiveLosses = x.result === 'loss' ? p.consecutiveLosses + 1 : 0; p.xp += 10; break;
      default: break;
    }
  }
  return p;
}
```

- [ ] **Step 4: Dexie schema and the zustand store**

`src/data/db.ts`:
```ts
import Dexie, { type EntityTable } from 'dexie';
import type { LearnerEvent } from './events';

export interface GameRow { id: string; pgn: string; fen: string; persona: string; color: 'w' | 'b'; startedAt: string; finishedAt: string | null; result: 'win' | 'loss' | 'draw' | null }

export class ChessDb extends Dexie {
  events!: EntityTable<LearnerEvent, 'id'>;
  games!: EntityTable<GameRow, 'id'>;
  constructor() {
    super('chessapp');
    this.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
  }
}
export const db = new ChessDb();
```

`src/data/store.ts`:
```ts
import { create } from 'zustand';
import { db } from './db';
import { newEvent, type EventPayload, type LearnerEvent } from './events';
import { emptyProgress, reduceProgress, type Progress } from './reduce';

interface State { progress: Progress; loaded: boolean; load: () => Promise<void>; append: (p: EventPayload) => Promise<LearnerEvent>; rebuild: () => Promise<void> }

const listeners = new Set<(e: LearnerEvent) => void>();
/** Sync (Task 16) subscribes here to flush after each write. */
export function onEventAppended(fn: (e: LearnerEvent) => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

export const useProgress = create<State>((set, get) => ({
  progress: emptyProgress(), loaded: false,
  load: async () => { const all = await db.events.toArray(); set({ progress: reduceProgress(emptyProgress(), all), loaded: true }); },
  append: async (payload) => { const e = newEvent(payload); await db.events.add(e); set({ progress: reduceProgress(get().progress, [e]) }); listeners.forEach((l) => l(e)); return e; },
  rebuild: async () => { await get().load(); },
}));
```

`src/data/store.test.ts`:
```ts
import { db } from './db';
import { useProgress } from './store';

beforeEach(async () => { await db.events.clear(); useProgress.setState({ progress: { lessons: {}, units: {}, xp: 0, attempts: 0, masteryAttempts: 0, games: 0, consecutiveLosses: 0, lastEventAt: null }, loaded: false }); });

test('append persists and updates progress; load rebuilds from disk', async () => {
  await useProgress.getState().append({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: false });
  expect(useProgress.getState().progress.xp).toBe(10);
  expect(await db.events.count()).toBe(1);
  useProgress.setState({ progress: { ...useProgress.getState().progress, xp: 0 } });
  await useProgress.getState().load();
  expect(useProgress.getState().progress.xp).toBe(10);
});
```

`src/data/index.ts`: `export * from './events'; export * from './db'; export * from './reduce'; export * from './store';`

- [ ] **Step 5: Run tests** — `npx vitest run src/data` → PASS (fake-indexeddb is loaded in setup). **Step 6: Commit** — `git add src/data && git commit -m "feat(data): append-only event log in Dexie with progress projections"`

---

### Task 12: Curriculum, Path screen, lesson route, Today

**Spec reference:** spec 4.12; wireframes 4 and 5; PRD F-PA-1, F-PA-2 (early checkpoint), F-PA-7 (replay), F-HM-1 (current node), F-HM-6 (cool-down after two losses).

**Files:**
- Create: `src/path/curriculum.ts`, `src/path/progress.ts`, `src/path/progress.test.ts`, `src/path/PathScreen.tsx`, `src/path/LessonRoute.tsx`, `src/screens/TodayScreen.tsx` (replace)
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Curriculum data for Section 1 (Appendix A of the PRD, units 1.1 to 1.6)**

`src/path/curriculum.ts`:
```ts
export interface UnitDef { id: string; title: string; lessons: { id: string; title: string }[]; built: boolean }
export const SECTION_1: { id: string; title: string; band: string; units: UnitDef[] } = {
  id: '1', title: 'Foundations', band: 'New to 400',
  units: [
    { id: '1.1', title: 'The board and the pieces', built: true, lessons: [
      { id: '1.1.1', title: 'The board' }, { id: '1.1.2', title: 'The rook' }, { id: '1.1.3', title: 'The bishop' }, { id: '1.1.4', title: 'The queen' },
      { id: '1.1.5', title: 'The king' }, { id: '1.1.6', title: 'The knight' }, { id: '1.1.7', title: 'The pawn, promotion and en passant' }, { id: '1.1.8', title: 'Setting up the board' } ] },
    { id: '1.2', title: 'Capturing and value', built: true, lessons: [
      { id: '1.2.1', title: 'Attack, capture and defend' }, { id: '1.2.2', title: 'Piece values' }, { id: '1.2.3', title: 'Take free pieces' }, { id: '1.2.4', title: 'Do not leave pieces free' }, { id: '1.2.5', title: 'Counting attackers and defenders' } ] },
    { id: '1.3', title: 'Check, mate and draws', built: false, lessons: [ { id: '1.3.1', title: 'Check and the three ways out' }, { id: '1.3.2', title: 'Checkmate' }, { id: '1.3.3', title: 'Mate in one' }, { id: '1.3.4', title: 'Stalemate' }, { id: '1.3.5', title: 'The three draws' } ] },
    { id: '1.4', title: 'Castling and the rules of play', built: false, lessons: [ { id: '1.4.1', title: 'Castling both sides' }, { id: '1.4.2', title: 'En passant again' }, { id: '1.4.3', title: 'Touch move, draws, resigning, notation, the clock' } ] },
    { id: '1.5', title: 'Your first mates', built: false, lessons: [ { id: '1.5.1', title: 'The ladder mate' }, { id: '1.5.2', title: 'King and queen against king' }, { id: '1.5.3', title: 'King and rook against king' }, { id: '1.5.4', title: 'The back-rank mate' }, { id: '1.5.5', title: "Meeting Scholar's and Fool's mate" } ] },
    { id: '1.6', title: 'Safety first', built: false, lessons: [ { id: '1.6.1', title: 'The three questions' }, { id: '1.6.2', title: 'All checks and captures' }, { id: '1.6.3', title: 'Your first full game with the coach' } ] },
  ],
};
```

- [ ] **Step 2: Failing tests for node state derivation**

`src/path/progress.test.ts`:
```ts
import { pathNodes } from './progress';
import { emptyProgress } from '@/data';

test('first lesson is active, the rest locked, checkpoint always attemptable', () => {
  const nodes = pathNodes(emptyProgress());
  expect(nodes[0]).toMatchObject({ kind: 'lesson', id: '1.1.1', state: 'active' });
  expect(nodes[1]).toMatchObject({ kind: 'lesson', id: '1.1.2', state: 'locked' });
  const cp = nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1');
  expect(cp).toMatchObject({ state: 'available' });
});

test('completing lessons advances the active node; passing the checkpoint unlocks the next unit', () => {
  const p = emptyProgress();
  p.lessons['1.1.1'] = { stars: 3, completed: true };
  let nodes = pathNodes(p);
  expect(nodes[0]).toMatchObject({ state: 'done' });
  expect(nodes[1]).toMatchObject({ state: 'active' });
  p.units['1.1'] = { passed: true, attempts: 1, testedOut: false };
  nodes = pathNodes(p);
  expect(nodes.find((n) => n.kind === 'lesson' && n.id === '1.2.1')).toMatchObject({ state: 'active' });
  expect(nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1')).toMatchObject({ state: 'passed' });
});

test('units not yet built are shown as coming', () => {
  const n = pathNodes(emptyProgress()).find((n) => n.kind === 'lesson' && n.id === '1.3.1');
  expect(n).toMatchObject({ state: 'coming' });
});
```

- [ ] **Step 3: Implement progress.ts**

`src/path/progress.ts`:
```ts
import type { Progress } from '@/data';
import { SECTION_1 } from './curriculum';

export type Node =
  | { kind: 'lesson'; id: string; unit: string; title: string; state: 'done' | 'active' | 'locked' | 'coming' | 'testedOut' }
  | { kind: 'checkpoint'; unit: string; title: string; state: 'available' | 'passed' | 'coming' };

export function pathNodes(p: Progress): Node[] {
  const out: Node[] = [];
  let activeAssigned = false;
  let previousUnitPassed = true;
  for (const u of SECTION_1.units) {
    const passed = p.units[u.id]?.passed ?? false;
    const testedOut = p.units[u.id]?.testedOut ?? false;
    for (const l of u.lessons) {
      if (!u.built) { out.push({ kind: 'lesson', id: l.id, unit: u.id, title: l.title, state: 'coming' }); continue; }
      const done = p.lessons[l.id]?.completed ?? false;
      let state: Extract<Node, { kind: 'lesson' }>['state'];
      if (testedOut && !done) state = 'testedOut';
      else if (done) state = 'done';
      else if (!activeAssigned && previousUnitPassed) { state = 'active'; activeAssigned = true; }
      else state = 'locked';
      out.push({ kind: 'lesson', id: l.id, unit: u.id, title: l.title, state });
    }
    out.push({ kind: 'checkpoint', unit: u.id, title: `${u.title} checkpoint`, state: !u.built ? 'coming' : passed ? 'passed' : 'available' });
    previousUnitPassed = passed;
  }
  return out;
}

export function activeLesson(p: Progress): Extract<Node, { kind: 'lesson' }> | null {
  return (pathNodes(p).find((n) => n.kind === 'lesson' && n.state === 'active') as Extract<Node, { kind: 'lesson' }> | undefined) ?? null;
}
```

Run: `npx vitest run src/path` → PASS.

- [ ] **Step 4: PathScreen and LessonRoute**

`src/path/PathScreen.tsx`:
```tsx
import { Link } from 'react-router';
import { useProgress } from '@/data';
import { pathNodes } from './progress';
import { SECTION_1 } from './curriculum';

const badge: Record<string, string> = { done: 'bg-accent text-white', testedOut: 'bg-accent-soft text-accent', active: 'ring-2 ring-accent bg-card', locked: 'bg-line text-ink-muted', coming: 'bg-line text-ink-muted', available: 'bg-review-soft text-review', passed: 'bg-accent text-white' };

export function PathScreen() {
  const progress = useProgress((s) => s.progress);
  const nodes = pathNodes(progress);
  return (
    <section className="p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">Section {SECTION_1.id} · {SECTION_1.band}</p>
      <h1 className="text-xl font-semibold">{SECTION_1.title}</h1>
      <ol className="mt-4 space-y-2">
        {nodes.map((n) => {
          const key = n.kind === 'lesson' ? n.id : `cp-${n.unit}`;
          const enabled = n.kind === 'lesson' ? n.state === 'active' || n.state === 'done' || n.state === 'testedOut' : n.state !== 'coming';
          const to = n.kind === 'lesson' ? `/lesson/${n.id}` : `/checkpoint/${n.unit}`;
          const label = n.kind === 'lesson' ? `${n.id} ${n.title}` : n.title;
          const hint = n.kind === 'lesson' ? ({ done: `${progress.lessons[n.id]?.stars ?? 0} stars`, active: 'Up next', locked: 'Locked', coming: 'Content coming', testedOut: 'Tested out' } as const)[n.state] : n.state === 'passed' ? 'Passed' : n.state === 'coming' ? 'Content coming' : 'Attempt any time to test out';
          const inner = (
            <div className={`tap flex items-center gap-3 rounded-xl border border-line px-3 py-3 ${badge[n.state]}`}>
              <span aria-hidden className="text-lg">{n.kind === 'checkpoint' ? '🏁' : n.state === 'done' ? '✓' : '•'}</span>
              <span className="flex-1"><span className="block font-medium">{label}</span><span className="block text-xs opacity-80">{hint}</span></span>
            </div>
          );
          return <li key={key}>{enabled ? <Link to={to} aria-label={label}>{inner}</Link> : <div aria-disabled="true">{inner}</div>}</li>;
        })}
      </ol>
    </section>
  );
}
```

`src/path/LessonRoute.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { loadLesson, type Lesson } from '@/lesson';
import { LessonPlayer } from '@/lesson/LessonPlayer';
import { useProgress } from '@/data';

export function LessonRoute() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress((s) => s.progress);
  const append = useProgress((s) => s.append);
  useEffect(() => { let on = true; loadLesson(id).then((l) => { if (on) { setLesson(l); void append({ type: 'lesson_started', lessonId: l.id }); } }).catch((e: Error) => setError(e.message)); return () => { on = false; }; }, [id, append]);
  if (error) return <section className="p-4"><p>That lesson could not be loaded.</p><button type="button" className="tap mt-3 rounded-lg border border-line px-4" onClick={() => nav('/path')}>Back to the path</button></section>;
  if (!lesson) return <section className="p-4 text-ink-muted">Loading…</section>;
  const replay = progress.lessons[lesson.id]?.completed ?? false;
  return (
    <LessonPlayer lesson={lesson} onExit={() => nav('/path')} onComplete={async (o) => {
      for (const [challengeId, r] of Object.entries(o.results)) await append({ type: 'challenge_attempted', lessonId: o.lessonId, challengeId, correct: r.correct, hints: r.hints, misses: r.misses, mastery: r.mastery, context: 'lesson' });
      await append({ type: 'lesson_completed', lessonId: o.lessonId, stars: o.stars, xp: o.xp, replay });
      nav('/path');
    }} />
  );
}
```

Create `src/lesson/index.ts`: `export * from './types'; export * from './loader'; export * from './LessonMachine'; export * from './answers'; export * from './stars';`

- [ ] **Step 5: Today screen and routes**

`src/screens/TodayScreen.tsx`:
```tsx
import { Link } from 'react-router';
import { useProgress } from '@/data';
import { activeLesson } from '@/path/progress';

export function TodayScreen() {
  const progress = useProgress((s) => s.progress);
  const next = activeLesson(progress);
  const coolDown = progress.consecutiveLosses >= 2;
  return (
    <section className="p-4">
      <h1 className="text-xl font-semibold">Today</h1>
      <p className="mt-1 text-sm text-ink-muted">{progress.xp} XP so far</p>
      <h2 className="mt-6 text-xs uppercase tracking-wide text-ink-muted">On the path</h2>
      {next ? <Link to={`/lesson/${next.id}`} className="tap mt-2 block rounded-xl border border-line bg-card p-4"><span className="block text-xs text-ink-muted">Lesson {next.id}</span><span className="block font-medium">{next.title}</span></Link>
            : <p className="mt-2 rounded-xl border border-line bg-card p-4">You have finished everything that is built so far. More lessons are coming.</p>}
      <h2 className="mt-6 text-xs uppercase tracking-wide text-ink-muted">Play</h2>
      {coolDown && <p className="mt-2 rounded-xl bg-review-soft p-3 text-sm">Two losses in a row. A lesson or a few minutes off usually helps more than a rematch.</p>}
      <Link to="/play" className="tap mt-2 block rounded-xl border border-line bg-card p-4 font-medium">Play a coached game</Link>
      <Link to="/settings" className="mt-6 block text-sm text-ink-muted underline">Settings</Link>
    </section>
  );
}
```

In `src/app/routes.tsx` add `<Route path="/path" element={<PathScreen />} />` and `<Route path="/lesson/:id" element={<LessonRoute />} />` (importing both), and in `App.tsx` call `useProgress.getState().load()` once in a `useEffect` before rendering routes (show "Loading…" until `loaded`).

- [ ] **Step 6: Manual check** — `npm run dev`; open `/path`; open lesson 1.1.1; complete it; the path shows it done and 1.1.2 active. Then run `npx vitest run && npm run lint && npm run typecheck`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(path): Section 1 path with active node, lesson route and Today"`

---

### Task 13: Checkpoints

**Spec reference:** spec 4.8. PRD 6.4 (checkpoint rules), F-PA-2, F-PA-5 (hints disabled).

**Files:**
- Create: `src/checkpoint/CheckpointMachine.ts`, `src/checkpoint/CheckpointMachine.test.ts`, `src/checkpoint/CheckpointRoute.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Failing tests**

`src/checkpoint/CheckpointMachine.test.ts`:
```ts
import { sampleChallenges, scoreAttempt, remediationSet, checkpointToLesson } from './CheckpointMachine';
import type { Challenge, CheckpointBank } from '@/lesson';

const mk = (i: number, concept: string): Challenge => ({ id: `q${i}`, type: 'which_square', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: 'p', concept, answer: { square: 'e4' } });
const bank: CheckpointBank = { unit: '9.9', title: 't', passMark: 0.75, sample: 10, bank: Array.from({ length: 30 }, (_, i) => mk(i, i % 3 === 0 ? 'a' : i % 3 === 1 ? 'b' : 'c')) };

test('samples the requested count without repeats and differs between attempts', () => {
  const a = sampleChallenges(bank, () => 0.1), b = sampleChallenges(bank, () => 0.9);
  expect(a).toHaveLength(10); expect(new Set(a.map((c) => c.id)).size).toBe(10);
  expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id));
});

test('scores by mastery-credit correctness and passes at 75 per cent', () => {
  const chosen = bank.bank.slice(0, 10);
  const results = Object.fromEntries(chosen.map((c, i) => [c.id, { correct: i < 8, hints: 0, misses: i < 8 ? 0 : 2, mastery: i < 8 }]));
  const s = scoreAttempt(chosen, results);
  expect(s).toEqual({ score: 0.8, passed: true, missedConcepts: ['c', 'a'] });
});

test('remediation set draws 5 to 8 from the missed concepts', () => {
  const set = remediationSet(bank, ['a'], () => 0.5);
  expect(set.length).toBeGreaterThanOrEqual(5); expect(set.length).toBeLessThanOrEqual(8);
  expect(set.every((c) => c.concept === 'a')).toBe(true);
});

test('checkpointToLesson wraps the sample as a hint-free lesson', () => {
  const l = checkpointToLesson(bank, bank.bank.slice(0, 10));
  expect(l.challenges).toHaveLength(10); expect(l.explain).toHaveLength(0); expect(l.xp).toBe(10);
});
```

- [ ] **Step 2: Implement**

`src/checkpoint/CheckpointMachine.ts`:
```ts
import type { Challenge, CheckpointBank, Lesson } from '@/lesson';
import type { ChallengeResult } from '@/lesson/LessonMachine';

function shuffle<T>(xs: T[], rng: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }

export function sampleChallenges(bank: CheckpointBank, rng: () => number = Math.random): Challenge[] { return shuffle(bank.bank, rng).slice(0, bank.sample); }

export function scoreAttempt(chosen: Challenge[], results: Record<string, ChallengeResult>): { score: number; passed: boolean; missedConcepts: string[] } {
  const correct = chosen.filter((c) => results[c.id]?.mastery).length;
  const score = correct / chosen.length;
  const missed = [...new Set(chosen.filter((c) => !results[c.id]?.mastery).map((c) => c.concept))];
  return { score, passed: score >= 0.75, missedConcepts: missed };
}

export function remediationSet(bank: CheckpointBank, concepts: string[], rng: () => number = Math.random): Challenge[] {
  const pool = shuffle(bank.bank.filter((c) => concepts.includes(c.concept)), rng);
  return pool.slice(0, Math.max(5, Math.min(8, pool.length)));
}

/** Checkpoints reuse the lesson player with hints disabled and no card/explain screens. */
export function checkpointToLesson(bank: CheckpointBank, chosen: Challenge[], remediation = false): Lesson {
  return { id: `${bank.unit}.cp`, unit: bank.unit, title: remediation ? `${bank.title} — practice` : bank.title, xp: 10, card: { idea: remediation ? 'Practice the ideas you missed, then retake the checkpoint.' : 'Ten mixed questions on positions you have not seen. No hints. Pass mark 75 per cent.', diagrams: [] }, explain: [], challenges: chosen, takeaway: remediation ? 'Now retake the checkpoint.' : 'Checkpoint complete.' };
}
```

- [ ] **Step 3: CheckpointRoute**

`src/checkpoint/CheckpointRoute.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { loadCheckpoint, type CheckpointBank, type Challenge } from '@/lesson';
import { LessonPlayer } from '@/lesson/LessonPlayer';
import { useProgress } from '@/data';
import { checkpointToLesson, remediationSet, sampleChallenges, scoreAttempt } from './CheckpointMachine';

type Stage = { kind: 'intro' } | { kind: 'test'; chosen: Challenge[] } | { kind: 'failed'; score: number; missed: string[] } | { kind: 'remediate'; set: Challenge[] } | { kind: 'passed'; score: number };

export function CheckpointRoute() {
  const { unit = '' } = useParams();
  const nav = useNavigate();
  const [bank, setBank] = useState<CheckpointBank | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const progress = useProgress((s) => s.progress);
  const append = useProgress((s) => s.append);
  const attempts = progress.units[unit]?.attempts ?? 0;
  useEffect(() => { loadCheckpoint(unit).then(setBank).catch(() => nav('/path')); }, [unit, nav]);
  const testLesson = useMemo(() => bank && stage.kind === 'test' ? checkpointToLesson(bank, stage.chosen) : null, [bank, stage]);
  const remLesson = useMemo(() => bank && stage.kind === 'remediate' ? checkpointToLesson(bank, stage.set, true) : null, [bank, stage]);
  if (!bank) return <section className="p-4 text-ink-muted">Loading…</section>;

  if (stage.kind === 'intro') return (
    <section className="p-4"><h1 className="text-xl font-semibold">{bank.title}</h1>
      <p className="mt-2">{bank.sample} mixed questions on positions you have not seen. No hints. Pass mark {Math.round(bank.passMark * 100)} per cent. Passing completes the unit, and you can attempt it now to test out.</p>
      {attempts >= 3 && <p className="mt-2 rounded-lg bg-review-soft p-3 text-sm">Three attempts so far. The coach recommends replaying this unit's lessons before the next try.</p>}
      <button type="button" className="tap mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white" onClick={() => setStage({ kind: 'test', chosen: sampleChallenges(bank) })}>Start the checkpoint</button>
      <button type="button" className="tap mt-2 w-full rounded-lg border border-line px-4 py-3" onClick={() => nav('/path')}>Back to the path</button></section>);

  if (stage.kind === 'test' && testLesson) return <LessonPlayer lesson={testLesson} hintsAllowed={false} title={bank.title} onExit={() => nav('/path')} onComplete={async (o) => {
    const s = scoreAttempt(stage.chosen, o.results);
    for (const [challengeId, r] of Object.entries(o.results)) await append({ type: 'challenge_attempted', lessonId: bank.unit, challengeId, correct: r.correct, hints: r.hints, misses: r.misses, mastery: r.mastery, context: 'checkpoint' });
    await append({ type: 'checkpoint_attempted', unit: bank.unit, score: s.score, passed: s.passed, attempt: attempts + 1, missedConcepts: s.missedConcepts });
    if (s.passed) { const anyUndone = Object.keys(progress.lessons).length === 0; if (anyUndone) await append({ type: 'unit_tested_out', unit: bank.unit }); setStage({ kind: 'passed', score: s.score }); }
    else setStage({ kind: 'failed', score: s.score, missed: s.missedConcepts });
  }} />;

  if (stage.kind === 'failed') return (
    <section className="p-4"><h1 className="text-xl font-semibold">Not yet</h1><p className="mt-2">You scored {Math.round(stage.score * 100)} per cent. Missed: {stage.missed.join(', ')}.</p>
      <button type="button" className="tap mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white" onClick={() => setStage({ kind: 'remediate', set: remediationSet(bank, stage.missed) })}>Practise the missed ideas</button></section>);

  if (stage.kind === 'remediate' && remLesson) return <LessonPlayer lesson={remLesson} title="Practice" onExit={() => nav('/path')} onComplete={() => setStage({ kind: 'intro' })} />;

  return (
    <section className="p-4"><h1 className="text-xl font-semibold">Checkpoint passed</h1><p className="mt-2">{Math.round((stage as { score: number }).score * 100)} per cent. Unit {bank.unit} complete. +50 XP.</p>
      <button type="button" className="tap mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white" onClick={() => nav('/path')}>Back to the path</button></section>);
}
```

Fix the `unit_tested_out` rule: it should fire when any lesson of that unit is not completed at pass time. Replace `anyUndone` with `const unitLessons = SECTION_1.units.find((u) => u.id === bank.unit)?.lessons ?? []; const anyUndone = unitLessons.some((l) => !progress.lessons[l.id]?.completed);` importing `SECTION_1` from `@/path/curriculum`.

Add `<Route path="/checkpoint/:unit" element={<CheckpointRoute />} />` to routes.

- [ ] **Step 4: Tests, lint, typecheck; commit** — `git add -A && git commit -m "feat(checkpoint): sampled hint-free checkpoints with remediation and test-out"`

---

### Task 14: Bot persona and error model

**Spec reference:** spec 4.6. PRD F-PL-1, F-PL-2, 10.7 (error model rules), F-CO-3.

**Files:**
- Create: `content/personas/rosa.json`, `src/bot/types.ts`, `src/bot/errorModel.ts`, `src/bot/errorModel.test.ts`, `src/bot/BotService.ts`, `src/bot/BotService.test.ts`, `src/bot/index.ts`

- [ ] **Step 1: Persona**

`content/personas/rosa.json`:
```json
{
  "id": "rosa", "name": "Rosa", "ratingBand": "about 600", "rating": 600,
  "bio": "Solid and patient. Trades when she can and hates leaving pieces loose, but she still does.",
  "style": { "capture": 1.2, "check": 1.0, "quiet": 1.0, "trade": 1.3 },
  "opening": { "white": ["e2e4", "g1f3", "f1c4"], "black": ["e7e5", "b8c6", "f8c5"] },
  "error": { "base": 0.28, "complexity": 0.05, "openingFactor": 0.9, "endgameFactor": 1.1, "kinds": ["hang", "missMate"] }
}
```

- [ ] **Step 2: Failing tests**

`src/bot/errorModel.test.ts`:
```ts
import { errorProbability, pickMove } from './errorModel';
import type { AnalysisLine } from '@/engine';
import rosa from '@content/personas/rosa.json';

const line = (move: string, cp: number): AnalysisLine => ({ move, pv: [move], score: { cp }, depth: 8 });

test('error probability rises with complexity and is bounded', () => {
  const quiet = errorProbability(rosa, { captures: 0, checks: 0, phase: 'middlegame' });
  const busy = errorProbability(rosa, { captures: 6, checks: 2, phase: 'middlegame' });
  expect(busy).toBeGreaterThan(quiet); expect(busy).toBeLessThanOrEqual(0.9); expect(quiet).toBeGreaterThan(0);
});

test('never errs when the only non-losing move is forced', () => {
  const lines = [line('e1e2', 0), line('e1d1', -9000)];
  expect(pickMove(rosa, lines, { captures: 0, checks: 1, phase: 'middlegame' }, () => 0.0, (m) => m === 'e1d1' ? 'hang' : null)).toBe('e1e2');
});

test('when erring, prefers a line whose refutation tagger can name', () => {
  const lines = [line('a', 50), line('b', -20), line('c', -150)];
  const choice = pickMove(rosa, lines, { captures: 3, checks: 0, phase: 'middlegame' }, () => 0.0, (m) => m === 'c' ? 'hang' : null);
  expect(choice).toBe('c');
});

test('when not erring, samples among near-best lines by style', () => {
  const lines = [line('a', 50), line('b', 45), line('c', -300)];
  const choice = pickMove(rosa, lines, { captures: 0, checks: 0, phase: 'middlegame' }, () => 0.99, () => null);
  expect(['a', 'b']).toContain(choice);
});
```

- [ ] **Step 3: Implement errorModel**

`src/bot/types.ts`:
```ts
export interface Persona { id: string; name: string; ratingBand: string; rating: number; bio: string; style: { capture: number; check: number; quiet: number; trade: number }; opening: { white: string[]; black: string[] }; error: { base: number; complexity: number; openingFactor: number; endgameFactor: number; kinds: string[] } }
export interface Complexity { captures: number; checks: number; phase: 'opening' | 'middlegame' | 'endgame' }
```

`src/bot/errorModel.ts`:
```ts
import type { AnalysisLine } from '@/engine';
import { scoreToWinPercent } from '@/engine';
import type { Complexity, Persona } from './types';

export function errorProbability(p: Persona, c: Complexity): number {
  const phase = c.phase === 'opening' ? p.error.openingFactor : c.phase === 'endgame' ? p.error.endgameFactor : 1;
  return Math.min(0.9, p.error.base * phase * (1 + p.error.complexity * (c.captures + 2 * c.checks)));
}

/** rng in [0,1). tag(move) names the refutation kind if the tagger can, else null. */
export function pickMove(p: Persona, lines: AnalysisLine[], c: Complexity, rng: () => number, tag: (move: string) => string | null): string {
  if (lines.length === 0) throw new Error('no lines');
  const best = lines[0]!;
  const bestWp = scoreToWinPercent(best.score);
  const drops = lines.map((l) => ({ l, drop: bestWp - scoreToWinPercent(l.score) }));
  const nearBest = drops.filter((d) => d.drop <= 5).map((d) => d.l);
  const errCandidates = drops.filter((d) => d.drop > 5 && d.drop < 60).map((d) => d.l); // never an instant loss (F-PL-2)
  const forced = nearBest.length === 1 && drops.filter((d) => d.drop < 60).length <= 1;
  if (!forced && errCandidates.length > 0 && rng() < errorProbability(p, c)) {
    const nameable = errCandidates.filter((l) => tag(l.move));
    const pool = nameable.length ? nameable : errCandidates;
    return pool[Math.floor(rng() * pool.length)]!.move;
  }
  // style-weighted sample among near-best lines: captures/checks are inferred by the caller via tag; here uniform with a bias to the first line
  const idx = Math.min(nearBest.length - 1, Math.floor(rng() * rng() * nearBest.length));
  return nearBest[idx]!.move;
}
```

- [ ] **Step 4: BotService with a test using a fake engine**

`src/bot/BotService.test.ts`:
```ts
import { BotService } from './BotService';
import { START_FEN } from '@/rules';
import rosa from '@content/personas/rosa.json';

test('plays the opening preference while it is legal', async () => {
  const engine = { analyse: vi.fn() };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  expect(await bot.chooseMove(START_FEN)).toBe('e2e4');
  expect(engine.analyse).not.toHaveBeenCalled();
});

test('asks the engine for multipv 6 at depth 8 otherwise', async () => {
  const engine = { analyse: vi.fn().mockResolvedValue({ depth: 8, lines: [{ move: 'g1f3', pv: ['g1f3'], score: { cp: 20 }, depth: 8 }] }) };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'; // 1.e4 e5: g1f3 is next in Rosa's book
  expect(await bot.chooseMove(fen)).toBe('g1f3');
  const fen2 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  await bot.chooseMove(fen2); // f1c4 still in book
  const fen3 = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  await bot.chooseMove(fen3); // out of book → engine
  expect(engine.analyse).toHaveBeenCalledWith({ fen: fen3, depth: 8, multiPv: 6 });
});
```

`src/bot/BotService.ts`:
```ts
import type { EngineClient } from '@/engine';
import { applyMove, legalMoves, piecesOf, turn, isCheck } from '@/rules';
import { hangingPieces, mateInOne } from '@/tagger';
import { pickMove } from './errorModel';
import type { Complexity, Persona } from './types';

export class BotService {
  constructor(readonly persona: Persona, private readonly engine: Pick<EngineClient, 'analyse'>, private readonly rng: () => number = Math.random) {}

  private bookMove(fen: string): string | null {
    const side = turn(fen);
    const book = side === 'w' ? this.persona.opening.white : this.persona.opening.black;
    const legal = new Set(legalMoves(fen).map((m) => m.uci));
    const fullmove = Number(fen.split(' ')[5] ?? 1);
    const idx = fullmove - 1;
    const mv = book[idx];
    return mv && legal.has(mv) ? mv : null;
  }

  private complexity(fen: string): Complexity {
    const legal = legalMoves(fen);
    const captures = legal.filter((m) => m.capture).length;
    const checks = legal.filter((m) => applyMove(fen, m.uci).check).length;
    const pieces = piecesOf(fen, 'w').length + piecesOf(fen, 'b').length;
    const fullmove = Number(fen.split(' ')[5] ?? 1);
    return { captures, checks, phase: fullmove <= 8 ? 'opening' : pieces <= 10 ? 'endgame' : 'middlegame' };
  }

  async chooseMove(fen: string): Promise<string> {
    const book = this.bookMove(fen);
    if (book) return book;
    const a = await this.engine.analyse({ fen, depth: 8, multiPv: 6 });
    const me = turn(fen);
    const tag = (uci: string): string | null => {
      const after = applyMove(fen, uci).fen;
      if (mateInOne(after)) return 'missMate';
      if (hangingPieces(after, me).length > 0) return 'hang';
      return null;
    };
    void isCheck;
    return pickMove(this.persona, a.lines, this.complexity(fen), this.rng, tag);
  }
}
```
(Drop the `void isCheck;` line and the `isCheck` import after the tests pass.)

`src/bot/index.ts`: `export * from './BotService'; export * from './errorModel'; export * from './types';`

- [ ] **Step 5: Tests, lint, typecheck, commit** — `git add -A && git commit -m "feat(bot): Rosa persona with rating-tuned error model over engine multipv"`

---

### Task 15: Coached play: GameMachine and Play screens

**Spec reference:** spec 4.9; wireframes 12 and 13; PRD F-PL-3 (coach comments once per move, hints two-stage, threats on request, take-backs), F-PL-4 (crowns), F-PL-5 (untimed and 10+0 in Phase 0; 15+10 deferred to Alpha), F-PL-8 (review offered, disabled here), F-ER-1.

**Files:**
- Create: `src/play/GameMachine.ts`, `src/play/GameMachine.test.ts`, `src/play/crowns.ts`, `src/play/PlayScreen.tsx`, `src/play/ChooseOpponent.tsx`, `src/play/useGame.ts`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Failing tests**

`src/play/GameMachine.test.ts`:
```ts
import { initGame, applyLearnerMove, applyBotMove, takeBack, useHint, coachEventFor, type GameState } from './GameMachine';
import { crowns } from './crowns';
import { START_FEN, applyMove } from '@/rules';

test('learner move then bot move alternate and record SAN', () => {
  let g = initGame({ learner: 'w', persona: 'rosa', timeControl: 'untimed', coach: true });
  g = applyLearnerMove(g, 'e2e4');
  expect(g.sans).toEqual(['e4']); expect(g.turn).toBe('b');
  g = applyBotMove(g, 'e7e5');
  expect(g.sans).toEqual(['e4', 'e5']); expect(g.turn).toBe('w');
});

test('take-back removes the last full move pair and counts it', () => {
  let g = initGame({ learner: 'w', persona: 'rosa', timeControl: 'untimed', coach: true });
  g = applyBotMove(applyLearnerMove(g, 'e2e4'), 'e7e5');
  g = takeBack(g);
  expect(g.fen).toBe(START_FEN); expect(g.takebacks).toBe(1); expect(g.sans).toEqual([]);
});

test('hints are two-stage and counted once per move', () => {
  let g = initGame({ learner: 'w', persona: 'rosa', timeControl: 'untimed', coach: true });
  g = useHint(g, { piece: 'e2', square: 'e4' });
  expect(g.hintLevel).toBe(1); expect(g.hints).toBe(1);
  g = useHint(g, { piece: 'e2', square: 'e4' });
  expect(g.hintLevel).toBe(2); expect(g.hints).toBe(1);
  g = applyLearnerMove(g, 'e2e4');
  expect(g.hintLevel).toBe(0);
});

test('crowns follow F-PL-4', () => {
  expect(crowns({ hints: 0, takebacks: 0 })).toBe(3);
  expect(crowns({ hints: 2, takebacks: 1 })).toBe(2);
  expect(crowns({ hints: 4, takebacks: 0 })).toBe(1);
});

test('coachEventFor: hanging a piece is reported, a free capture missed is reported, castling praised', () => {
  // After 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? (hangs f7 mate) — we test simpler: learner leaves a knight en prise
  const before = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const g: GameState = { ...initGame({ learner: 'w', persona: 'rosa', timeControl: 'untimed', coach: true }), fen: before, turn: 'w' };
  const after = applyMove(before, 'g1f3').fen; // Nf3 is safe: no comment
  expect(coachEventFor(g, 'g1f3', after)).toBeNull();
  const g2: GameState = { ...g, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 3' };
  const bad = applyMove(g2.fen, 'f3g5').fen; // Ng5 can be taken by the queen for free? d8xg5 — yes, hanging
  expect(coachEventFor(g2, 'f3g5', bad)).toMatchObject({ event: 'hang', facts: { pieceName: 'knight', square: 'g5' } });
});
```

- [ ] **Step 2: Implement crowns and GameMachine**

`src/play/crowns.ts`:
```ts
export function crowns(s: { hints: number; takebacks: number }): 1 | 2 | 3 { const n = s.hints + s.takebacks; return n === 0 ? 3 : n <= 3 ? 2 : 1; }
```

`src/play/GameMachine.ts`:
```ts
import { START_FEN, applyMove, gameStatus, turn, type Color, type Square } from '@/rules';
import { facts, hangingPieces, justCastled, winningCaptures } from '@/tagger';
import { CoachService } from '@/coach';

export interface GameState {
  id: string; learner: Color; persona: string; timeControl: 'untimed' | '10+0'; coach: boolean;
  fen: string; turn: Color; history: string[]; sans: string[]; hints: number; takebacks: number; hintLevel: 0 | 1 | 2;
  highlights: Partial<Record<Square, 'accent' | 'review' | 'danger' | 'selected'>>; arrows: { from: Square; to: Square; color?: 'accent' | 'review' | 'danger' }[];
  clockMs: { w: number; b: number } | null; over: ReturnType<typeof gameStatus>;
}

export function initGame(o: { learner: Color; persona: string; timeControl: 'untimed' | '10+0'; coach: boolean }): GameState {
  return { id: crypto.randomUUID(), ...o, fen: START_FEN, turn: 'w', history: [START_FEN], sans: [], hints: 0, takebacks: 0, hintLevel: 0, highlights: {}, arrows: [], clockMs: o.timeControl === '10+0' ? { w: 600_000, b: 600_000 } : null, over: { over: false } };
}

function push(g: GameState, uci: string): GameState {
  const r = applyMove(g.fen, uci);
  return { ...g, fen: r.fen, turn: turn(r.fen), history: [...g.history, r.fen], sans: [...g.sans, r.san], hintLevel: 0, highlights: {}, arrows: [], over: gameStatus(r.fen) };
}
export function applyLearnerMove(g: GameState, uci: string): GameState { return push(g, uci); }
export function applyBotMove(g: GameState, uci: string): GameState { return push(g, uci); }

export function takeBack(g: GameState): GameState {
  if (g.history.length < 3) return g;
  const history = g.history.slice(0, -2);
  return { ...g, fen: history[history.length - 1]!, turn: g.learner, history, sans: g.sans.slice(0, -2), takebacks: g.takebacks + 1, hintLevel: 0, highlights: {}, arrows: [], over: { over: false } };
}

export function useHint(g: GameState, hint: { piece: Square; square: Square }): GameState {
  if (g.hintLevel >= 2) return g;
  const level = (g.hintLevel + 1) as 1 | 2;
  return { ...g, hintLevel: level, hints: level === 1 ? g.hints + 1 : g.hints, highlights: level === 1 ? { [hint.piece]: 'accent' } : { [hint.piece]: 'selected', [hint.square]: 'accent' } };
}

export function showThreats(g: GameState): GameState {
  const f = facts(g.fen);
  const arrows = f.threats.captures.slice(0, 3).map((c) => ({ from: c.uci.slice(0, 2) as Square, to: c.uci.slice(2, 4) as Square, color: 'danger' as const }));
  return { ...g, arrows };
}

export interface CoachEvent { event: 'hang' | 'missedCapture' | 'goodCapture' | 'castled' | 'check' | 'threatIgnored' | 'mateAvailable'; facts: Record<string, string>; tone: 'good' | 'bad' | 'neutral' }

/** One event at most per learner move, in priority order (PRD F-PL-3). before = state before the move; after = FEN after it. */
export function coachEventFor(before: GameState, uci: string, after: string): CoachEvent | null {
  const me = before.learner;
  const r = applyMove(before.fen, uci);
  const hangNow = hangingPieces(after, me);
  const hangBefore = new Set(hangingPieces(before.fen, me).map((h) => h.square));
  const newHang = hangNow.find((h) => !hangBefore.has(h.square));
  if (newHang) return { event: 'hang', facts: { pieceName: CoachService.pieceName(newHang.piece), square: newHang.square }, tone: 'bad' };
  const free = winningCaptures(before.fen);
  if (free.length && !r.capture) { const t = free[0]!; const victim = applyMove(before.fen, t.uci); return { event: 'missedCapture', facts: { pieceName: CoachService.pieceName(victim.captured ?? 'p'), square: t.target }, tone: 'bad' }; }
  if (r.capture && free.some((c) => c.uci === r.uci)) return { event: 'goodCapture', facts: { pieceName: CoachService.pieceName(r.captured ?? 'p') }, tone: 'good' };
  if (justCastled(r.san)) return { event: 'castled', facts: {}, tone: 'good' };
  return null;
}

/** Before the learner moves: prompt if they are in check or have a mate. */
export function preMoveEvent(g: GameState): CoachEvent | null {
  const f = facts(g.fen);
  if (f.mateInOne) return { event: 'mateAvailable', facts: {}, tone: 'neutral' };
  if (f.inCheck) return { event: 'check', facts: {}, tone: 'neutral' };
  return null;
}

/** Hint squares for the learner: the best engine move, resolved by the caller; falls back to a free capture or any legal move. */
export function hintFromMove(uci: string): { piece: Square; square: Square } { return { piece: uci.slice(0, 2) as Square, square: uci.slice(2, 4) as Square }; }
```

- [ ] **Step 3: useGame hook and screens**

`src/play/useGame.ts`:
```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '@/engine';
import { BotService } from '@/bot';
import { CoachService } from '@/coach';
import { useSettings } from '@/app/settings';
import { useProgress } from '@/data';
import { applyBotMove, applyLearnerMove, coachEventFor, hintFromMove, initGame, preMoveEvent, showThreats, takeBack, useHint, type GameState } from './GameMachine';
import { crowns } from './crowns';
import rosa from '@content/personas/rosa.json';
import type { Persona } from '@/bot';

export function useGame(o: { learner: 'w' | 'b'; timeControl: 'untimed' | '10+0'; coach: boolean }) {
  const settings = useSettings();
  const append = useProgress((s) => s.append);
  const [g, setG] = useState<GameState>(() => initGame({ ...o, persona: 'rosa' }));
  const [coachText, setCoachText] = useState<string | null>(null);
  const [tone, setTone] = useState<'good' | 'bad' | 'neutral'>('neutral');
  const [thinking, setThinking] = useState(false);
  const [engineDown, setEngineDown] = useState(false);
  const coach = useMemo(() => { const c = new CoachService(); c.muted = settings.coachMuted || !o.coach; return c; }, [settings.coachMuted, o.coach]);
  const bot = useMemo(() => new BotService(rosa as Persona, getEngine()), []);
  const started = useRef(false);

  useEffect(() => { if (!started.current) { started.current = true; void append({ type: 'game_started', gameId: g.id, persona: 'rosa', color: g.learner, timeControl: g.timeControl, coach: o.coach }); } }, [append, g.id, g.learner, g.timeControl, o.coach]);

  const say = useCallback((ev: ReturnType<typeof coachEventFor>) => { if (!ev) return; try { const t = coach.line(ev.event, ev.facts); if (t) { setCoachText(t); setTone(ev.tone); } } catch { /* missing fact: stay silent rather than invent */ } }, [coach]);

  const botTurn = useCallback(async (state: GameState) => {
    if (state.over.over) return state;
    setThinking(true);
    try { const mv = await bot.chooseMove(state.fen); const next = applyBotMove(state, mv); setG(next); say(preMoveEvent(next)); return next; }
    catch { setEngineDown(true); return state; }
    finally { setThinking(false); }
  }, [bot, say]);

  useEffect(() => { if (g.learner === 'b' && g.history.length === 1) void botTurn(g); }, [g, botTurn]);

  const finish = useCallback(async (state: GameState) => {
    if (!state.over.over) return;
    const result = state.over.result === 'checkmate' ? (state.over.winner === state.learner ? 'win' : 'loss') : 'draw';
    say({ event: result === 'win' ? 'gameWon' : result === 'loss' ? 'gameLost' : 'gameDrawn', facts: {}, tone: 'neutral' } as never);
    await append({ type: 'game_finished', gameId: state.id, result, moves: Math.ceil(state.sans.length / 2), hints: state.hints, takebacks: state.takebacks, crowns: crowns(state), pgn: state.sans.join(' ') });
  }, [append, say]);

  const onLearnerMove = useCallback(async (uci: string) => {
    const before = g; const next = applyLearnerMove(before, uci);
    setG(next); say(coachEventFor(before, uci, next.fen));
    if (next.over.over) { await finish(next); return; }
    const after = await botTurn(next);
    if (after.over.over) await finish(after);
  }, [g, say, botTurn, finish]);

  const hint = useCallback(async () => {
    try { const mv = await getEngine().bestMove({ fen: g.fen, depth: 8 }); const h = hintFromMove(mv); setG((s) => useHint(s, h)); say({ event: g.hintLevel === 0 ? 'hintPiece' : 'hintSquare', facts: { pieceName: 'piece', square: g.hintLevel === 0 ? h.piece : h.square }, tone: 'neutral' } as never); }
    catch { setEngineDown(true); }
  }, [g.fen, g.hintLevel, say]);

  return { g, coachText, tone, thinking, engineDown, onLearnerMove, hint, threats: () => setG((s) => showThreats(s)), takeBack: () => setG((s) => takeBack(s)), retryEngine: () => { setEngineDown(false); void botTurn(g); } };
}
```

`src/play/ChooseOpponent.tsx` (wireframe 12): coach-mode toggle (default on), time control segmented control (Untimed, 10+0), colour choice (White, Black, Random), Rosa's card with band and bio, "Start game" button; navigates to `/play/game?tc=10+0&color=w&coach=1`.

`src/play/PlayScreen.tsx` (wireframe 13): reads the query, calls `useGame`, renders `Board` (mode play, disabled while thinking or over, `onDragStart` → `getEngine().pause()`, `onDragEnd` → `getEngine().resume()`), the move list, the coach bubble, and the four controls Hint, Threats, Take back, Resign (resign sets a `loss` via a `resign` helper that marks `over` and calls `finish`). On game end shows crowns, the result line, a disabled "Review this game — coming next release" button and "Play again" / "Back to the path". If `engineDown`, shows "The engine could not load on this device. Retry." with a retry button (F-ER-1). For 10+0, a simple `setInterval` clock decrementing the side to move; on zero, the game ends as a loss for that side.

Routes: `/play` → `ChooseOpponent`, `/play/game` → `PlayScreen`.

- [ ] **Step 4: Tests, lint, typecheck; manual game in the browser to a result; commit** — `git add -A && git commit -m "feat(play): coached game against Rosa with hints, threats, take-backs and crowns"`

---

### Task 16: Supabase schema, dry-run, auth, sync and merge

**Spec reference:** spec 4.10 (sync), 4.11 (schema, RLS, secrets). PRD F-AC-2 (magic link, merge rules), F-AC-3 (idempotent, device day), F-AC-6, 10.4, 11 Security (RLS on every table).

**Irreversible change:** the migration. Per superpowers-plan-extras Rule 1, Step 2 runs the whole change set plus behavioural assertions inside `BEGIN … ROLLBACK` against the linked project before Step 3 applies it.

**Files:**
- Create: `supabase/migrations/20260916_phase0_profiles_events.sql`, `supabase/dryrun/phase0.sql`, `src/sync/supabaseClient.ts`, `src/sync/AuthContext.tsx`, `src/sync/flush.ts`, `src/sync/merge.ts`, `src/sync/merge.test.ts`, `src/sync/flush.test.ts`, `src/screens/SettingsScreen.tsx` (replace)

- [ ] **Step 1: Migration**

```sql
-- supabase/migrations/20260916_phase0_profiles_events.sql
-- Phase 0: learner profiles and the append-only event log (PRD 10.4, F-AC-3).

-- ── 1. profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  settings jsonb not null default '{}'::jsonb
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: own row select" on public.profiles;
create policy "profiles: own row select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: own row update" on public.profiles;
create policy "profiles: own row update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── 2. events (append-only) ─────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  device_day date not null,
  created_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists events_user_created_idx on public.events (user_id, created_at);
alter table public.events enable row level security;
drop policy if exists "events: own rows select" on public.events;
create policy "events: own rows select" on public.events for select using (auth.uid() = user_id);
drop policy if exists "events: own rows insert" on public.events;
create policy "events: own rows insert" on public.events for insert with check (auth.uid() = user_id);
-- No update or delete policies: the log is append-only for clients. Account deletion cascades from auth.users.

-- ── 3. grants ───────────────────────────────────────────────────────────────
grant select, update on public.profiles to authenticated;
grant select, insert on public.events to authenticated;
revoke all on public.profiles from anon;
revoke all on public.events from anon;
```

- [ ] **Step 2: Dry-run with assertions, rolled back (Rule 1)**

`supabase/dryrun/phase0.sql`:
```sql
begin;
\i supabase/migrations/20260916_phase0_profiles_events.sql

-- two fake users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test','x',now(),now(),now()),
       ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test','x',now(),now(),now());

do $$ begin
  -- trigger created both profiles
  if (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')) <> 2 then raise exception 'profile trigger failed'; end if;

  -- act as user 1
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  insert into public.events (id, user_id, type, payload, device_day, created_at) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','lesson_completed','{}','2026-09-16',now());
  -- idempotent upsert on the same id must not duplicate
  insert into public.events (id, user_id, type, payload, device_day, created_at) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','lesson_completed','{}','2026-09-16',now()) on conflict (id) do nothing;
  if (select count(*) from public.events) <> 1 then raise exception 'duplicate event id was inserted'; end if;

  -- user 1 cannot insert for user 2
  begin
    insert into public.events (id, user_id, type, payload, device_day, created_at) values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','x','{}','2026-09-16',now());
    raise exception 'RLS allowed cross-user insert';
  exception when insufficient_privilege or check_violation then null; end;

  -- user 1 cannot update or delete events
  begin
    update public.events set type = 'tampered' where id = '10000000-0000-0000-0000-000000000001';
    if (select type from public.events where id = '10000000-0000-0000-0000-000000000001') = 'tampered' then raise exception 'RLS allowed update'; end if;
  exception when insufficient_privilege then null; end;
  delete from public.events where id = '10000000-0000-0000-0000-000000000001';
  if (select count(*) from public.events where id = '10000000-0000-0000-0000-000000000001') <> 1 then raise exception 'RLS allowed delete'; end if;

  -- user 2 sees none of user 1's rows
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  if (select count(*) from public.events) <> 0 then raise exception 'RLS leaked rows across users'; end if;
  raise notice 'DRY RUN OK';
end $$;
rollback;
```

Run against the linked project with the CLI's connection string:
```bash
set -a; source .env.secrets; set +a
psql "postgresql://postgres.$SUPABASE_PROJECT_REF:$SUPABASE_DB_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1 -f supabase/dryrun/phase0.sql
```
Expected: the final lines include `NOTICE:  DRY RUN OK` then `ROLLBACK`. Any `ERROR` means the migration or a policy is wrong; fix the migration and rerun before Step 3. (If the pooler host differs, take it from `supabase projects list` / the dashboard's connection string. `psql` is available via `brew install libpq` if missing.)

Note on RLS semantics under `set_config('role', ...)`: RLS applies to the `authenticated` role because the migration grants that role table access and the policies use `auth.uid()`, which reads `request.jwt.claims`. If `set_config('role', …)` does not switch the session role in this connection, replace it with `set local role authenticated;` inside the block.

- [ ] **Step 3: Apply**

```bash
supabase db push
```
Expected: the migration is listed and applied. Then in the dashboard (Authentication → URL Configuration) set Site URL to `https://thestormkingg.github.io/chessapp/` and add the same plus `http://localhost:5173/**` to Redirect URLs; enable Email provider with magic links (Confirm email off is acceptable for Phase 0). These are dashboard settings, not migrations; record them in `README.md` under "Supabase settings".

- [ ] **Step 4: Client, auth context, flush and merge with tests**

`src/sync/supabaseClient.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseEnabled = Boolean(url && key);
export const supabase = supabaseEnabled ? createClient(url, key) : null;
```

`src/sync/merge.test.ts`:
```ts
import { mergeEvents } from './merge';
import type { LearnerEvent } from '@/data';
const ev = (id: string, createdAt: string): LearnerEvent => ({ id, createdAt, deviceDay: '2026-09-16', payload: { type: 'lesson_started', lessonId: '1.1.1' }, synced: 1 });
test('merge unions by id and sorts by createdAt', () => {
  const local = [ev('a', '2026-09-16T10:00:00Z'), ev('b', '2026-09-16T11:00:00Z')];
  const remote = [ev('b', '2026-09-16T11:00:00Z'), ev('c', '2026-09-16T09:00:00Z')];
  expect(mergeEvents(local, remote).map((e) => e.id)).toEqual(['c', 'a', 'b']);
});
```

`src/sync/merge.ts`:
```ts
import type { LearnerEvent } from '@/data';
export function mergeEvents(local: LearnerEvent[], remote: LearnerEvent[]): LearnerEvent[] {
  const m = new Map<string, LearnerEvent>();
  for (const e of [...local, ...remote]) if (!m.has(e.id)) m.set(e.id, e);
  return [...m.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
```

`src/sync/flush.test.ts`:
```ts
import { db } from '@/data';
import { flush, pullAll } from './flush';
import type { LearnerEvent } from '@/data';

const ev = (id: string): LearnerEvent => ({ id, createdAt: new Date().toISOString(), deviceDay: '2026-09-16', payload: { type: 'lesson_started', lessonId: '1.1.1' }, synced: 0 });

beforeEach(() => db.events.clear());

test('flush upserts unsynced events in batches and marks them synced', async () => {
  await db.events.bulkAdd(Array.from({ length: 150 }, (_, i) => ev(`e${i}`)));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: () => ({ upsert }) };
  await flush(client as never, 'user-1');
  expect(upsert).toHaveBeenCalledTimes(2);
  expect(upsert.mock.calls[0]![0]).toHaveLength(100);
  expect(upsert.mock.calls[0]![0][0]).toMatchObject({ id: 'e0', user_id: 'user-1', type: 'lesson_started' });
  expect(await db.events.where('synced').equals(0).count()).toBe(0);
});

test('flush leaves events unsynced when the server errors', async () => {
  await db.events.add(ev('x'));
  const client = { from: () => ({ upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) }) };
  await expect(flush(client as never, 'u')).rejects.toThrow('boom');
  expect(await db.events.where('synced').equals(0).count()).toBe(1);
});

test('pullAll maps rows back to LearnerEvents', async () => {
  const rows = [{ id: 'r1', type: 'lesson_started', payload: { lessonId: '1.1.1' }, device_day: '2026-09-16', created_at: '2026-09-16T10:00:00Z' }];
  const client = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) };
  const out = await pullAll(client as never, 'u');
  expect(out[0]).toMatchObject({ id: 'r1', payload: { type: 'lesson_started', lessonId: '1.1.1' }, synced: 1 });
});
```

`src/sync/flush.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, type LearnerEvent } from '@/data';

interface Row { id: string; user_id?: string; type: string; payload: Record<string, unknown>; device_day: string; created_at: string }

function toRow(e: LearnerEvent, userId: string): Row { const { type, ...rest } = e.payload; return { id: e.id, user_id: userId, type, payload: rest, device_day: e.deviceDay, created_at: e.createdAt }; }
function fromRow(r: Row): LearnerEvent { return { id: r.id, deviceDay: r.device_day, createdAt: r.created_at, payload: { type: r.type, ...r.payload } as LearnerEvent['payload'], synced: 1 }; }

export async function flush(client: SupabaseClient, userId: string): Promise<number> {
  const pending = await db.events.where('synced').equals(0).sortBy('createdAt');
  let n = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const batch = pending.slice(i, i + 100);
    const { error } = await client.from('events').upsert(batch.map((e) => toRow(e, userId)), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    await db.events.bulkPut(batch.map((e) => ({ ...e, synced: 1 as const })));
    n += batch.length;
  }
  return n;
}

export async function pullAll(client: SupabaseClient, userId: string): Promise<LearnerEvent[]> {
  const { data, error } = await client.from('events').select('id,type,payload,device_day,created_at').eq('user_id', userId).order('created_at');
  if (error) throw new Error(error.message);
  return (data as Row[]).map(fromRow);
}
```

`src/sync/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseEnabled } from './supabaseClient';
import { db, onEventAppended, useProgress } from '@/data';
import { flush, pullAll } from './flush';
import { mergeEvents } from './merge';

interface Auth { session: Session | null; enabled: boolean; signIn: (email: string) => Promise<void>; signOut: () => Promise<void>; syncState: 'idle' | 'syncing' | 'error' }
const Ctx = createContext<Auth>({ session: null, enabled: false, signIn: async () => {}, signOut: async () => {}, syncState: 'idle' });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<Auth['syncState']>('idle');
  const rebuild = useProgress((s) => s.rebuild);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // On sign-in: upload guest events, pull the account's, merge, rebuild (F-AC-2). Then flush after each write and on reconnect (F-AC-3).
  useEffect(() => {
    if (!supabase || !session) return;
    const uid = session.user.id;
    const sync = async () => { setSyncState('syncing'); try { await flush(supabase, uid); const remote = await pullAll(supabase, uid); const local = await db.events.toArray(); const merged = mergeEvents(local, remote); await db.events.bulkPut(merged); await rebuild(); setSyncState('idle'); } catch { setSyncState('error'); } };
    void sync();
    const off = onEventAppended(() => { flush(supabase, uid).catch(() => setSyncState('error')); });
    const online = () => { void sync(); };
    window.addEventListener('online', online);
    return () => { off(); window.removeEventListener('online', online); };
  }, [session, rebuild]);

  const signIn = async (email: string) => { if (!supabase) return; const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } }); if (error) throw new Error(error.message); };
  const signOut = async () => { if (!supabase) return; await supabase.auth.signOut(); /* guest data stays on the device unless the learner clears it (F-AC-2) */ };
  return <Ctx.Provider value={{ session, enabled: supabaseEnabled, signIn, signOut, syncState }}>{children}</Ctx.Provider>;
}
```

Wrap `AppRoutes` in `AuthProvider` in `App.tsx`.

- [ ] **Step 5: Settings screen**

`src/screens/SettingsScreen.tsx`: toggles for "Text move entry" and "Mute the coach" (from `useSettings`, each appending a `settings_changed` event), an account section: if not signed in, an email field and "Send me a sign-in link" calling `signIn` with a confirmation line "Check your email for the link; your progress on this device will be kept and merged"; if signed in, the email, a sync status line ("Synced", "Syncing…", "Not synced, will retry when online"), and "Sign out". If `enabled` is false (no keys), show "Accounts are not configured in this build." Also a "Clear this device's data" button that asks for confirmation then runs `db.delete()` and reloads (self-service deletion of local data; account deletion is a later phase and says so in a note). A "Licences" link to `/licences`.

- [ ] **Step 6: Tests, lint, typecheck; manual sign-in test in the browser (dev server on 5173 is in the redirect list); commit** — `git add -A && git commit -m "feat(sync): Supabase profiles and events with RLS, magic-link auth, outbox flush and merge"`

---

### Task 17: PWA behaviours, engine download progress, Licences, analytics adapter

**Spec reference:** spec 4.13, 4.12 (Licences), section 1 item 14. PRD F-OF-1, F-OF-2, F-OF-5, F-ON-6 (install offer after the first lesson), 11 Licensing.

**Files:**
- Create: `src/pwa/UpdateNotice.tsx`, `src/pwa/EngineDownload.tsx`, `src/pwa/InstallPrompt.tsx`, `src/screens/LicencesScreen.tsx`, `src/analytics/track.ts`, `src/analytics/track.test.ts`
- Modify: `src/app/App.tsx`, `src/app/routes.tsx`, `src/path/LessonRoute.tsx` (install offer after first completion)

- [ ] **Step 1: UpdateNotice using vite-plugin-pwa's `useRegisterSW`**

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
export function UpdateNotice() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-accent px-4 py-2 text-sm text-white">
      <span>Update available. It will apply next time you open the app.</span>
      <button type="button" className="tap underline" onClick={() => updateServiceWorker(true)}>Apply now</button>
    </div>
  );
}
```
"Apply now" is only shown outside a lesson or game: `UpdateNotice` reads the route and hides the button on `/lesson/*`, `/checkpoint/*`, `/play/game` (F-OF-5).

- [ ] **Step 2: EngineDownload** — a component that, on first mount of the Play screen or a `play_it_out` challenge, fetches `${BASE_URL}engine/stockfish-19-lite-single.wasm` with `fetch` and reads the body with a `ReadableStream` reader to report progress (`content-length` is known; ~1.8 MB), rendering a progress bar; since the service worker caches `engine/*` cache-first, the second run is instant. On failure shows "Could not download the engine (1.8 MB). Check your connection and retry." (F-ER-1, F-ER-3).

- [ ] **Step 3: InstallPrompt** — listens for `beforeinstallprompt`, stores the event, and after the learner's first `lesson_completed` (Progress has exactly one lesson) shows a card "Install ChessApp: lessons work offline, and reminders arrive when they are ready" with Install (calls `prompt()`) and Not now; on iOS Safari (no `beforeinstallprompt`, `navigator.standalone === false`) shows the Share → Add to Home Screen instruction sheet instead. Dismissal is stored in `localStorage` and the card is shown at most once per week.

- [ ] **Step 4: Licences screen** — lists Stockfish 19 (GPL-3, link to `public/engine/SOURCE.txt` and LICENSE), chess.js (BSD-2), react-chessboard (MIT, includes its default piece set), Dexie (Apache-2), Workbox and vite-plugin-pwa (MIT), Supabase JS (MIT). Route `/licences`.

- [ ] **Step 5: Analytics adapter with a console sink**

`src/analytics/track.ts`:
```ts
export interface Sink { track(event: string, props?: Record<string, unknown>): void; error(e: unknown, context?: Record<string, unknown>): void }
const consoleSink: Sink = { track: (e, p) => { if (import.meta.env.DEV) console.debug('[track]', e, p); }, error: (e, c) => console.error('[error]', e, c) };
let sink: Sink = consoleSink;
export function setSink(s: Sink) { sink = s; }
export function track(event: string, props?: Record<string, unknown>) { sink.track(event, props); }
export function reportError(e: unknown, context?: Record<string, unknown>) { sink.error(e, context); }
```
Test: `setSink` with a spy, `track('x', {a: 1})` reaches it. Call `track` from the lesson route (`lesson_started`, `lesson_completed`), checkpoint route, play (`game_finished`), and `reportError` from the engine unavailable paths.

- [ ] **Step 6: Tests, lint, typecheck, build; check `dist/sw.js` precache list excludes `engine/`; commit** — `git add -A && git commit -m "feat(pwa): update notice, engine download progress, install offer, licences, analytics adapter"`

---

### Task 18: Content for Unit 1.1 (The board and the pieces)

**Spec reference:** PRD Appendix A unit 1.1 (eight lessons), 7.3 (lesson anatomy), 7.4 (challenge types), 9.2 (verification), 9.4 (readable by a 15-year-old with no chess vocabulary). Reviewer checks each lesson against Appendix A's lesson list and the anatomy rules, and runs `npm run verify:content`.

**Files:**
- Create: `content/section-1/unit-1.1/lesson-1.1.2.json` … `lesson-1.1.8.json`, `content/section-1/unit-1.1/checkpoint.json`, `content/section-1/unit-1.1/guidebook.md`, `scripts/gen-movement-challenges.mjs`

- [ ] **Step 1: Generator for piece-movement challenges (find_them_all with rules-computed answers)**

`scripts/gen-movement-challenges.mjs` prints JSON challenge objects for a given piece and a list of FENs: for each FEN it computes with chess.js the set of squares the piece on the given square can move to and emits `{ type: 'find_them_all', prompt: 'Tap every square the <piece> can move to.', answer: { squares } }`. Usage: `node scripts/gen-movement-challenges.mjs rook "8/8/8/3R4/8/8/8/8 w - - 0 1:d5"`. Authors paste the output into the lesson file, then add ids, concepts, hints and reasons by hand. Because `find_them_all` answers are computed by the same rules the app uses, the verifier only checks the squares are on the board.

- [ ] **Step 2: Author lessons 1.1.2 to 1.1.8**

Each lesson has: a `card.idea` in two or three sentences, one to three diagrams, one to two `explain` screens under 60 words with arrows showing the piece's movement, and six to eight challenges ramping from `find_them_all` (movement) to `which_square` (name the destination) to `find_the_move` (make the move that reaches a square or captures), with the last challenge open-ended. Concept tags: `rook-moves`, `bishop-moves`, `queen-moves`, `king-moves`, `knight-moves`, `pawn-moves`, `pawn-capture`, `promotion`, `en-passant`, `setup`.

Lesson content by id (the positions are simple, engine-verifiable single-solution when `find_the_move`):

| Lesson | Explain | Challenges (type: prompt → answer) |
|---|---|---|
| 1.1.2 The rook | Rook on d4 on an empty board: arrows along file and rank. "Rooks slide in straight lines, as far as they like, until something is in the way." | c1 find_them_all rook d4 empty board; c2 find_them_all rook a1 with own pawn a3 and enemy pawn e1 (`8/8/8/8/8/P7/8/R3p3 w - - 0 1`, rook a1: answer a2 and b1..e1 where e1 is a capture); c3 which_square "Tap where the rook must go to attack the black king on h8 along the 8th rank" (rook a1, king h8: a8); c4 find_the_move "Capture the pawn" (`4k3/8/8/8/8/8/8/R3p2K w - - 0 1` → Rxe1); c5 find_the_move "Move the rook to the 7th rank" (`4k3/8/8/8/8/8/8/R6K w - - 0 1` → Ra7 is one of several; make this `answer.moves: ['Ra7']` and a FEN where only Ra7 reaches rank 7: `4k3/8/8/8/8/8/R7/7K w - - 0 1`? — no, choose `4k3/8/8/8/8/8/8/R6K w - - 0 1` and prompt "Move the rook to a7" → Ra7); c6 find_the_move open-ended "Win the bishop" (`4k3/8/8/8/8/8/8/R2b3K w - - 0 1` → Rxd1). |
| 1.1.3 The bishop | Bishop on d4, arrows along both diagonals. "A bishop stays on its colour for the whole game." | Same ramp with bishops: movement on empty board; blocked by own pawn; which_square "tap a square this bishop can never reach" (a light-square bishop, tap any dark square — use `find_them_all` instead with answer = the four adjacent dark squares? Simpler: which_square "Tap the square where the bishop captures the pawn" ); find_the_move capture; find_the_move open "Win the rook" (`4k3/8/8/8/8/8/1B6/7K w - - 0 1` with a black rook on f6: `4k3/8/5r2/8/8/8/1B6/7K w - - 0 1` → Bxf6). |
| 1.1.4 The queen | Queen on d4, eight arrows. "The queen moves like a rook and a bishop together. Powerful, so keep her safe." | movement; blocked; which_square; find_the_move capture of the farther of two pieces (engine single-solution: queen takes rook not pawn); open "Win the most valuable piece". |
| 1.1.5 The king | King on e4, eight one-square arrows. "The king moves one square in any direction and can never step onto an attacked square." | find_them_all king moves empty board (8 squares); find_them_all king moves with an enemy rook cutting off a rank (`8/8/8/8/4K3/8/8/r7 w - - 0 1`: e4 king cannot go to e3? rook a1 attacks rank 1 only; use `8/8/8/8/4K3/8/r7/8 w - - 0 1` so rank 2 is off-limits → king moves: d3,e3,f3,d4,f4,d5,e5,f5 minus none on rank 2 — rank 3 unaffected; choose rook on a3: `8/8/8/8/4K3/r7/8/8 w - - 0 1` → d4? no: answer = d5,e5,f5,d4,f4 (d3,e3,f3 attacked)); is_it_safe "Ke3" in that position → No, reason "The rook on a3 attacks e3"; which_square; find_the_move "Step the king next to the pawn to protect it" (single solution by construction); open "Capture the unprotected pawn with the king" (`8/8/8/3p4/4K3/8/8/8 w - - 0 1` → Kxd5). |
| 1.1.6 The knight | Knight on d4, eight L-shaped arrows. "The knight jumps: two squares one way, one square sideways, over anything in between." | movement (8 squares); movement from a corner (2 squares); movement with pieces in the way (jumps); which_square "Tap the square the knight reaches in one jump to attack the king"; find_the_move capture; open "Fork? not yet — capture the free rook" (`4k3/8/8/2r5/8/3N4/8/7K w - - 0 1` → Nxc5). |
| 1.1.7 The pawn, promotion and en passant | Screen 1: pawn moves forward one, two from its start, captures diagonally. Screen 2: promotion on the last rank; en passant shown with arrows. | find_them_all pawn e2 moves (e3,e4); find_them_all pawn e4 with a black pawn on d5 and a white pawn on e5? (e4 blocked by nothing: e5; capture d5) → answer e5,d5; is_it_safe "e5" when a black pawn on d6 attacks e5 → No; find_the_move "Promote" (`8/4P3/8/8/8/8/8/k6K w - - 0 1` → e8=Q; the verifier accepts `e8=Q` as the single best); find_the_move en passant (`4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2` → exd6); open "Win a piece with a pawn" (pawn fork position where one capture wins a rook, engine single-solution). |
| 1.1.8 Setting up the board | One screen: the start position, "white on the right" light corner, queen on her colour. | which_square "Tap where the white queen starts" (d1); which_square "Tap where the black king starts" (e8); find_them_all "Tap all four squares where knights start" (b1,g1,b8,g8); name_the_pattern "Which corner square is light?" options ["a1", "h1", "e4"] → h1; find_them_all "Tap the squares of the white rooks" (a1,h1); which_square "Tap the black queen's starting square" (d8). |

Every `find_the_move` FEN above must be checked with `npm run verify:content`; where the engine reports the second-best move within 100 centipawns, change the position (add a black king far away, remove the alternative target) until it is single-solution, and record the final FEN in the file. Every `hints.piece` names the moving piece's square and `hints.square` the destination. Every challenge has a `reason` in one sentence in the coach's voice.

- [ ] **Step 3: Checkpoint bank for 1.1** — `checkpoint.json` with `passMark: 0.75`, `sample: 10`, and a `bank` of 32 challenges across all eight concepts (four per concept), unlabelled prompts ("Find the capture", "Tap every square this piece can reach", "Tap e6"), on positions that do not appear in the lessons. Use the generator for the movement items.

- [ ] **Step 4: Guidebook** — `guidebook.md`: one screen per PRD 7.1: the unit's idea in five sentences, the six piece movements in one line each, and the setup rule.

- [ ] **Step 5: Verify, play through every lesson in the browser, commit** — `npm run verify:content` → `… 9 files, N challenges OK` with N ≥ 80. Then `npm run dev` and complete 1.1.1 to 1.1.8 and the checkpoint. `git add content && git commit -m "content: Unit 1.1 lessons, checkpoint bank and guidebook"`.

---

### Task 19: Content for Unit 1.2 (Capturing and value)

**Spec reference:** PRD Appendix A unit 1.2 (five lessons, habit "take hanging pieces, never hang your own"), 7.3, 7.4, 9.2. Section 1 mini-games (pawn wars, queen against eight pawns, knight against pawns) as `play_it_out` challenges.

**Files:**
- Create: `content/section-1/unit-1.2/lesson-1.2.1.json` … `lesson-1.2.5.json`, `checkpoint.json`, `guidebook.md`

- [ ] **Step 1: Author the five lessons**

| Lesson | Explain | Challenges |
|---|---|---|
| 1.2.1 Attack, capture and defend | "A piece attacks a square it could move to. Capturing means moving onto an enemy piece and removing it. A piece is defended when a friend could recapture." Arrows from a rook to a pawn (attack) and from a knight to the same pawn (defend). | find_them_all "Tap every black piece the white rook attacks"; find_them_all "Tap every white piece that is defended"; is_it_safe "Rxe5" when the pawn is defended by a knight → No, "The knight on d7 would take back"; find_the_move "Capture the undefended pawn" (engine single-solution); find_the_move "Defend your knight" (single move that adds a defender, engine-verified); open "Take something for free". |
| 1.2.2 Piece values | "Pawn 1, knight 3, bishop 3, rook 5, queen 9. The king has no number because you can never lose him." Diagram with the pieces in a row. | name_the_pattern "Which is worth more?" options ["Rook", "Knight", "Bishop"] → Rook; name_the_pattern "Two rooks against a queen: who has more?" options ["Queen", "Two rooks", "Equal"] → Two rooks; is_it_safe "Bxf7" when the bishop is recaptured by the king → No, "You give a bishop (3) for a pawn (1)"; find_the_move "Take the more valuable piece" (queen can take a rook or a knight, both free → Qxrook, single solution by 200 cp); find_the_move "Trade your knight for the rook" (Nxrook where the knight is recaptured, still best); open "Win material". |
| 1.2.3 Take free pieces | Habit card: "Take hanging pieces." "A hanging piece is attacked and not defended. Before every move, look for one." | find_them_all "Tap every hanging black piece" (two hanging, one defended); find_the_move "Take the free piece" ×3 with different pieces doing the taking; play_it_out "Queen against eight pawns: capture all the pawns before one promotes" (`8/pppppppp/8/8/8/8/8/3QK3 w - - 0 1` with a black king on e8: `4k3/pppppppp/8/8/8/8/8/3QK3 w - - 0 1`, goal capture_all in 20, opponentDepth 4); open "Find the free piece" (only one of three attacked pieces is undefended). |
| 1.2.4 Do not leave pieces free | Habit card: "Never hang your own pieces." "After you choose a move, ask: can anything of mine be taken for free now?" | is_it_safe ×2 (one safe, one not, reasons name the attacker); find_them_all "Tap your pieces that are hanging right now"; find_the_move "Save your hanging bishop" (single safe square, engine-verified); find_the_move "Save the knight by moving it to a defended square"; play_it_out "Pawn wars: get a pawn to the other side first" (`4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1`, goal promote in 30, opponentDepth 4). |
| 1.2.5 Counting attackers and defenders | "On a contested square, count the attackers and the defenders. If attackers outnumber defenders, you can take. Start with the cheapest piece." Arrows numbered on a square. | find_them_all "Tap every white piece attacking e5"; find_them_all "Tap every black piece defending e5"; name_the_pattern "Attackers 2, defenders 1. Can you take?" options ["Yes", "No", "Only with the queen"] → Yes; find_the_move "Take with the right piece first" (capture with the pawn, not the queen; engine single-solution); is_it_safe "Qxe5" when it loses the queen to a recapture → No; play_it_out "Knight against pawns: stop every pawn" (`4k3/8/8/8/8/8/ppp5/3NK3 w - - 0 1`? choose a standard trainer position: white knight and king vs three connected black pawns on the 5th rank with the black king far, goal survive 20 moves without a promotion, opponentDepth 4 — `survive` fails only on being mated, so add a check in `goalMet` for enemy promotion: treat an enemy queen appearing as failure. Add that rule to `goalMet` for `survive` and a unit test.) |

- [ ] **Step 2: Checkpoint bank for 1.2** — 30 challenges across `attack-defend`, `values`, `take-free`, `dont-hang`, `counting`, six per concept, unlabelled prompts, none reused from lessons, mostly `find_the_move` and `is_it_safe` with engine-verified single solutions.

- [ ] **Step 3: Guidebook** — one screen with the habit rule and the counting method.

- [ ] **Step 4: Verify, play through, commit** — `npm run verify:content` clean; play 1.2.1 to 1.2.5 and pass the checkpoint in the browser. `git add content src/lesson && git commit -m "content: Unit 1.2 lessons, mini-games, checkpoint bank and guidebook"`.

---

### Task 20: End-to-end exit-flow tests, deploy, verification

**Spec reference:** spec section 7 (tests), PRD 14 Phase 0 exit test, F-AX-1. Reviewer runs the suite and opens the live URL; the reference is the PRD exit test, not this plan.

**Files:**
- Create: `tests/e2e/exit-flow.spec.ts`, `tests/e2e/text-mode.spec.ts`, `tests/e2e/play.spec.ts`
- Modify: `.github/workflows/deploy.yml` (add an e2e job that runs the Playwright specs against `vite preview` before deploy)

- [ ] **Step 1: exit-flow.spec.ts**

```ts
import { test, expect } from '@playwright/test';

test('a new learner completes lesson 1.1.1 and sees it done on the path', async ({ page }) => {
  await page.goto('/path');
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  // c1: tap e4 via the board's text entry (deterministic in CI)
  await page.getByRole('button', { name: /settings/i }).isVisible().catch(() => {});
  // enable text entry through Settings once, then return
  await page.goto('/settings');
  await page.getByLabel('Text move entry').check();
  await page.goto('/lesson/1.1.1');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  const answers = ['e4', 'a1', 'h8', 'd1 d2 d3 d4 d5 d6 d7 d8', 'a7 b7 c7 d7 e7 f7 g7 h7', 'c6'];
  for (const a of answers) {
    if (a.includes(' ')) { for (const sq of a.split(' ')) { await page.getByLabel('Type a move').fill(sq); await page.getByLabel('Type a move').press('Enter'); } await page.getByRole('button', { name: /Check/ }).click(); }
    else { await page.getByLabel('Type a move').fill(a); await page.getByLabel('Type a move').press('Enter'); }
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(page.getByText('Lesson done')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the path' }).click();
  await expect(page.getByRole('link', { name: /1\.1\.1 The board/ })).toContainText('3 stars');
  await expect(page.getByRole('link', { name: /1\.1\.2 The rook/ })).toContainText('Up next');
});

test('checkpoint 1.1 can be attempted early and shows a result', async ({ page }) => {
  await page.goto('/checkpoint/1.1');
  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await expect(page.getByText(/1 of 10/)).toBeVisible();
  await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);
});
```

Remove the stray `settings` `isVisible` line and the duplicated first walk-through; the test should enable text entry first, then run the lesson once. (Written twice above to make the intent explicit; ship the single clean version.)

- [ ] **Step 2: play.spec.ts** — start a coached untimed game as White, play `e4` by text entry, wait for the bot's reply (move list has two SANs), press Hint and expect a highlighted square (an element with the accent inset shadow), press Take back and expect the move list empty, press Resign, expect the crowns line and the disabled "Review this game" button. Engine runs in Chromium in CI; allow 60 s.

- [ ] **Step 3: text-mode.spec.ts** — with text entry on, the board `role=application` has an accessible name containing "Cursor on", and after `e4` the `role=status` contains "You played e4".

- [ ] **Step 4: CI e2e job** — in `deploy.yml` add, before `upload-pages-artifact`: `npx playwright install chromium --with-deps` and `npx playwright test tests/e2e` with `webServer` pointing at `npm run preview -- --port 5173 --base /` (set `SMOKE_URL` unset; add a `PREVIEW=1` env read in `playwright.config.ts` to use `npm run preview` instead of `npm run dev`). The build for preview must use `base: '/'`, so run `vite build --base=/ --outDir dist-e2e` first and preview that folder.

- [ ] **Step 5: Push, watch deploy and smoke, verify live** — `git push`; `gh run watch`; open `https://thestormkingg.github.io/chessapp/` in the Chrome MCP at a 390 px viewport, complete lesson 1.1.1, play a game to a result, read the console for errors (unfiltered, after a fresh load, per observation 0029). Install the PWA from Chrome's menu and confirm it launches standalone.

- [ ] **Step 6: Final commit** — `git add -A && git commit -m "test: end-to-end exit flow, text mode and play; e2e gate in CI" && git push`.

---

## Spec coverage map (superpowers-plan-extras Rule 3)

Spec section 1 items → tasks:

| Spec item | Task |
|---|---|
| 1. Repo, tooling, CI, Supabase project, secrets | 1, 2 |
| 2. Tokens, five-tab shell, rail, placeholders | 1, 12 |
| 3. Board with modes and non-visual mode | 5 |
| 4. Rules service | 3 |
| 5. Engine service (worker, queue, idle, pause) | 4, 15 (pause on drag) |
| 6. Content format, verifier, Units 1.1 and 1.2 | 8, 18, 19 |
| 7. Lesson player, eight types, hints, feedback, retry, stars, takeaway, XP | 9, 10 |
| 8. Checkpoints (75 per cent, remediation, test-out) | 13 |
| 9. Bot with coach mode, error model, hints, threats, take-backs, crowns | 14, 15 |
| 10. Guest mode, Dexie, event log, outbox | 11 |
| 11. Magic-link accounts, merge, flush | 16 |
| 12. Path screen | 12 |
| 13. PWA installability, update notice, engine caching | 1 (config), 17 |
| 14. Analytics adapter | 17 |
| 15. Tests (unit, content, e2e, smoke) | every task; 2 (smoke), 8 (verifier), 20 (e2e) |

Spec section 4 subsections: 4.1→3, 4.2→4, 4.3→5, 4.4→6, 4.5→7, 4.6→14, 4.7→8/9/10, 4.8→13, 4.9→15, 4.10→11/16, 4.11→2/16, 4.12→1/12/16/17, 4.13→1/17. Section 5 (data flow) → 12. Section 6 (errors) → 4, 10, 15, 16, 17. Section 7 (testing) → 20 and per task. Section 8 (conventions) → 2, 16.

PRD requirements touched by Phase 0, with disposition:

| PRD id | Disposition |
|---|---|
| F-ON-6 install offer | Task 17 |
| F-ON-1..5, 7, 8 | Deferred to the Alpha plan (onboarding and placement) |
| F-HM-1 current node, F-HM-6 cool-down | Task 12 (Today) |
| F-HM-2..5, 7 | Deferred to the Alpha plan (daily plan) |
| F-PA-1, 2, 4, 5, 6, 7 | Tasks 12, 13, 10, 9 |
| F-PA-3 review lessons, F-PA-8 library, F-PA-9 packs | Deferred to Alpha (scheduler, library, packs) |
| F-PZ-4 hint accounting | Task 9 (applied to lessons; puzzles deferred) |
| F-PZ-1..3, 5..9 | Deferred to Alpha (puzzles) |
| F-PL-1 ladder | Task 14 delivers one persona; the ladder is Alpha |
| F-PL-2, 3, 4, 5 (untimed and 10+0), 8 (offer shown, disabled), 9 (offline works once cached) | Tasks 14, 15, 17 |
| F-PL-5 15+10, F-PL-6, F-PL-7 habit score | Deferred to Alpha |
| F-RV-* | Deferred to Alpha and Beta (review) |
| F-PR-* | Deferred (drills tab); Section 1 mini-games appear inside lessons in Task 19 |
| F-PG-*, F-EN-*, F-IM-*, F-SW-*, F-TS-* | Deferred per spec section 1 |
| F-CO-1, 2, 4 | Task 7; F-CO-3 one persona in Task 14 |
| F-AC-1, 2, 3, 6 | Tasks 11, 16; F-AC-4 export/delete: local clear in Task 16, account deletion deferred to Beta with a note in Settings; F-AC-5 deferred |
| F-OF-1, 2, 5 | Tasks 1, 17; F-OF-3, 4, 6 deferred to Alpha (packs); F-OF-6 partially by the outbox in Task 11 |
| F-ER-1, 2 (n/a), 3 (engine download), 6 | Tasks 4, 10, 15, 17; F-ER-4, 5, 7 deferred |
| F-AX-1, 2, 3, 4 | Task 5, theme.css; F-AX-5 automated checks deferred to Alpha's accessibility pass (out of Phase 0 scope by spec section 1) |
| 10.2 stack | Tasks 1, 4; deviations approved 2026-09-16 (Vite/Pages not Next/Vercel; Workbox via vite-plugin-pwa not Serwist) |
| 10.6 formulas | Task 4 (`toWinPercent`, `moveAccuracy`) |
| 10.7 error model | Task 14 |
| 11 Licensing | Task 4 (notice files), 17 (screen) |
| 11 Security (RLS, no secrets in client) | Task 16, Task 2 |

## Pre-flight (superpowers-plan-extras)

1. **Irreversible change:** the migration in Task 16. Dry-run task is Task 16 Step 2, inside `BEGIN … ROLLBACK`, asserting with `raise exception` (six assertions) and ending with `DRY RUN OK`. Creating the GitHub repo and Supabase project (Task 2) are irreversible but were explicitly approved; the DB password is written to disk before the create command.
2. **Review references:** each task names its spec section and PRD ids; the spec-reviewer's reference is the spec and the PRD, and the plan states in its header that its own code may be wrong. Content tasks name Appendix A and the verifier as the reference.
3. **Spec coverage map:** above, enumerated over spec sections 1, 4, 5, 6, 7, 8 and every PRD F-id family. Items with no task are listed as deferred with a destination or out of scope with a reason. Count: 15 spec items, 13 subsections, 24 PRD rows, all mapped.
4. **Tests mutating shared state:** `src/data/store.test.ts` and `src/sync/flush.test.ts` both clear `db.events` in `beforeEach`; they share the fake IndexedDB singleton but each test re-establishes its own precondition, and the negative assertion in `flush leaves events unsynced` is preceded by an `add` so it cannot pass vacuously. Playwright specs run in separate browser contexts (fresh IndexedDB each), so the exit-flow spec's completion of lesson 1.1.1 cannot make the checkpoint spec's "no hint button" assertion vacuous.

## Observations applied from the log

- 0021: when the first e2e run or the first content-verifier run fails, attribute failures to the change versus pre-existing before fixing or relaxing; record anything left unfixed in the test file next to the assertion.
- 0026: a red Playwright run with `ERR_CONNECTION_REFUSED` means the server died; restart, do not triage.
- 0028: when checking a build artefact (for example that `engine/` is excluded from the precache), grep for a distinctive value, not source syntax.
- 0029: read console buffers unfiltered after a fresh load before treating an error as live; never `npm run build` against a running dev server sharing `dist`.
- 0033: this plan states which claims are unverified: the react-chessboard `arrows` and `onPieceDrop` field names (Task 5 Step 3), whether the stockfish script runs under `worker_threads` (Task 8 Step 6), the Supabase pooler host (Task 16 Step 2), and RLS behaviour under `set_config('role')`. Each names its check and its fallback.

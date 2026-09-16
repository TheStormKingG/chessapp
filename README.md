# ChessApp

A free, offline-capable path from zero to club-level chess. ChessApp is a mobile-first PWA built with Vite, React and Supabase: a daily lesson and puzzle routine, a structured learning path, a puzzle trainer, play against a built-in engine, and progress tracking, with everything you learn persisted locally and synced when you sign in.

## Run locally

```bash
npm install
# create .env.local with values from the Supabase project dashboard:
#   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key>
npm run dev
```

Checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

## Deploy

Push to `main`. The `Deploy to GitHub Pages` workflow lints, type-checks, tests, builds and publishes to https://thestormkingg.github.io/chessapp/; the `Smoke Tests` workflow then runs Playwright against the live URL.

## Docs

Product requirements: `docs/product/PRD-v1.1.md`. Phase 0 design and plan: `docs/superpowers/`.

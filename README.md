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

## Supabase settings

The schema lives in `supabase/migrations/` and is applied with `supabase db push`.
`supabase/dryrun/phase0.sql` rehearses the same migration inside `BEGIN … ROLLBACK`
with assertions on the RLS policies; run it before changing anything in the schema:

```bash
set -a; source .env.secrets; set +a
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
/opt/homebrew/opt/libpq/bin/psql -h aws-0-sa-east-1.pooler.supabase.com -p 5432 \
  -U "postgres.$SUPABASE_PROJECT_REF" -d postgres -v ON_ERROR_STOP=1 -f supabase/dryrun/phase0.sql
```

Two things are dashboard settings rather than migrations and **still have to be set by
hand** (the Management API refused the CLI's stored credential). In the ChessApp project
at <https://supabase.com/dashboard/project/wkmuvgmlgolvuezdtbvh>:

1. **Authentication → URL Configuration**
   - Site URL: `https://thestormkingg.github.io/chessapp/`
   - Redirect URLs: add `https://thestormkingg.github.io/chessapp/` and `http://localhost:5173/**`
2. **Authentication → Sign In / Providers → Email**
   - Enable the Email provider, and enable **Magic Link**.
   - "Confirm email" off is acceptable for Phase 0.

Until both are done, the magic link in Settings sends but the link will not return the
learner to the app. Client keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) live in the
gitignored `.env.local` and as GitHub repo secrets; no service key ever reaches the client.

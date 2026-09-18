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

### Auth configuration

Auth URLs and the email provider are **version-controlled in `supabase/config.toml`**,
not clicked in the dashboard. What is configured there:

- **Site URL** `https://thestormkingg.github.io/chessapp/` — where a magic link returns
  the learner. It must stay equal to the app's `emailRedirectTo`
  (`src/sync/supabaseClient.ts`: `window.location.origin + import.meta.env.BASE_URL`).
- **Redirect allow-list** `https://thestormkingg.github.io/chessapp/` (production) and
  `http://localhost:5173/**` (local dev, where `BASE_URL` is `/`).
- **Email provider / magic link** — magic-link sign-in (`signInWithOtp`) works because the
  project's email provider is enabled. "Confirm email" is left **on**, which magic links do
  not require; Phase 0 works either way.

To change any of it, edit `supabase/config.toml` and push:

```bash
supabase config push          # prints a remote-vs-local diff and asks before applying
```

**Read the diff every time.** `config push` sends the *whole* `[auth]` block, so any key
absent from the file is pushed at the CLI's own default and silently overwrites the
project. The file therefore restates several values it does not intend to change — they
are commented `# pin` (MFA TOTP enrolment, `max_frequency`, `otp_length`,
`enable_confirmations`). Add a pin for any new key that shows up in the diff unasked.
Never put a secret in the file; use `env(VAR_NAME)` interpolation if one is ever needed.

The allow-list can be verified without sending mail — GoTrue honours an allow-listed
`redirect_to` even for an invalid token, and falls back to the Site URL otherwise:

```bash
set -a; source .env.local; set +a
curl -s -o /dev/null -w '%{redirect_url}\n' \
  "$VITE_SUPABASE_URL/auth/v1/verify?token=invalid&type=magiclink&redirect_to=http://localhost:5173/" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

**Still manual:** nothing for auth. Email *templates* and SMTP remain dashboard-only (the
project uses Supabase's built-in mailer and its low sending limits), and the database
schema is migrations, not config.

Client keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) live in the gitignored
`.env.local` and as GitHub repo secrets; no service key ever reaches the client.

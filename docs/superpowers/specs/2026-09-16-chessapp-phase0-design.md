# ChessApp Phase 0 (Foundations) design

| | |
|---|---|
| Date | 16 September 2026 |
| Source documents | `docs/product/PRD-v1.1.md` (sections 7, 8.3, 8.5, 8.10, 8.11, 8.15, 10, 14 Phase 0), `docs/product/Concept-Note.md`, `docs/product/Wireframes-v1.1.png` |
| Decisions taken 2026-09-16 | Vite + React on GitHub Pages with Supabase (not Next.js on Vercel). First slice is Phase 0 Foundations. Repo `TheStormKingG/chessapp` (public), Supabase project "ChessApp" in the São Paulo region. |

## 1. What Phase 0 delivers

Phase 0 is the PRD's "Foundations" phase. Its exit test is the one in PRD section 14:

> A tester with no chess knowledge completes Section 1 on a mid-range Android phone and plays a legal game against the bot.

This build scopes "Section 1" to **Units 1.1 and 1.2** (13 lessons, two checkpoints) so that every subsystem exists end to end and the remaining four units of Section 1 become content work on a proven pipeline. Everything below is in scope; anything not listed is out of scope for this plan.

In scope:

1. Repo, tooling, CI deploy to GitHub Pages, Supabase project with migrations and CI secrets, following the preqal.org and MicroHabits conventions.
2. Design tokens and the app shell: five-tab bottom bar (Today, Path, Puzzles, Play, Progress), desktop rail, coach persona surface. Puzzles and Progress are placeholder screens in Phase 0.
3. Board component with one implementation and modes for lesson, play and drill; non-visual mode (text move entry, keyboard navigation, screen-reader readout).
4. Rules service over chess.js.
5. Engine service: Stockfish 19 lite single-threaded in a Web Worker, UCI over messages, request queue, idle termination, paused during drags.
6. Lesson content format (JSON), a Node verification pipeline that engine-checks every challenge, and the content for Units 1.1 and 1.2 including checkpoint banks.
7. Lesson player supporting all eight challenge types, two-stage hints with honest accounting, authored wrong-move feedback with engine refutation fallback, retry before reveal, stars, takeaway, XP.
8. Checkpoints on held-out banks, 75 per cent pass mark, remediation set, test-out.
9. One bot persona with coach mode: rating-tuned error model over engine multi-line output, coach comments generated from a template bank keyed on engine facts and a first-release "tagger-lite" (hanging piece, capture available, mate in one, check, castled), two-stage hints, threat arrows, take-backs, crowns.
10. Guest mode: all progress in IndexedDB via Dexie, append-only event log with an outbox.
11. Accounts: Supabase Auth by email magic link; sign-in merges guest events into the account and flushes the outbox to the `events` table. Google and Apple sign-in are configured in a later phase.
12. Path screen for Section 1 with one active node, tinted completed nodes, locked future nodes, early checkpoint attempt.
13. PWA installability: manifest, precached shell, runtime-cached engine, "update available" notice applied on next launch.
14. Analytics and error tracking behind a thin adapter, with a console sink in Phase 0 and a PostHog or Sentry sink added when keys exist.
15. Tests: unit tests for rules, engine protocol, tagger-lite, hint accounting, star rules, scheduler-free lesson state machine, event merge; Playwright end-to-end test for the exit flow; the content verifier runs in CI.

Out of scope for Phase 0 (later plans): Units 1.3 to 1.6 content, onboarding questions and placement, daily plan, streaks, quests, puzzles, game review and analysis, import, profile, tailored sessions, notifications, offline packs and the Downloads screen, Google and Apple sign-in, licences screen.

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite 8, React 19, TypeScript strict | `base` is `/chessapp/` in production (GitHub Pages sub-path, as MicroHabits does) until a domain is chosen. |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`, design tokens as CSS variables | Green accent, amber for review, per the wireframes. No neumorphism (that is preqal.org's brand, not this product's). |
| Routing | react-router 7 | SPA with the `404.html` redirect hack from preqal.org for deep links on Pages. |
| State | zustand for UI state; Dexie 4 (IndexedDB) for persisted learner data | No Redux. |
| Rules | chess.js 1.4 | Wrapped in `src/rules` so nothing else imports chess.js directly. |
| Board | react-chessboard 5.12 wrapped in `src/board/Board.tsx` | PRD open decision: if drag on a mid-range Android phone stutters, the wrapper's interface allows a custom board later. |
| Engine | `stockfish` 19.0.0 npm package, `stockfish-19-lite-single.js` + `.wasm` copied to `public/engine/` | GPL-3 engine shipped as a separate unmodified binary with licence text and source pointer in `public/engine/LICENSE` and `NOTICE`. |
| PWA | vite-plugin-pwa 1.3 (Workbox) | Precache shell, runtime cache `engine/*` with cache-first, `registerType: 'prompt'`. |
| Backend | Supabase (Postgres, Auth, RLS) via `@supabase/supabase-js` 2 | Project "ChessApp", org `xtoswuzwnquyvqihxjhs`, region São Paulo. |
| Tests | vitest 5, Playwright 1.63, `@testing-library/react` | |
| Lint | eslint 9 flat config with react-hooks, `--max-warnings 0` as in preqal.org | |
| CI | GitHub Actions: `deploy.yml` (lint, unit tests, content verify, build, deploy Pages) and `smoke.yml` (Playwright against the live URL after deploy) | Copied in shape from preqal.org and MicroHabits. |

## 3. Repository layout

```
chessapp/
├── .github/workflows/deploy.yml, smoke.yml
├── public/
│   ├── engine/            stockfish-19-lite-single.{js,wasm}, LICENSE, NOTICE
│   ├── pieces/            cburnett SVG set (BSD option) + attribution file
│   ├── sounds/            move.mp3, capture.mp3, check.mp3 (CC0)
│   └── 404.html
├── content/
│   ├── schema/lesson.schema.json
│   ├── section-1/unit-1.1/lesson-*.json, checkpoint.json, guidebook.md
│   ├── section-1/unit-1.2/...
│   ├── coach/templates.json
│   └── personas/rosa.json
├── scripts/
│   └── verify-content.mjs     Node + engine; fails CI on any bad challenge
├── src/
│   ├── app/               App.tsx, routes.tsx, shell (TabBar, Rail), theme.css
│   ├── rules/             Position, legal moves, SAN/UCI, FEN helpers (chess.js wrapper)
│   ├── engine/            engine.worker.ts, EngineClient.ts (UCI, queue, idle timeout)
│   ├── board/             Board.tsx, BoardMode types, arrows/highlights, TextMoveEntry.tsx, useBoardA11y.ts
│   ├── tagger/            tagger-lite: hangingPieces, captures, mateInOne, inCheck, castled
│   ├── coach/             templates loader, CoachService.ts (facts → line), CoachBubble.tsx
│   ├── bot/               persona types, BotService.ts (multi-PV sampling + error model)
│   ├── lesson/            content types, loader, LessonMachine.ts (state), challenge components (8), hints, stars, LessonPlayer.tsx
│   ├── checkpoint/        CheckpointMachine.ts, CheckpointPlayer.tsx
│   ├── play/              GameMachine.ts, PlayScreen.tsx, ChooseOpponent.tsx, GameEnd.tsx
│   ├── path/              PathScreen.tsx, progress selectors
│   ├── data/              db.ts (Dexie schema), events.ts (types + append), outbox.ts
│   ├── sync/              supabaseClient.ts, AuthContext.tsx, flush.ts, merge.ts
│   ├── analytics/         track.ts (adapter), sinks
│   └── screens/           Today, Puzzles (placeholder), Progress (placeholder), Settings, Licences
├── tests/                 Playwright specs (e2e/exit-flow.spec.ts, smoke.spec.ts)
├── supabase/
│   ├── config.toml
│   └── migrations/20260916_phase0_profiles_events.sql
├── docs/product/          PRD, concept note, wireframes
└── docs/superpowers/      specs and plans
```

Each `src/*` folder has one purpose, exports through an `index.ts`, and can be unit-tested without the DOM except `board`, `screens` and the player components.

## 4. Components

### 4.1 Rules (`src/rules`)

A thin functional wrapper: `fromFen`, `legalMoves(fen)`, `applyMove(fen, uci|san)`, `toSan`, `toUci`, `isCheck`, `isCheckmate`, `isStalemate`, `pieceAt`, `attackersOf(square, colour)`. Pure functions over FEN strings so state machines stay serialisable. chess.js is imported only here.

### 4.2 Engine (`src/engine`)

- `engine.worker.ts` loads `/engine/stockfish-19-lite-single.js` inside a dedicated Worker and forwards UCI text lines both ways.
- `EngineClient` exposes `analyse({fen, depth, multiPv}) → Promise<Analysis>` and `bestMove({fen, depth|movetime}) → Promise<string>`, serialises requests through a queue, sets `Hash 16`, `Threads 1`, `MultiPV` per request, terminates the worker after 60 seconds idle and relaunches on demand, and exposes `pause()` and `resume()` which the board calls around drags.
- `Analysis` is `{ lines: { moveUci, pv, cp|mate }[] , depth }`. A `toWinPercent(cp)` helper implements the PRD 10.6 formula for later phases and is unit-tested now.
- Failure: if the wasm fails to load or the worker dies, the client rejects pending promises with `EngineUnavailable`; callers fall back per PRD F-ER-1 (lessons use stored solutions, play shows a one-line retry).

### 4.3 Board (`src/board`)

One `Board` component used everywhere. Props: `fen`, `orientation`, `mode` (`lesson | play | drill | static`), `legalMovesFor` (a function from `rules`), `onMove`, `highlights`, `arrows`, `selectable` (for "find them all" and "which square" challenges), `disabled`. Wraps react-chessboard; drag and tap-tap both work; touch targets meet 44 px on a 390 px viewport (board is full width).

Non-visual mode (F-AX-1) is part of the board, not a separate screen: `TextMoveEntry` accepts SAN or UCI, `useBoardA11y` provides arrow-key square navigation with Enter to select and move, and an `aria-live` region reads the last move, the position on request, and any feedback the parent passes in. A setting toggles "Text move entry" globally; the toggle is reachable from every board screen as in the desktop wireframe.

### 4.4 Tagger-lite (`src/tagger`)

Pure functions over FEN: `hangingPieces(fen, colour)` (attacked and undefended, or attacked by a lower-value piece), `winningCaptures(fen)`, `mateInOne(fen)`, `justCastled(prevFen, move)`, `inCheck(fen)`. These feed the coach and the bot's error model. The full Lichess-style motif tagger is a later phase; the interface is designed so that a `tags(fen, move) → Tag[]` function can be added without changing consumers.

### 4.5 Coach (`src/coach`)

`CoachService.line(event) → string | null` maps a coach event (`hang`, `missedCapture`, `goodCapture`, `castled`, `check`, `threatIgnored`, `hintPiece`, `hintSquare`, `lessonIntro`, `correct`, `wrongAuthored`, `wrongEngine`, `takeaway`) plus facts (piece names, squares, move SAN) to a line from `content/coach/templates.json`. Each template is keyed on the event and the fact fields it uses, so the coach never states a fact the caller did not verify. At most one line per move in play; the coach can be muted. The persona name is a token ("Coach") until the open decision in PRD section 17 is taken.

### 4.6 Bot (`src/bot`)

A persona file (`content/personas/rosa.json`) holds rating (600 as the first persona, the one in the wireframes), style weights (capture, check, quiet), an opening preference (Italian as White, 1...e5 as Black) and error parameters. `BotService.chooseMove(fen)` requests MultiPV 6 at depth 8, converts lines to win per cent, computes an error probability from the persona's base rate scaled by position complexity (legal captures and checks) and phase, never errs when only one legal move keeps the game from immediate mate, and when it errs prefers a line whose refutation tagger-lite can name (hang a piece, miss mate in one). Style weights bias the sample. Bot ratings are labelled as a band ("about 600") pending calibration.

### 4.7 Lesson content and player (`content/`, `src/lesson`)

Lesson JSON (validated by `content/schema/lesson.schema.json`):

```json
{
  "id": "1.1.2", "unit": "1.1", "title": "The rook", "xp": 10,
  "card": { "idea": "...", "diagrams": ["fen", "..."], "habit": "..." },
  "explain": [ { "fen": "...", "text": "≤60 words", "arrows": [["a1","a8"]], "highlights": ["a1"] } ],
  "challenges": [
    { "id": "1.1.2-c1", "type": "find_them_all", "fen": "...", "prompt": "Tap every square the rook can reach.", "answer": { "squares": ["a2","a3"] }, "hints": { "piece": "a1" } },
    { "id": "1.1.2-c4", "type": "find_the_move", "fen": "...", "prompt": "...", "answer": { "moves": ["Ra8"] }, "wrong": { "Ra7": "One rank short. Keep going." }, "hints": { "piece": "a1", "square": "a8" }, "reason": "Rooks slide the whole file." }
  ],
  "takeaway": "..."
}
```

Challenge types and their `answer` shapes: `find_the_move` (moves[]), `find_the_sequence` (line[] with authored replies), `find_them_all` (squares[] or pieces[]), `is_it_safe` (yes|no plus reason index of three), `which_square` (square, optional time limit), `name_the_pattern` (option index of three), `play_it_out` (goal: `mate_in`, `promote`, `capture_all`, `hold`, with a move budget and engine-played opponent), `guess_the_move` (annotated move list; used only in a smoke test in Phase 0 since story games start in Section 2).

`LessonMachine` is a pure reducer: `card → explain[i] → challenge[j] (attempt, hint1, hint2, wrong→retry, reveal) → close`. Rules: first wrong move shows authored feedback if present, otherwise the engine's one-move refutation drawn as an arrow, then retry; the solution is revealed after a second miss or on request; hint one highlights the piece, hint two the square; stars are three for no hints and at most one miss, two for any hint or two misses, one for completion; a challenge answered after a hint earns progress credit but no mastery credit (F-PZ-4). Every attempt, hint and completion is appended as an event.

`LessonPlayer` renders the machine with the shared `Board`, the coach bubble and one primary action, matching wireframe screens 6 to 9.

### 4.8 Checkpoint (`src/checkpoint`)

Each unit's `checkpoint.json` holds a bank of at least 30 unlabelled challenges. An attempt samples 10 (fresh each attempt), disables hints, passes at 75 per cent, and on failure lists the missed concepts and assigns a remediation set of 5 to 8 challenges from the same bank tagged with those concepts; a retake unlocks once the set is done. After three failures the coach recommends replaying the unit. Any checkpoint can be attempted early; passing marks the unit and its lessons complete ("tested out").

### 4.9 Play (`src/play`)

`GameMachine` holds the game (FEN history, clocks for untimed or 10+0 in Phase 0, take-backs used, hints used, coach on or off). On the learner's move it asks tagger-lite for facts and the coach for one line; on the bot's move it calls `BotService`. Threat arrows on request show squares the bot attacks that hold undefended pieces. Crowns: three with no hints or take-backs, two with one to three, one with four or more. Game end writes a `game_finished` event and shows crowns with "Review" shown but disabled with a "coming soon" note, since review is a later phase.

### 4.10 Data and sync (`src/data`, `src/sync`)

Dexie tables: `events` (id uuid, type, payload, deviceDay, createdAt, synced), `lessonProgress`, `unitProgress`, `games`, `settings`, `outbox`. Every state change is an event; `lessonProgress` and `unitProgress` are projections rebuilt from events by a pure `reduce(events)` so the same code recomputes state after a merge.

Sync: `flush()` posts unsynced events to Supabase `events` in batches of 100 with upsert on the client-generated id (idempotent), on start, on reconnect and after each write. On sign-in, guest events are uploaded, then the account's events are fetched and merged by id, then projections are rebuilt (F-AC-2). Guest data stays on the device under the account.

### 4.11 Supabase

Migration `20260916_phase0_profiles_events.sql`:

- `profiles` (id references auth.users, created_at, display_name null, settings jsonb). Row created by a trigger on auth user creation.
- `events` (id uuid primary key, user_id references auth.users, type text, payload jsonb, device_day date, created_at timestamptz, received_at timestamptz default now()). Index on (user_id, created_at).
- RLS on both: users can select and insert their own rows; no update or delete on `events` (append-only). Deletion of an account is handled in a later phase by a function; Phase 0 relies on Supabase's cascade.
- Auth: email magic link enabled; site URL and redirect URL set to the Pages URL.

Secrets follow preqal.org: `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `.env.secrets` (gitignored) with the service key and DB password, and the two VITE values set as repo secrets with `gh secret set`.

### 4.12 Shell and screens (`src/app`, `src/screens`, `src/path`)

Five tabs at the bottom on phones, a rail on desktop (wireframe 21). Today in Phase 0 shows the current path node and a "Play" card. Path renders Section 1's six units with lessons and checkpoints for 1.1 and 1.2 active and 1.3 to 1.6 visible but locked with "content coming". Puzzles and Progress are labelled placeholders so the tab bar matches the wireframes. Settings holds text-move mode, coach mute, reduced motion (also read from the OS), sign-in and sign-out. Licences lists the engine notice.

### 4.13 PWA

Manifest with maskable icons, `display: standalone`, theme colour from the tokens. Workbox precaches the shell; `engine/*` and `pieces/*` are runtime-cached cache-first; the app shows "Update available" when a new service worker waits and applies it on the next launch, never mid-lesson. First-visit engine download shows a progress bar the first time play or a `play_it_out` challenge needs it (F-OF-2).

## 5. Data flow (one lesson)

1. Path → tap lesson → loader reads `content/section-1/unit-1.1/lesson-1.1.2.json` (bundled as a static import in Phase 0; packs come later).
2. `LessonMachine` starts; every transition appends an event to Dexie and the outbox.
3. Challenge attempt → `rules` validates legality → machine compares with `answer` → correct: coach reason line; wrong: authored feedback or `EngineClient.analyse` refutation.
4. Close → stars, XP, `lesson_completed` event → projections update → Path shows the next node active.
5. `flush()` runs after the write; signed-out learners keep everything local.

## 6. Error handling

Follows PRD 8.13 for the parts in scope: engine unavailable (F-ER-1), refused persistent storage (F-ER-6, a notice only), service worker update (F-OF-5), sync failure (events stay in the outbox; a small "not synced" indicator in Settings). Content loader errors surface a plain message with a retry and are reported to the analytics adapter.

## 7. Testing

- Unit (vitest): rules wrapper; UCI parsing and queue behaviour with a fake worker; `toWinPercent`; tagger-lite on hand-built FENs; coach template selection; bot error model (deterministic with a seeded RNG); `LessonMachine` transitions, hint accounting and stars; checkpoint sampling and pass rule; event reducer and merge idempotence.
- Content: `scripts/verify-content.mjs` validates schema, checks every `find_the_move` and `find_the_sequence` solution with the engine at depth 14 (best and second-best gap at least 100 centipawns or a mate), checks `find_them_all` answers against `rules`, and fails CI on any error.
- End to end (Playwright, mobile viewport 390×844): complete lesson 1.1.1 with a hint and a wrong move; pass checkpoint 1.1 with the test-out path; play a coached game to a result with one take-back and one hint; text-move mode completes one challenge by typing.
- Smoke (after deploy): live URL loads, tab bar present, engine worker initialises.

## 8. Conventions carried from preqal.org and MicroHabits

- Commit and push from the developer machine to `main`; CI deploys. No `--no-verify` needed here because no git-lfs hook exists in the new repo.
- Never run `npm run build` against a running dev server that shares an output folder.
- Migrations are dated SQL files under `supabase/migrations/`, applied with `supabase db push` against the linked project; never raw DDL through a UI.
- Brand artefacts (icons) are rendered once locally and committed, with a unit test asserting their existence and dimensions.
- Observation masking and the task-observer log apply to the build session, not to the product.

## 9. Open items deferred to later plans

Product name and domain; coach persona name and art; open-source decision (Phase 0 uses only permissive libraries plus the separately shipped GPL engine, so either answer remains possible); Google and Apple sign-in; Units 1.3 to 1.6; everything listed as out of scope in section 1.

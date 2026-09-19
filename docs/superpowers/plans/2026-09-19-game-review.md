# Game Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the disabled "Review this game" control into a working on-device game review — analysis, move labels, a summary, key moments with retry before reveal, verified-fact explanations, an error log and a fix-it drill — so that a played game can be reviewed offline and counted by the North Star.

**Architecture:** A new `src/review/` module. Pure functions (book lookup, labels, key-moment selection, error log, explanations) depend only on `src/review/types.ts`, the shipped `src/engine/winPercent.ts`, `src/rules` and `src/tagger`. One stateful `AnalysisService` drives the shared `EngineClient` at MultiPV 1 with a runtime-calibrated depth ladder, and a deeper MultiPV-2 second pass runs in the background for the ≤ 5 key moments. Three screens live behind one modal route `/play/review/:gameId` and reuse the shared `Board`, `CoachBubble` and `LessonPlayer`.

**Tech Stack:** TypeScript 5.8, React 19, Vite 8, Vitest 5, Playwright 1.63, Dexie 4, chess.js 1.4, stockfish-19-lite-single (WASM, single-threaded).

**Design spec (the authority for every requirement below):** `docs/superpowers/specs/2026-09-19-game-review-design.md`

**Base commit:** `481cd63` on `main`. Baseline: 343 Vitest tests, 221 Playwright tests, all green.

---

## How to read this plan

- **Every requirement traces through §A (the spec-coverage map).** A clause with
  no entry there is a plan defect — report it, do not quietly decide it.
- **Chunks have disjoint file sets** and the parallel groups can be worked by
  different agents at the same time without collisions. §B is the authority on
  which file belongs to which chunk. **Do not touch a file outside your chunk.**
- **Every review stage names an external reference** (§C). The reference is never
  this plan. This plan contains complete code, so "does the code match the plan?"
  is a tautology; the question that matters is "does the plan match the PRD?",
  and only a reviewer pointed at the PRD and the live code can ask it.
- Code blocks in this plan are **claims about the repo at the time of writing**.
  Where a claim is load-bearing, the step before it runs a probe with an expected
  output. If a probe disagrees with this plan, **the shipped code is the fact** —
  report the disagreement, do not silently correct either side.

---

## §A. Spec-coverage map

Every clause of PRD §8.6, plus the §10.6 / Appendix C / §2.2 / §6.1 clauses the
feature depends on. A clause maps to a **task**, a **deferral with a
destination**, or an **out-of-scope with a reason**.

| Clause | Requirement, abbreviated | Entry |
|---|---|---|
| F-RV-1 a | Every in-app game analysed on device at fixed depth ≈14 | Tasks 13, 27 |
| F-RV-1 b | Visible progress bar | Task 27 |
| F-RV-1 c | Under 60 s for a 40-move game | Tasks 12, 13, 31 |
| F-RV-1 d | Key moments re-analysed at higher depth | Tasks 23, 27 |
| F-RV-1 e | Imported games analysed the same way | **Out of scope** — import is F-RV-9; the `ReviewSource` seam (Task 11) is where it would attach. Reason: spec §2.2 |
| F-RV-1 f | Over 90 s → partial review shown, completes in background | Tasks 13, 23, 24 |
| F-RV-2 a | Labels Best/Excellent/Good/Book/Inaccuracy/Mistake/Miss/Blunder from win-% change | Tasks 9, 21 |
| F-RV-2 b | Lichess win-probability curve | Task 8 (imports the shipped `winPercent.ts`; Task 8 asserts no second implementation) |
| F-RV-2 c | Thresholds more generous at lower ratings | Tasks 8, 9 (all four bands) |
| F-RV-2 d | Great = an only move | Tasks 10, 23 (MultiPV-2 second pass) |
| F-RV-2 e | Brilliant = sound sacrifice, not already winning, rare | Tasks 10, 23 |
| F-RV-2 f | Own icons and colours | Task 22 (name + glyph + existing token; spec §5.4) |
| F-RV-2 g | Plain definitions one tap away | Task 24 |
| F-RV-3 a | Accuracy for each side | Tasks 21, 24 |
| F-RV-3 b | Opening name + move the game left book | Tasks 6, 7, 24 |
| F-RV-3 c | Move count by label | Tasks 21, 24 |
| F-RV-3 d | Phase in which the game turned | Tasks 15, 21, 24 |
| F-RV-4 a | Three to five key moments by swing | Task 16 |
| F-RV-4 b | At least one of each kind where present | Task 16 |
| F-RV-4 c | Position shown before the learner's move | Task 25 |
| F-RV-4 d | Retry before reveal | Task 25 |
| F-RV-4 e | "Show me" reveals | Task 25 |
| F-RV-5 a | 1–3 sentence explanation from verified facts | Tasks 18, 19 |
| F-RV-5 b | Linked to the lesson that teaches the idea | Tasks 17, 19, 25 |
| F-RV-5 c | Templated in the first release | Tasks 18, 19 |
| F-RV-5 d | LM phrasing later | **Deferred** → PRD §14 "First update (v1.1)". Reason: F-RV-5 defers it itself |
| F-RV-6 a | Every mistake and blunder written to the error log | Task 17 |
| F-RV-6 b | With theme | Task 17 (tagger subset; full §10.3 motif set deferred → its own plan, spec §7.3) |
| F-RV-6 c | With phase | Tasks 15, 17 |
| F-RV-6 d | With clock time | Task 17 — field present, `null` this release because `GameState.clockMs` is not persisted. **Deferred** → the F-PL clock-persistence plan |
| F-RV-6 e | With the lesson it maps to | Task 17 |
| F-RV-6 f | Typicality flag | Task 17 (curriculum substitute, spec §9.6). Human-like model **deferred** → PRD §14 later |
| F-RV-7 a | 3–5 puzzle drill built from the error log | Task 26 |
| F-RV-7 b | A single suggested next lesson | Tasks 26, 27 |
| F-RV-7 c | Completing the drill completes the plan's review item | Tasks 23, 26, 27 (banking, spec §8) |
| F-RV-7 d | "Similar positions" from a puzzle ladder, at growing intervals | **Deferred** → Phase 2 Beta puzzle plan. Reason: no puzzle ladder and no scheduler exist; spec §6.4 |
| F-RV-8 | Full move list, variations, top three lines | **Out of scope** — secondary and never default, unassigned in PRD §14, costs MultiPV 3 on demand (2.0 s/position measured). Destination: its own plan. Spec §2.2 |
| F-RV-9 | Import from chess.com / Lichess / PGN | **Out of scope** — Phase 2 Beta, delegated to PRD §8.14. Destination: the §8.14 plan. Spec §2.2 |
| F-RV-10 a | Review of in-app games works offline | Tasks 7, 30 |
| F-RV-10 b | Imports require a connection | **Out of scope** with F-RV-9 |
| §10.6 | Win-% and accuracy formulas | Tasks 8, 21 — the shipped `winPercent.ts` is used unmodified |
| §10.6 | Mate-related judgements follow Lichess rules | Task 9 |
| §10.6 | No code copied from the AGPL Lichess repo | Tasks 8, 9 — formulas implemented from the PRD text only; no Lichess source is consulted |
| App. C | Band-scaled threshold table | Tasks 8, 9 |
| App. C | Book = ≥5 % of games from that position | **Cannot be implemented from the cited source.** Substitute shipped (Task 6). Destination for the real rule: a Lichess-database frequency extract, its own plan. Reason: spec §9.2 |
| App. C | Mate handling | Task 9 |
| §2.2 | A game review counts as a learning action | Tasks 2, 3, 23, 27 |
| §2.2 | Playing without reviewing does not count | Tasks 2, 3 — the event exists and only a complete review appends it |
| §6.1 | Learn-apply-review-**fix** is one loop | Tasks 17, 26, 27 |
| §8.10 F-CO-4 | Coach never states what the engine has not verified | Tasks 19, 20 |
| §11 | App shell under 300 KB of JS compressed | Tasks 5, 30 (measured before and after) |
| §8.15 accessibility | Shared board, one live region, one tab stop, 44 px, 32 px root, second channel for colour | Tasks 22, 24, 25, 27, 30 |

---

## §B. Chunks and their file sets

**Parallelism:** Chunk 0 runs alone and must finish first — it creates the shared
vocabulary and the schema, and a chunk that produces a shared vocabulary is a
foundation, not a peer. Chunks A, B, C and D are then fully independent and can
be run by four agents at once. Chunk E needs all of A–D. Chunk F needs E.
Chunk G is last.

| Chunk | Tasks | Runs after | Files it may create or modify |
|---|---|---|---|
| **0 Foundation** | 1–5 | — | `src/review/types.ts`, `src/data/events.ts`, `src/data/reduce.ts`, `src/data/db.ts`, `src/data/reduce.test.ts`, `src/data/store.test.ts`, `src/data/dbMigration.test.ts`, `scripts/measure-shell-size.mjs` |
| **A Opening book** | 6–7 | 0 | `scripts/build-opening-book.mjs`, `public/data/openings.txt`, `src/review/openingBook.ts`, `src/review/openingBook.test.ts`, `package.json` (one script entry) |
| **B Labels** | 8–10 | 0 | `src/review/bands.ts`, `src/review/labels.ts`, `src/review/labels.test.ts`, `src/review/bands.test.ts` |
| **C Analysis** | 11–14 | 0 | `src/review/gameSource.ts`, `src/review/gameSource.test.ts`, `src/review/AnalysisService.ts`, `src/review/AnalysisService.test.ts`, `scripts/measure-review-depth.mjs` |
| **D Moments, errors, words** | 15–20 | 0 | `src/review/keyMoments.ts`, `src/review/keyMoments.test.ts`, `src/review/errorLog.ts`, `src/review/errorLog.test.ts`, `src/review/explain.ts`, `src/review/explain.test.ts`, `src/review/phase.ts`, `src/review/phase.test.ts`, `content/coach/templates.json` |
| **E Screens** | 21–27 | A, B, C, D | `src/review/buildReview.ts`, `src/review/LabelChip.tsx`, `src/review/useReview.ts`, `src/review/Summary.tsx`, `src/review/KeyMomentView.tsx`, `src/review/fixIt.ts`, `src/review/FixItDrill.tsx`, `src/review/ReviewScreen.tsx`, `src/review/index.ts`, and their `.test.ts`/`.test.tsx` files |
| **F Wiring** | 28–30 | E | `src/app/routes.tsx`, `src/app/routes.test.tsx`, `src/play/PlayScreen.tsx`, `tests/e2e/play.spec.ts`, `tests/audit-platform/play.spec.ts`, `tests/audit/review.spec.ts` |
| **G Verification** | 31–33 | F | `docs/superpowers/specs/2026-09-19-game-review-design.md` (Task 31 appends one measured subsection); otherwise reports only |

**Collision rules.**
- `content/coach/templates.json` is touched by **Chunk D only**.
- `package.json` is touched by **Chunk A only** (one `scripts` entry).
- `src/data/*` is touched by **Chunk 0 only**.
- Nothing outside Chunk F may edit `src/play/PlayScreen.tsx`, `src/app/routes.tsx`
  or any file under `tests/`.
- `src/review/index.ts` is created by **Chunk E only**, in Task 27. Until then,
  modules import each other by path (`./labels`, `./openingBook`), not through a
  barrel — a barrel written early is a file every chunk wants to edit.

---

## §C. Review references (Rule 2 — a review's reference must not be produced by the process under review)

This plan contains the complete code, so implementers transcribe rather than
design. Every review stage below is therefore pointed at an **external**
artefact. **The plan may itself be wrong, and it shares an author with the
review.** State that in every reviewer prompt.

| Chunk | The reviewer's reference | What to check against it |
|---|---|---|
| 0 | `src/data/events.ts`, `src/data/reduce.ts`, `src/data/store.ts` **as shipped at `481cd63`**, and PRD §2.2 | That the new event and projection match the existing append-only discipline and that the DAL definition is actually satisfied |
| A | `lichess-org/chess-openings` `a.tsv`–`e.tsv` on disk, and PRD Appendix C's Book row | That the generated file really contains the lines the TSVs contain, and that the shipped rule's deviation from Appendix C matches spec §9.2 and nothing more |
| B | **PRD §10.6 and Appendix C, read directly**, and the shipped `src/engine/winPercent.ts` | That every band column and every override matches the PRD table cell for cell, and that no formula has been restated |
| C | **PRD F-RV-1, read directly**, and the shipped `src/engine/EngineClient.ts` | That the budget, the wall and the background completion match F-RV-1's wording, and that the service uses the shared client's queue/pause correctly |
| D | **PRD F-RV-4, F-RV-5, F-RV-6 and F-CO-4, read directly**, and the shipped `src/coach/CoachService.ts` and `src/tagger/tagger.ts` | That each key-moment kind matches F-RV-4's wording, and that no explanation can be produced from a fact the engine or tagger did not supply |
| E | **`docs/product/Wireframes-v1.1.png` screens 14–16 and Concept-Note §7**, plus the shipped `src/board/Board.tsx`, `src/lesson/LessonPlayer.tsx` | That the screens carry what the wireframes show, and that the shared components are used rather than re-implemented |
| F | The two shipped specs `tests/e2e/play.spec.ts` and `tests/audit-platform/play.spec.ts` at `481cd63` | That exactly the two named assertions changed and nothing else in those files did |
| G | **PRD §8.6 in full, enumerated clause by clause**, against §A of this plan | That every clause has an entry and that the named task actually delivers it |

---

## §D. Irreversible changes (Rule 1)

There is exactly one: **the Dexie schema bump to `version(3)`**. A user's local
IndexedDB is upgraded in place on first load and there is no downgrade path.
Task 4 runs the bump **against a throwaway database and asserts the outcome
before the real `db.ts` is touched**. Its Step 3 is a gate: the seeded-v2 →
opened-v3 exercise must pass before Step 4 edits `src/data/db.ts` at all. It
asserts outcomes — row counts, a round-trip through the new table, a working
index — rather than printing a log for somebody to skim, and it covers the
fresh-device case as well as the upgrade case.

---

## §E. Shared-fixture risk (Rule 4)

Adding `reviews` and `gamesReviewed` to `Progress` changes that type's shape,
so the question is which existing assertions are shape-sensitive. **This was
checked, not assumed:**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "toEqual(emptyProgress())\|toMatchObject" src/data/*.test.ts
```

At `481cd63` that returns exactly one hit, `src/data/reduce.test.ts:64`:
`expect(start).toEqual(emptyProgress())`. It is an immutability check — both
sides are freshly built by `emptyProgress()`, so both gain the new fields
together and it keeps passing while still being able to fail if
`reduceProgress` ever mutated its argument. Every other assertion in
`reduce.test.ts` reads a single field (`p.xp`, `p.games`, `p.units['1.1']`).

**Conclusion: no existing assertion is weakened by the shape change.** Do not
"fix" any of them, and in particular do not convert anything to
`toMatchObject` — that would make it unable to fail on a future field.

The one real risk this chunk introduces is its own:

| Assertion | File | Why it is at risk, and what Task 3 does |
|---|---|---|
| "a second `game_reviewed` for the same `gameId` does not increment `reviews`" | `src/data/reduce.test.ts` (new) | This is a **negative assertion**: it passes equally well when the precondition has vanished — if `game_reviewed` stopped being handled at all, `reviews` would stay 0 and the test would go green for the wrong reason. Task 3 therefore has an explicit step that makes it fail on purpose (by deleting the `gamesReviewed` guard) and requires the failure to be observed before the guard is restored |
| `store.test.ts` round-trip through `append` | `src/data/store.test.ts` | Unaffected by the shape change; no edit needed. Leave the file alone unless Task 3 says otherwise |

---

## Chunk 0 — Foundation (must run alone, and first)

### Task 1: The review vocabulary

**Files:**
- Create: `src/review/types.ts`

- [ ] **Step 1: Probe the two APIs this file's types must agree with**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "export interface AnalysisLine\|export interface Analysis\b\|export interface AnalyseRequest" src/engine/EngineClient.ts && \
  grep -n "export type Score\|export interface InfoLine" src/engine/uci.ts && \
  grep -n "export type Color\|export type Square" src/rules/types.ts
```

Expected output — these exact declarations exist (line numbers may differ):

```
export interface AnalyseRequest { fen: string; depth: number; multiPv?: number }
export interface AnalysisLine { move: string; pv: string[]; score: Score; depth: number }
export interface Analysis { lines: AnalysisLine[]; depth: number }
export type Score = { cp: number } | { mate: number };
export type Color = 'w' | 'b';
export type Square = ...
```

If any differs, **stop and report** — every type below depends on it.

- [ ] **Step 2: Write the file**

```ts
import type { Color } from '@/rules';

/**
 * The review vocabulary. Every other file in src/review/ speaks it and none of
 * them redefine any of it.
 *
 * Design spec: docs/superpowers/specs/2026-09-19-game-review-design.md §4.4.
 */

/** PRD F-RV-2 and Appendix C. `Great` and `Brilliant` are key-moment-only. */
export type MoveLabel =
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Miss'
  | 'Blunder';

/** The four PRD sections, used as the Appendix C threshold bands. */
export type Band = 1 | 2 | 3 | 4;

export type Phase = 'opening' | 'middlegame' | 'endgame';

/**
 * What the analysis path consumes. An in-app game builds one of these by
 * joining `game_started` and `game_finished` on `gameId` (see gameSource.ts);
 * import (F-RV-9, out of scope) would build one from a PGN and change nothing
 * downstream. This is the seam.
 */
export interface ReviewSource {
  gameId: string;
  learner: Color;
  persona: string;
  sans: string[];
  result: 'win' | 'loss' | 'draw';
  timeControl: 'untimed' | '10+0';
  startedAt: string;
}

/** One position's first-pass result: MultiPV 1, one search. */
export interface AnalysedPosition {
  /** Index into `[startFen, ...fensAfterEachPly]`; 0 is the start position. */
  index: number;
  fen: string;
  /** Win per cent for the side to move at `fen`, i.e. the value with best play. */
  win: number;
  bestUci: string;
  pv: string[];
  depth: number;
}

/** A move, judged. */
export interface ReviewedMove {
  /** 0-based index into `ReviewSource.sans`. */
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  mover: Color;
  best: { uci: string; san: string };
  /** Win per cent for the mover at `fenBefore`, i.e. with best play. */
  winBefore: number;
  /** Win per cent for the mover after the move actually played. */
  winAfterPlayed: number;
  /** max(0, winBefore - winAfterPlayed). */
  drop: number;
  /** PRD 10.6 per-move accuracy from `drop`. */
  accuracy: number;
  label: MoveLabel;
  book: boolean;
  phase: Phase;
}

export type MomentKind = 'decided' | 'missed' | 'found' | 'swing';

/** PRD F-RV-4. */
export interface KeyMoment {
  ply: number;
  kind: MomentKind;
  /** Filled by the deeper second pass; null until it lands (PRD F-RV-1). */
  deeper: DeeperMoment | null;
  /** One to three sentences, built only from verified facts. Null when a fact was missing. */
  explanation: string | null;
  /** The lesson that teaches the idea, if the theme maps to one. */
  lessonId: string | null;
}

/** The MultiPV-2 second pass for one key moment. */
export interface DeeperMoment {
  depth: number;
  /** Win per cent for the mover, best line. */
  bestWin: number;
  /** Win per cent for the mover, second-best line. Null when only one legal move. */
  secondWin: number | null;
  bestUci: string;
  secondUci: string | null;
}

/** PRD F-RV-6. */
export interface ErrorEntry {
  gameId: string;
  ply: number;
  fenBefore: string;
  playedSan: string;
  bestSan: string;
  bestUci: string;
  label: 'Mistake' | 'Blunder' | 'Miss';
  theme: string;
  phase: Phase;
  /** null for untimed games, and for 10+0 until the clock is persisted (spec §7.3). */
  clockMs: number | null;
  lessonId: string | null;
  /** "the Section the learner is in teaches exactly this theme" (spec §9.6). */
  typical: boolean;
  createdAt: string;
}

/** PRD F-RV-3. The whole reviewed game, cached in Dexie and rebuildable. */
export interface Review {
  gameId: string;
  learner: Color;
  /** The depth the first pass actually ran at, after the ladder (spec §4.2). */
  depth: number;
  /** True while the 90-second wall has cut the pass short (PRD F-RV-1). */
  partial: boolean;
  moves: ReviewedMove[];
  /** null for a side with no non-book moves; renders as "—", never as 100. */
  accuracy: { w: number | null; b: number | null };
  counts: Partial<Record<MoveLabel, number>>;
  opening: { name: string; leftBookAtPly: number | null } | null;
  turningPhase: Phase | null;
  keyMoments: KeyMoment[];
  errors: ErrorEntry[];
  createdAt: string;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run typecheck`
Expected: exits 0, no output.

- [ ] **Step 4: Lint**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run lint`
Expected: exits 0, no output. (`--max-warnings 0` is in the script: a warning is a failure. This is why every non-component export lives in a `.ts` file and never a `.tsx` — `react-refresh/only-export-components` is configured as a warning and would therefore fail the build.)

- [ ] **Step 5: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/types.ts && \
git commit -m "feat(review): the review vocabulary"
```

---

### Task 2: The `game_reviewed` event

**Files:**
- Modify: `src/data/events.ts` (the `EventPayload` union)

- [ ] **Step 1: Probe the union as shipped**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n "/export type EventPayload/,/^  | { type: 'settings_changed'/p" src/data/events.ts
```

Expected: the union ends with the `game_finished` member and then
`| { type: 'settings_changed'; key: string; value: string | boolean | number };`.

- [ ] **Step 2: Add the member immediately after `game_finished`**

Insert this into the union, between the `game_finished` member and the
`settings_changed` member:

```ts
  /**
   * PRD 2.2: a game review is a learning action; playing without reviewing is
   * not. Appended exactly once per game, and only when the review is complete
   * — `partial: false` is a literal so the type cannot express a banked partial
   * review (design spec §8).
   */
  | {
      type: 'game_reviewed';
      gameId: string;
      accuracy: number;
      blunders: number;
      mistakes: number;
      drillCompleted: boolean;
      partial: false;
    }
```

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Confirm nothing else exhaustively switches on the union**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -rn "x.type\|payload.type" src/ --include=*.ts --include=*.tsx
```

Expected: hits only in `src/data/reduce.ts` (which has a `default: break;`, so
it compiles) and `src/sync/merge.ts` if present. Any hit in a `switch` **without**
a `default` is a compile error you will already have seen in Step 3; if Step 3
passed and this grep shows one, report it rather than editing outside this chunk.

- [ ] **Step 5: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/data/events.ts && \
git commit -m "feat(data): a game_reviewed event, so a review can count (PRD 2.2)"
```

---

### Task 3: Project reviews, and prove the guard can fail

**Files:**
- Modify: `src/data/reduce.ts`
- Modify: `src/data/reduce.test.ts` (append two tests)

- [ ] **Step 1: Write the failing tests**

Append to `src/data/reduce.test.ts`:

```ts
test('a completed review counts once and is attributed to its game', () => {
  const r = newEvent({
    type: 'game_reviewed',
    gameId: 'g1',
    accuracy: 72.5,
    blunders: 2,
    mistakes: 3,
    drillCompleted: true,
    partial: false,
  });
  const p = reduceProgress(emptyProgress(), [r]);
  expect(p.reviews).toBe(1);
  expect(p.gamesReviewed['g1']).toBe(true);
});

test('a second review of the same game does not count again', () => {
  const mk = () =>
    newEvent({
      type: 'game_reviewed',
      gameId: 'g1',
      accuracy: 72.5,
      blunders: 2,
      mistakes: 3,
      drillCompleted: true,
      partial: false,
    });
  // Two events with DIFFERENT ids — the existing `seen` de-duplication cannot
  // catch this, so the gameId guard is what is under test.
  const p = reduceProgress(emptyProgress(), [mk(), mk()]);
  expect(p.reviews).toBe(1);
});

test('two different games both count', () => {
  const mk = (gameId: string) =>
    newEvent({
      type: 'game_reviewed',
      gameId,
      accuracy: 50,
      blunders: 0,
      mistakes: 0,
      drillCompleted: false,
      partial: false,
    });
  const p = reduceProgress(emptyProgress(), [mk('g1'), mk('g2')]);
  expect(p.reviews).toBe(2);
});
```

The third test is the **lower bound** on the guard. Without it, a guard that
counted nothing at all would satisfy the second test perfectly: "exactly once"
is satisfied by "never" unless something separately proves the count can rise.

- [ ] **Step 2: Run them and watch them fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/data/reduce.test.ts`
Expected: 3 failures. The first two fail on `TS`/runtime `undefined` for
`p.reviews`; all three name the new test titles. If any of the three **passes**,
stop — the projection already does something and this plan is wrong about the
baseline.

- [ ] **Step 3: Add the fields to `Progress` and `emptyProgress`**

In `src/data/reduce.ts`, add to the `Progress` interface immediately after
`games: number;`:

```ts
  /** PRD 2.2: completed game reviews. A review is a learning action; play alone is not. */
  reviews: number;
  /** The games already counted, so a second visit to the review route cannot double-count. */
  gamesReviewed: Record<string, true>;
```

and to the object returned by `emptyProgress()`, immediately after `games: 0,`:

```ts
    reviews: 0,
    gamesReviewed: {},
```

- [ ] **Step 4: Add the case**

In `reduceProgress`'s `switch`, immediately after the `game_finished` case:

```ts
      case 'game_reviewed': {
        // The `seen` set above de-duplicates by event id. This guard is the
        // different question: the same game reviewed twice, by two events with
        // two ids. Both are needed.
        if (!p.gamesReviewed[x.gameId]) {
          p.gamesReviewed[x.gameId] = true;
          p.reviews += 1;
          // PRD F-EN-2: XP is never deducted, and a review is worth more than a
          // game, because the research says review is the efficient half.
          p.xp += 20;
        }
        break;
      }
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/data/reduce.test.ts`
Expected: all tests in the file pass, including the pre-existing ones. In
particular `reduceProgress does not mutate its argument` (the
`expect(start).toEqual(emptyProgress())` assertion) must still pass — both sides
gained the same fields.

- [ ] **Step 6: Prove the negative assertion can fail**

A test that has only ever been observed passing has not been tested. Temporarily
break the guard by changing

```ts
        if (!p.gamesReviewed[x.gameId]) {
```

to

```ts
        if (true) {
```

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/data/reduce.test.ts`
Expected: **`a second review of the same game does not count again` fails** with
`expected 2 to be 1`, and the other two new tests still pass. If it does **not**
fail, the test is vacuous and must be rewritten before proceeding.

Now restore the line to `if (!p.gamesReviewed[x.gameId]) {` and re-run:
Expected: all pass again.

- [ ] **Step 7: Run the whole unit suite**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm test`
Expected: `346 passed` (343 baseline + 3 new), 0 failed. If the failure count is
non-zero **and** the failing files are outside `src/data/`, that is evidence
about the tree rather than about this change — check `git status` before
debugging your own diff.

- [ ] **Step 8: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/data/reduce.ts src/data/reduce.test.ts && \
git commit -m "feat(data): project completed reviews, once per game"
```

---

### Task 4: The v3 schema — dry run first (§D, irreversible)

**Files:**
- Create: `src/data/dbMigration.test.ts`
- Modify: `src/data/db.ts`

The Dexie upgrade rewrites a real user's IndexedDB in place and there is no
downgrade. This task runs the whole change against a throwaway database and
**asserts outcomes** before the bump is committed.

- [ ] **Step 1: Confirm `fake-indexeddb` is wired into the test environment**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  cat src/test/setup.ts && grep -n "setupFiles\|environment" vite.config.ts
```

Expected: the setup file imports `fake-indexeddb/auto` (or equivalent) and the
Vitest environment is `jsdom`. If it does not, **stop and report** — the dry run
below cannot be trusted in a real-IndexedDB environment.

- [ ] **Step 2: Write the dry-run test**

Create `src/data/dbMigration.test.ts`:

```ts
import Dexie from 'dexie';
import { newEvent } from './events';

/**
 * §D of the plan: the v3 bump is the one irreversible change in this feature.
 * This exercises it against a throwaway database and asserts the outcome; it
 * does not print a log for somebody to skim.
 */

const NAME = 'chessapp-migration-probe';

async function seedV2() {
  const old = new Dexie(NAME);
  old.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
  old.version(2).stores({ resume: 'lessonId' });
  await old.open();
  await old.table('events').bulkAdd([
    newEvent({ type: 'lesson_started', lessonId: '1.1.1' }),
    newEvent({ type: 'game_finished', gameId: 'g1', result: 'win', moves: 30, hints: 0, takebacks: 0, crowns: 3, pgn: 'e4 e5' }),
  ]);
  await old.table('games').add({
    id: 'g1', pgn: 'e4 e5', fen: 'x', persona: 'rosa', color: 'w',
    startedAt: '2026-09-19T00:00:00.000Z', finishedAt: null, result: null,
  });
  await old.table('resume').add({
    lessonId: '1.1.1', challengeId: 'c1', index: 0, challengeCount: 5,
    results: {}, totalHints: 0, totalMisses: 0, savedAt: '2026-09-19T00:00:00.000Z',
  });
  old.close();
}

function openV3() {
  const next = new Dexie(NAME);
  next.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
  next.version(2).stores({ resume: 'lessonId' });
  next.version(3).stores({ reviews: 'gameId, createdAt' });
  return next;
}

test('the v3 upgrade keeps every v2 row and adds a usable reviews table', async () => {
  await Dexie.delete(NAME);
  await seedV2();

  const next = openV3();
  await next.open();

  // Nothing was lost.
  expect(await next.table('events').count()).toBe(2);
  expect(await next.table('games').count()).toBe(1);
  expect(await next.table('resume').count()).toBe(1);
  expect((await next.table('resume').get('1.1.1'))?.challengeId).toBe('c1');

  // The new table exists and round-trips.
  await next.table('reviews').put({ gameId: 'g1', createdAt: '2026-09-19T00:00:00.000Z', partial: false });
  expect((await next.table('reviews').get('g1'))?.partial).toBe(false);

  // And it is indexed on createdAt, which the summary list will order by.
  expect(await next.table('reviews').orderBy('createdAt').count()).toBe(1);

  next.close();
  await Dexie.delete(NAME);
});

test('opening v3 on a fresh device works with no v2 data at all', async () => {
  await Dexie.delete(NAME);
  const next = openV3();
  await next.open();
  expect(await next.table('reviews').count()).toBe(0);
  expect(await next.table('events').count()).toBe(0);
  next.close();
  await Dexie.delete(NAME);
});
```

- [ ] **Step 3: Run the dry run**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/data/dbMigration.test.ts`
Expected: `2 passed`. This is the gate. **Do not proceed to Step 4 until both
pass.**

- [ ] **Step 4: Apply the bump to the real database**

In `src/data/db.ts`, add above the `ChessDb` class:

```ts
import type { Review } from '@/review/types';
```

add to the class body, after the `resume!` declaration:

```ts
  /**
   * Cached reviews, keyed on gameId (PRD F-RV-3). This is derived data: the
   * append-only event log stays the source of truth for progress, and a review
   * can always be rebuilt by re-analysing the game. Losing this table costs
   * engine time, never progress.
   */
  reviews!: EntityTable<Review, 'gameId'>;
```

and add the version line after the `version(2)` line:

```ts
    this.version(3).stores({ reviews: 'gameId, createdAt' });
```

- [ ] **Step 5: Typecheck, lint and run the suite**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test
```

Expected: typecheck and lint silent; `348 passed` (346 + 2).

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/data/db.ts src/data/dbMigration.test.ts && \
git commit -m "feat(data): a reviews table at schema v3, with the upgrade proven first"
```

---

### Task 5: A measured shell-size guard

**Files:**
- Create: `scripts/measure-shell-size.mjs`

PRD §11 budgets "App shell under 300 KB of JavaScript compressed". The opening
book (Chunk A) is a static data asset, not app-shell JavaScript, and the spec
(§9.1) records that the budget does not cover bundled data. This task turns that
claim into a number so nobody has to argue about it later.

- [ ] **Step 1: Write the script**

Create `scripts/measure-shell-size.mjs`:

```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

/**
 * PRD 11: "App shell under 300 KB of JavaScript compressed."
 *
 * Measures the gzipped bytes of every .js emitted into dist/assets — the app
 * shell. Static data under dist/data and the engine under dist/engine are
 * reported separately and are NOT counted against the budget: neither is
 * JavaScript and neither is on the critical path of first load.
 */

const BUDGET = 300 * 1024;
const dist = 'dist';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(dist);
const shell = files.filter((f) => f.startsWith(join(dist, 'assets')) && f.endsWith('.js'));
const data = files.filter((f) => f.startsWith(join(dist, 'data')));
const engine = files.filter((f) => f.startsWith(join(dist, 'engine')));

const gz = (fs) => fs.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
const raw = (fs) => fs.reduce((n, f) => n + statSync(f).size, 0);

const shellGz = gz(shell);
console.log(
  JSON.stringify(
    {
      shellJsFiles: shell.length,
      shellGzBytes: shellGz,
      shellGzKiB: +(shellGz / 1024).toFixed(1),
      budgetKiB: BUDGET / 1024,
      withinBudget: shellGz <= BUDGET,
      dataRawKiB: +(raw(data) / 1024).toFixed(1),
      dataGzKiB: +(gz(data) / 1024).toFixed(1),
      engineRawKiB: +(raw(engine) / 1024).toFixed(1),
    },
    null,
    1,
  ),
);
if (shellGz > BUDGET) {
  console.error(`SHELL OVER BUDGET: ${shellGz} > ${BUDGET}`);
  process.exit(1);
}
```

- [ ] **Step 2: Record the baseline, before any review code ships in the bundle**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run build >/dev/null && node scripts/measure-shell-size.mjs
```

Expected: JSON with `"withinBudget": true` and `shellGzKiB` around 235.
**Write the exact `shellGzKiB` value into the commit message.** It is the
before-figure that Task 29 compares against; a before-figure nobody recorded is
not a comparison.

- [ ] **Step 3: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add scripts/measure-shell-size.mjs && \
git commit -m "chore: measure the PRD 11 shell budget, excluding data and engine

Baseline before review: <paste shellGzKiB here> KiB gzipped."
```

**Chunk 0 ends here. Chunks A, B, C and D may now start in parallel.**

---

## Chunk A — Opening book (parallel with B, C, D)

### Task 6: Build the book from the CC0 source

**Files:**
- Create: `scripts/build-opening-book.mjs`
- Create: `public/data/openings.txt` (generated by the script)
- Modify: `package.json` (one `scripts` entry)

**Measured facts this task reproduces** (the script below was run against the
real source before this plan was written): 3,810 source rows → **3,704 lines,
3,088 names, 106 rows dropped for exceeding 20 plies, 0 failing to replay**,
**306,484 bytes** on disk = 299.3 KiB raw, 47.4 KiB gzip, **39.6 KiB brotli**.

- [ ] **Step 1: Fetch the source**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
mkdir -p .cache/chess-openings && \
for f in a b c d e; do \
  curl -sS -f -o ".cache/chess-openings/$f.tsv" \
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv"; \
done && wc -l .cache/chess-openings/*.tsv
```

Expected, approximately (the upstream repo grows slowly; the counts below were
current on 19 September 2026):

```
     818 .cache/chess-openings/a.tsv
     773 .cache/chess-openings/b.tsv
    1251 .cache/chess-openings/c.tsv
     615 .cache/chess-openings/d.tsv
     358 .cache/chess-openings/e.tsv
    3815 total
```

Add `.cache/` to `.gitignore` if it is not already ignored — the TSVs are build
input, not repo content.

- [ ] **Step 2: Write the build script**

Create `scripts/build-opening-book.mjs`:

```js
/**
 * Builds the bundled opening book from lichess-org/chess-openings (CC0).
 *
 * PRD 9.1 and Appendix D name that repository as the source of opening names,
 * and F-RV-3 wants "the opening name with the move at which the game left the
 * bundled opening book". Appendix C's Book rule also asks for a 5-per-cent
 * frequency threshold, which this source does not carry at all — see the design
 * spec, section 9.2, for the substitute that ships and where the real rule goes.
 *
 * Output: public/data/openings.txt
 *
 *   line 1                 `v1 <lineCount> <maxPly>`
 *   lines 2..lineCount+1   `<uci><uci>...<uci>\t<nameIndex>`, sorted by the path
 *   one line               `@@`
 *   remaining lines        opening names, one per line, indexed from 0
 *
 * UCI moves are fixed width (4 characters, 5 with a promotion, which cannot
 * occur inside 20 plies of a named opening), so a path is a plain string prefix
 * and "is this position in the book" is a binary search for a prefix. Sorted
 * text with heavy shared prefixes compresses about 7.5x, which is why this beats
 * a position-hash table over the wire even though it is larger on disk.
 *
 * Usage:
 *   node scripts/build-opening-book.mjs <dir-with-a.tsv..e.tsv>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';

const MAX_PLY = 20; // Appendix C: "within the first ten moves".
const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/build-opening-book.mjs <dir-with-tsvs>');
  process.exit(2);
}

const rows = [];
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const text = readFileSync(join(src, `${f}.tsv`), 'utf8');
  const lines = text.split('\n');
  if (lines[0] !== 'eco\tname\tpgn') {
    console.error(`unexpected header in ${f}.tsv: ${JSON.stringify(lines[0])}`);
    process.exit(1);
  }
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    rows.push({ eco, name, pgn });
  }
}
if (rows.length < 3000) {
  console.error(`only ${rows.length} rows parsed; the source looks wrong`);
  process.exit(1);
}

const names = [];
const nameIdx = new Map();
const paths = new Map();
let skippedTooDeep = 0;
let skippedIllegal = 0;

for (const r of rows) {
  const sans = r.pgn.split(/\s+/).filter((t) => t && !/^\d+\.$/.test(t));
  if (sans.length > MAX_PLY) {
    skippedTooDeep += 1;
    continue;
  }
  const g = new Chess();
  const ucis = [];
  let ok = true;
  for (const san of sans) {
    let m;
    try {
      m = g.move(san);
    } catch {
      ok = false;
      break;
    }
    ucis.push(m.from + m.to + (m.promotion || ''));
  }
  if (!ok) {
    skippedIllegal += 1;
    continue;
  }
  let ni = nameIdx.get(r.name);
  if (ni === undefined) {
    ni = names.length;
    names.push(r.name);
    nameIdx.set(r.name, ni);
  }
  const path = ucis.join('');
  if (!paths.has(path)) paths.set(path, ni);
}

if (skippedIllegal > 0) {
  console.error(`${skippedIllegal} lines did not replay legally; refusing to ship a partial book`);
  process.exit(1);
}
for (const n of names) {
  if (n.includes('\n') || n.includes('\t')) {
    console.error(`name contains a delimiter: ${JSON.stringify(n)}`);
    process.exit(1);
  }
}

const sorted = [...paths.keys()].sort();
const body = sorted.map((p) => `${p}\t${paths.get(p)}`).join('\n');
const out = `v1 ${sorted.length} ${MAX_PLY}\n${body}\n@@\n${names.join('\n')}\n`;

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/openings.txt', out, 'utf8');

console.log(
  JSON.stringify({
    sourceRows: rows.length,
    lines: sorted.length,
    names: names.length,
    skippedTooDeep,
    skippedIllegal,
    bytes: Buffer.byteLength(out),
  }),
);
```

- [ ] **Step 3: Run it and check the numbers against the ones measured above**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  node scripts/build-opening-book.mjs .cache/chess-openings
```

Expected (exactly this, if upstream has not changed):

```
{"sourceRows":3810,"lines":3704,"names":3088,"skippedTooDeep":106,"skippedIllegal":0,"bytes":306484}
```

`skippedIllegal` **must** be 0 — the script exits 1 otherwise. If `sourceRows`
or `lines` differ, upstream has moved: record the new numbers in the commit
message and carry on; do not edit the script to reproduce the old ones.

- [ ] **Step 4: Measure what it costs over the wire**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
node -e "const{readFileSync}=require('fs'),{gzipSync,brotliCompressSync,constants}=require('zlib');const b=readFileSync('public/data/openings.txt');console.log(JSON.stringify({rawKiB:+(b.length/1024).toFixed(1),gzKiB:+(gzipSync(b,{level:9}).length/1024).toFixed(1),brKiB:+(brotliCompressSync(b,{params:{[constants.BROTLI_PARAM_QUALITY]:11}}).length/1024).toFixed(1)}))"
```

Expected: `{"rawKiB":299.3,"gzKiB":47.4,"brKiB":39.6}`

- [ ] **Step 5: Add the regeneration script to `package.json`**

In the `"scripts"` block, immediately after `"gen:movement"`, add:

```json
    "gen:openings": "node scripts/build-opening-book.mjs .cache/chess-openings",
```

- [ ] **Step 6: Lint (the script is covered by eslint's `scripts/**/*.mjs` glob)**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run lint`
Expected: exits 0. `eco` is destructured and unused in the TSV parse — the
config's `argsIgnorePattern: '^_'` does **not** cover destructured variables, so
if this reports `'eco' is assigned a value but never used`, rename it to
`_eco` **and** confirm the rule accepts it; if it does not, drop it from the
destructure with `const [, name, pgn] = line.split('\t');`.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add scripts/build-opening-book.mjs public/data/openings.txt package.json .gitignore && \
git commit -m "feat(review): bundle the CC0 opening book, 39.6 KiB over the wire

3,704 lines, 3,088 names, capped at 20 plies per Appendix C. Appendix C's
5-per-cent frequency rule is not computable from this source; see the design
spec section 9.2 for the substitute and where the real rule goes."
```

---

### Task 7: The book lookup

**Files:**
- Create: `src/review/openingBook.ts`
- Create: `src/review/openingBook.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/openingBook.test.ts`:

```ts
import { parseBook, lookupOpening } from './openingBook';

/**
 * A hand-built book, so the test is about the lookup and not about upstream
 * data. Paths are UCI, concatenated, 4 characters per ply.
 *
 *   e2e4                     -> "King's Pawn Game"
 *   e2e4 c7c5                -> "Sicilian Defense"
 *   e2e4 c7c5 g1f3           -> "Sicilian Defense: Open"
 *   d2d4                     -> "Queen's Pawn Game"
 */
const FIXTURE = [
  'v1 4 20',
  'd2d4\t3',
  'e2e4\t0',
  'e2e4c7c5\t1',
  'e2e4c7c5g1f3\t2',
  '@@',
  "King's Pawn Game",
  'Sicilian Defense',
  'Sicilian Defense: Open',
  "Queen's Pawn Game",
  '',
].join('\n');

test('parseBook reads the header, the paths and the names', () => {
  const b = parseBook(FIXTURE);
  expect(b.maxPly).toBe(20);
  expect(b.paths).toHaveLength(4);
  expect(b.names).toHaveLength(4);
  // Sorted, so d2d4 comes first.
  expect(b.paths[0]).toBe('d2d4');
});

test('parseBook rejects a file whose header count does not match its body', () => {
  const broken = FIXTURE.replace('v1 4 20', 'v1 9 20');
  expect(() => parseBook(broken)).toThrow(/expected 9 lines/);
});

test('the deepest named prefix wins', () => {
  const b = parseBook(FIXTURE);
  const r = lookupOpening(b, ['e2e4', 'c7c5', 'g1f3', 'd7d6']);
  expect(r.name).toBe('Sicilian Defense: Open');
});

test('leftBookAtPly is the first ply that is not in the book', () => {
  const b = parseBook(FIXTURE);
  // e4 c5 Nf3 are all book; d6 is not.
  const r = lookupOpening(b, ['e2e4', 'c7c5', 'g1f3', 'd7d6']);
  expect(r.leftBookAtPly).toBe(3);
  expect(r.bookPlies).toEqual([true, true, true, false]);
});

test('a game that never leaves the book reports leftBookAtPly null', () => {
  const b = parseBook(FIXTURE);
  const r = lookupOpening(b, ['e2e4', 'c7c5']);
  expect(r.leftBookAtPly).toBeNull();
  expect(r.name).toBe('Sicilian Defense');
});

test('a first move outside the book has no name and leaves at ply 0', () => {
  const b = parseBook(FIXTURE);
  const r = lookupOpening(b, ['a2a4', 'e7e5']);
  expect(r.name).toBeNull();
  expect(r.leftBookAtPly).toBe(0);
  expect(r.bookPlies).toEqual([false, false]);
});

test('an unnamed book prefix still counts as book', () => {
  // e2e4 c7c5 g1f3 is named; but a book whose only entry is the deep line must
  // still treat the prefixes as book, because the game passed through them.
  const deepOnly = ['v1 1 20', 'e2e4c7c5g1f3\t0', '@@', 'Sicilian Defense: Open', ''].join('\n');
  const b = parseBook(deepOnly);
  const r = lookupOpening(b, ['e2e4', 'c7c5', 'g1f3']);
  expect(r.bookPlies).toEqual([true, true, true]);
  expect(r.name).toBe('Sicilian Defense: Open');
});

test('book status stops at maxPly even when the line would continue', () => {
  const short = ['v1 1 2', 'e2e4e7e5\t0', '@@', 'Open Game', ''].join('\n');
  const b = parseBook(short);
  const r = lookupOpening(b, ['e2e4', 'e7e5', 'g1f3']);
  expect(r.bookPlies).toEqual([true, true, false]);
  expect(r.leftBookAtPly).toBe(2);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/openingBook.test.ts`
Expected: the run fails to resolve `./openingBook` — "Failed to load url ./openingBook".

- [ ] **Step 3: Write the implementation**

Create `src/review/openingBook.ts`:

```ts
/**
 * The bundled opening book (PRD F-RV-3, Appendix C "Book").
 *
 * Format is produced by scripts/build-opening-book.mjs; see that file's header.
 * Lookup is a binary search over sorted, fixed-width UCI paths: a position is in
 * the book when some book path starts with the game's path so far, and a
 * position is NAMED when the game's path so far is itself a book path.
 *
 * Appendix C asks for a 5-per-cent frequency rule that the CC0 source cannot
 * support offline. Design spec section 9.2 records the substitute shipped here.
 */

export interface OpeningBook {
  maxPly: number;
  /** Sorted UCI paths, 4 characters per ply. */
  paths: string[];
  /** `nameOf[i]` is the name index for `paths[i]`. */
  nameOf: number[];
  names: string[];
}

export interface OpeningLookup {
  name: string | null;
  /** The first ply index that is not in the book, or null if the game never left it. */
  leftBookAtPly: number | null;
  /** Per ply: was the position AFTER that move still in the book. */
  bookPlies: boolean[];
}

export function parseBook(text: string): OpeningBook {
  const lines = text.split('\n');
  const header = lines[0] ?? '';
  const m = /^v1 (\d+) (\d+)$/.exec(header);
  if (!m) throw new Error(`opening book: bad header ${JSON.stringify(header)}`);
  const count = Number(m[1]);
  const maxPly = Number(m[2]);

  const paths: string[] = [];
  const nameOf: number[] = [];
  let i = 1;
  for (; i < lines.length; i += 1) {
    if (lines[i] === '@@') break;
    const tab = lines[i].indexOf('\t');
    if (tab < 0) throw new Error(`opening book: bad row at line ${i + 1}`);
    paths.push(lines[i].slice(0, tab));
    nameOf.push(Number(lines[i].slice(tab + 1)));
  }
  if (paths.length !== count) {
    throw new Error(`opening book: expected ${count} lines, found ${paths.length}`);
  }
  const names = lines.slice(i + 1).filter((l) => l !== '');
  return { maxPly, paths, nameOf, names };
}

/** Index of the first path >= `prefix`, by binary search. */
function lowerBound(paths: string[], prefix: string): number {
  let lo = 0;
  let hi = paths.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (paths[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * `ucis` is the game's moves in order, 4 characters each (5 with a promotion).
 * Returns the deepest name reached and the ply at which the game left book.
 */
export function lookupOpening(book: OpeningBook, ucis: string[]): OpeningLookup {
  const bookPlies: boolean[] = [];
  let name: string | null = null;
  let leftBookAtPly: number | null = null;
  let path = '';

  for (let ply = 0; ply < ucis.length; ply += 1) {
    if (ply >= book.maxPly || leftBookAtPly !== null) {
      bookPlies.push(false);
      if (leftBookAtPly === null) leftBookAtPly = ply;
      continue;
    }
    path += ucis[ply];
    const at = lowerBound(book.paths, path);
    // In book when some entry starts with the path so far. Because the list is
    // sorted, the only candidate is the first entry at or after the path.
    const inBook = at < book.paths.length && book.paths[at].startsWith(path);
    bookPlies.push(inBook);
    if (!inBook) {
      leftBookAtPly = ply;
      continue;
    }
    // Named when the path so far IS an entry, not merely a prefix of one.
    if (book.paths[at] === path) name = book.names[book.nameOf[at]] ?? name;
  }

  return { name, leftBookAtPly, bookPlies };
}

let cached: Promise<OpeningBook> | null = null;

/**
 * Loads the book once per session. Served from public/data/, so the service
 * worker's runtime cache holds it after the first review and F-RV-10 (review
 * works offline) is satisfied from the second review onward. A first review
 * with no connection and no cache degrades to "no opening name" rather than
 * failing — the opening name is one line of a summary, not the review.
 */
export function loadBook(fetchImpl: typeof fetch = fetch): Promise<OpeningBook> {
  cached ??= fetchImpl(`${import.meta.env.BASE_URL}data/openings.txt`)
    .then((r) => {
      if (!r.ok) throw new Error(`opening book: HTTP ${r.status}`);
      return r.text();
    })
    .then(parseBook);
  return cached;
}

/** Test seam: forget the cached book. */
export function resetBookCache(): void {
  cached = null;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/openingBook.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Prove the lookup against the real shipped file**

A fixture proves the algorithm; it says nothing about the data. Append this test
to `src/review/openingBook.test.ts`:

```ts
import { readFileSync } from 'node:fs';

test('the shipped book names a real opening and finds where a real game left it', () => {
  const b = parseBook(readFileSync('public/data/openings.txt', 'utf8'));
  expect(b.paths.length).toBeGreaterThan(3000);

  // 1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 — the Najdorf, deep in book.
  const najdorf = ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'];
  const r = lookupOpening(b, najdorf);
  expect(r.name).toMatch(/Najdorf/);
  expect(r.leftBookAtPly).toBeNull();

  // The same line with a second move nobody plays leaves book at ply 1.
  const junk = ['e2e4', 'h7h5', 'g1f3'];
  const j = lookupOpening(b, junk);
  expect(j.leftBookAtPly).toBe(1);
});
```

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/openingBook.test.ts`
Expected: `9 passed`. If `expect(r.name).toMatch(/Najdorf/)` fails, print
`r.name` and check it against `.cache/chess-openings/b.tsv` — the shipped data
is the fact, and a rename upstream is a finding to report, not a test to relax.

- [ ] **Step 6: Typecheck, lint, full suite**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test
```

Expected: typecheck and lint silent; the suite passes with 9 more tests than
your chunk's starting count.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/openingBook.ts src/review/openingBook.test.ts && \
git commit -m "feat(review): opening name and the move the game left book (F-RV-3)"
```

**Chunk A ends here.**

---

## Chunk B — Labels (parallel with A, C, D)

**Reference for this chunk's review: PRD §10.6 and Appendix C, read directly**,
plus the shipped `src/engine/winPercent.ts`. Not this plan.

### Task 8: Bands, and a guard against a second win-percent implementation

**Files:**
- Create: `src/review/bands.ts`
- Create: `src/review/bands.test.ts`

- [ ] **Step 1: Probe the shipped formulas**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  cat src/engine/winPercent.ts
```

Expected: exactly three exports — `toWinPercent`, `scoreToWinPercent`,
`moveAccuracy` — implementing PRD §10.6. **These are the only implementations
of those formulas that may exist in the repo.** If this file has changed, stop
and report; every threshold below is denominated in its units.

- [ ] **Step 2: Write the failing test**

Create `src/review/bands.test.ts`:

```ts
import { thresholdsFor, bandForUnit, BEST_EPSILON } from './bands';
import { toWinPercent, moveAccuracy } from '@/engine';

test('Appendix C: each band is exactly the PRD table', () => {
  // Section 4 is the PRD's base column.
  expect(thresholdsFor(4)).toEqual({ excellent: 2, good: 5, inaccuracy: 10, mistake: 20 });
  expect(thresholdsFor(3)).toEqual({ excellent: 2.5, good: 6, inaccuracy: 12, mistake: 22 });
  expect(thresholdsFor(2)).toEqual({ excellent: 3, good: 8, inaccuracy: 15, mistake: 25 });
  // Appendix C gives Sections 1 and 2 one shared column.
  expect(thresholdsFor(1)).toEqual(thresholdsFor(2));
});

test('lower bands are never stricter than higher ones', () => {
  for (const k of ['excellent', 'good', 'inaccuracy', 'mistake'] as const) {
    expect(thresholdsFor(1)[k]).toBeGreaterThanOrEqual(thresholdsFor(3)[k]);
    expect(thresholdsFor(3)[k]).toBeGreaterThanOrEqual(thresholdsFor(4)[k]);
  }
});

test('each band is internally ordered', () => {
  for (const b of [1, 2, 3, 4] as const) {
    const t = thresholdsFor(b);
    expect(t.excellent).toBeLessThan(t.good);
    expect(t.good).toBeLessThan(t.inaccuracy);
    expect(t.inaccuracy).toBeLessThan(t.mistake);
  }
});

test('the band comes from the unit id, and today every learner is in band 1', () => {
  expect(bandForUnit('1.1')).toBe(1);
  expect(bandForUnit('1.6')).toBe(1);
  expect(bandForUnit('2.3')).toBe(2);
  expect(bandForUnit('3.1')).toBe(3);
  expect(bandForUnit('4.9')).toBe(4);
  // Unknown or malformed ids fall back to the most generous band, never the strictest.
  expect(bandForUnit('')).toBe(1);
  expect(bandForUnit('nonsense')).toBe(1);
  expect(bandForUnit('9.9')).toBe(4);
});

test('this module does not restate PRD 10.6 — it uses the shipped curve', () => {
  // Values computed from the PRD formulas independently of the implementation.
  expect(toWinPercent(0)).toBeCloseTo(50, 4);
  expect(toWinPercent(200)).toBeCloseTo(67.6212, 3);
  expect(toWinPercent(-200)).toBeCloseTo(32.3788, 3);
  // The curve is symmetric about 50, which is what lets a mover's win per cent
  // after a move be read off the opponent's evaluation as 100 - x.
  for (const cp of [-900, -350, -75, 0, 75, 350, 900]) {
    expect(100 - toWinPercent(cp)).toBeCloseTo(toWinPercent(-cp), 9);
  }
  expect(moveAccuracy(0)).toBeCloseTo(99.9999, 3);
  expect(moveAccuracy(5)).toBeCloseTo(79.817, 3);
  expect(moveAccuracy(20)).toBeCloseTo(40.0204, 3);
  expect(moveAccuracy(50)).toBeCloseTo(8.5303, 3);
});

test('BEST_EPSILON is small enough to matter and large enough to absorb float noise', () => {
  expect(BEST_EPSILON).toBeGreaterThan(0);
  expect(BEST_EPSILON).toBeLessThan(0.5);
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/bands.test.ts`
Expected: fails to resolve `./bands`.

- [ ] **Step 4: Write the implementation**

Create `src/review/bands.ts`:

```ts
import type { Band } from './types';

/**
 * PRD Appendix C, "Move label thresholds", reproduced as code.
 *
 * Each number is the EXCLUSIVE upper bound of its label in win per cent
 * dropped. Appendix C's wording is "Excellent: under 3; Good: 3 to 8", so a
 * drop of exactly 3 is Good, which is why every comparison in labels.ts is `<`.
 *
 * Sections 1 and 2 share one column in the PRD table. They are kept as two
 * band values rather than collapsed, because the PRD's section structure has
 * four sections and a future tuning pass (Appendix C: "Thresholds are to be
 * tuned in beta") may well separate them.
 */
export interface Thresholds {
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
}

const TABLE: Record<Band, Thresholds> = {
  1: { excellent: 3, good: 8, inaccuracy: 15, mistake: 25 },
  2: { excellent: 3, good: 8, inaccuracy: 15, mistake: 25 },
  3: { excellent: 2.5, good: 6, inaccuracy: 12, mistake: 22 },
  4: { excellent: 2, good: 5, inaccuracy: 10, mistake: 20 },
};

export function thresholdsFor(band: Band): Thresholds {
  return { ...TABLE[band] };
}

/**
 * A drop this small is Best. The engine's own evaluation is not stable to
 * better than a fraction of a win per cent between two searches of adjacent
 * positions, so an exact zero test would label a genuinely best move Excellent
 * on float noise alone.
 */
export const BEST_EPSILON = 0.05;

/**
 * The learner's band from the furthest unit they have reached. Unit ids are
 * `<section>.<unit>` (src/path/curriculum.ts).
 *
 * Only Section 1 exists in the curriculum today, so every live learner is in
 * band 1 and bands 2 to 4 are unreachable in the shipped app. They are
 * implemented and tested because Appendix C specifies them and because the
 * alternative — adding them later — is the version where nobody notices that a
 * Section 3 learner is being judged by Section 1 thresholds.
 *
 * An unparseable id falls back to band 1: the failure mode of guessing too
 * generous is a learner told they played well, and of guessing too strict is a
 * beginner told they blundered. Only one of those is worth risking.
 */
export function bandForUnit(unitId: string): Band {
  const section = Number(unitId.split('.')[0]);
  if (!Number.isFinite(section) || section < 1) return 1;
  if (section >= 4) return 4;
  return section as Band;
}

/**
 * PRD Appendix C, Brilliant: "from a position that was not already clearly
 * winning". The PRD gives no number. Inverting the shipped curve, win per cent
 * 80 is +376 centipawns — close to a whole extra rook. Design spec section 9.3.
 * Beta tuning is a change to this line.
 */
export const BRILLIANT_MAX_WIN_BEFORE = 80;
```

- [ ] **Step 5: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/bands.test.ts`
Expected: `6 passed`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/bands.ts src/review/bands.test.ts && \
git commit -m "feat(review): Appendix C band thresholds, all four bands"
```

---

### Task 9: The base label, with mate handling

**Files:**
- Create: `src/review/labels.ts`
- Create: `src/review/labels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/labels.test.ts`:

```ts
import { labelMove } from './labels';
import type { LabelInput } from './labels';

const base: LabelInput = {
  band: 1,
  drop: 0,
  playedIsBest: false,
  book: false,
  opponentPreviousWasBadMove: false,
  winBefore: 50,
  winAfterPlayed: 50,
  mateAllowed: false,
  moverWasMating: false,
  stillMating: false,
};

const at = (o: Partial<LabelInput>) => labelMove({ ...base, ...o });

test('band 1 boundaries are exactly Appendix C', () => {
  expect(at({ drop: 0 })).toBe('Best');
  expect(at({ drop: 0.04 })).toBe('Best');
  expect(at({ drop: 0.06 })).toBe('Excellent');
  expect(at({ drop: 2.9 })).toBe('Excellent');
  expect(at({ drop: 3 })).toBe('Good');
  expect(at({ drop: 7.9 })).toBe('Good');
  expect(at({ drop: 8 })).toBe('Inaccuracy');
  expect(at({ drop: 14.9 })).toBe('Inaccuracy');
  expect(at({ drop: 15 })).toBe('Mistake');
  expect(at({ drop: 24.9 })).toBe('Mistake');
  expect(at({ drop: 25 })).toBe('Blunder');
});

test('band 3 boundaries are exactly Appendix C', () => {
  expect(at({ band: 3, drop: 2.4 })).toBe('Excellent');
  expect(at({ band: 3, drop: 2.5 })).toBe('Good');
  expect(at({ band: 3, drop: 5.9 })).toBe('Good');
  expect(at({ band: 3, drop: 6 })).toBe('Inaccuracy');
  expect(at({ band: 3, drop: 11.9 })).toBe('Inaccuracy');
  expect(at({ band: 3, drop: 12 })).toBe('Mistake');
  expect(at({ band: 3, drop: 21.9 })).toBe('Mistake');
  expect(at({ band: 3, drop: 22 })).toBe('Blunder');
});

test('band 4 boundaries are exactly the PRD base column', () => {
  expect(at({ band: 4, drop: 1.9 })).toBe('Excellent');
  expect(at({ band: 4, drop: 2 })).toBe('Good');
  expect(at({ band: 4, drop: 4.9 })).toBe('Good');
  expect(at({ band: 4, drop: 5 })).toBe('Inaccuracy');
  expect(at({ band: 4, drop: 9.9 })).toBe('Inaccuracy');
  expect(at({ band: 4, drop: 10 })).toBe('Mistake');
  expect(at({ band: 4, drop: 19.9 })).toBe('Mistake');
  expect(at({ band: 4, drop: 20 })).toBe('Blunder');
});

test('a drop is never labelled worse in a lower band than in a higher one', () => {
  const rank = ['Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder'];
  for (let d = 0; d <= 30; d += 0.1) {
    const drop = Number(d.toFixed(2));
    const r1 = rank.indexOf(at({ band: 1, drop }));
    const r3 = rank.indexOf(at({ band: 3, drop }));
    const r4 = rank.indexOf(at({ band: 4, drop }));
    expect(r1).toBeLessThanOrEqual(r3);
    expect(r3).toBeLessThanOrEqual(r4);
  }
});

test('playing the engine move is Best whatever the arithmetic says', () => {
  expect(at({ drop: 0.4, playedIsBest: true })).toBe('Best');
});

test('Book beats every numeric label', () => {
  expect(at({ drop: 40, book: true })).toBe('Book');
  expect(at({ drop: 0, book: true })).toBe('Book');
});

test('Miss replaces Mistake and Blunder, and nothing better', () => {
  expect(at({ drop: 16, opponentPreviousWasBadMove: true })).toBe('Miss');
  expect(at({ drop: 30, opponentPreviousWasBadMove: true })).toBe('Miss');
  expect(at({ drop: 9, opponentPreviousWasBadMove: true })).toBe('Inaccuracy');
  expect(at({ drop: 1, opponentPreviousWasBadMove: true })).toBe('Excellent');
});

test('Miss does not apply to a book move', () => {
  expect(at({ drop: 30, book: true, opponentPreviousWasBadMove: true })).toBe('Book');
});

test('allowing a forced mate is a Blunder even when the numeric drop is small', () => {
  // Already bad but not hopeless: win% 30 down to 0 is a 30-point drop anyway,
  // so the interesting case is the one where the curve clamps and the drop
  // understates it.
  expect(at({ drop: 8, winBefore: 55, winAfterPlayed: 0, mateAllowed: true })).toBe('Blunder');
});

test('allowing mate from an already hopeless position uses the numeric band', () => {
  expect(at({ drop: 8, winBefore: 12, winAfterPlayed: 0, mateAllowed: true })).toBe('Inaccuracy');
  expect(at({ drop: 2, winBefore: 5, winAfterPlayed: 0, mateAllowed: true })).toBe('Excellent');
});

test('delaying a mate you already had carries no penalty', () => {
  expect(at({ drop: 12, moverWasMating: true, stillMating: true })).toBe('Best');
});

test('losing a mate you had is judged normally', () => {
  expect(at({ drop: 30, moverWasMating: true, stillMating: false })).toBe('Blunder');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/labels.test.ts`
Expected: fails to resolve `./labels`.

- [ ] **Step 3: Write the implementation**

Create `src/review/labels.ts`:

```ts
import type { Band, MoveLabel } from './types';
import { thresholdsFor, BEST_EPSILON } from './bands';

/**
 * PRD F-RV-2, 10.6 and Appendix C.
 *
 * Every formula this depends on lives in src/engine/winPercent.ts and is not
 * restated here. This module decides a label from a drop, nothing more.
 *
 * `Great` and `Brilliant` are NOT decided here: both need a second-best line,
 * i.e. MultiPV >= 2, which the whole-game pass cannot afford (design spec
 * section 1.4). They are applied to key moments only, by upgradeKeyMoment().
 */

export interface LabelInput {
  band: Band;
  /** Win per cent lost, for the mover. Never negative. */
  drop: number;
  /** The move played is the engine's first line. */
  playedIsBest: boolean;
  /** The position after the move is in the bundled book, within its ply cap. */
  book: boolean;
  /** The opponent's previous move was a Mistake, Miss or Blunder (F-RV-2, "Miss"). */
  opponentPreviousWasBadMove: boolean;
  /** Win per cent for the mover before the move. */
  winBefore: number;
  /** Win per cent for the mover after the move played. */
  winAfterPlayed: number;
  /** The move played hands the opponent a forced mate that was not there before. */
  mateAllowed: boolean;
  /** The mover had a forced mate before the move. */
  moverWasMating: boolean;
  /** The mover still has a forced mate after the move. */
  stillMating: boolean;
}

/**
 * PRD 10.6: "allowing a forced mate is a blunder unless the position was
 * already lost by a wide margin". "A wide margin" gets a number here, once.
 */
const HOPELESS_WIN_PERCENT = 20;

function numericLabel(drop: number, band: Band, playedIsBest: boolean): MoveLabel {
  if (playedIsBest || drop < BEST_EPSILON) return 'Best';
  const t = thresholdsFor(band);
  if (drop < t.excellent) return 'Excellent';
  if (drop < t.good) return 'Good';
  if (drop < t.inaccuracy) return 'Inaccuracy';
  if (drop < t.mistake) return 'Mistake';
  return 'Blunder';
}

export function isBadMove(label: MoveLabel): boolean {
  return label === 'Mistake' || label === 'Blunder' || label === 'Miss';
}

export function labelMove(input: LabelInput): MoveLabel {
  // 1. Book wins over everything. A book move's "drop" is the engine
  //    disagreeing with theory, which is not the learner's error.
  if (input.book) return 'Book';

  // 2. Mate already in hand, mate still in hand: no penalty for taking longer.
  //    PRD 10.6, "delaying a mate carries no label".
  if (input.moverWasMating && input.stillMating) return 'Best';

  // 3. Handing over a forced mate is a Blunder unless it was already lost wide.
  if (input.mateAllowed && input.winBefore >= HOPELESS_WIN_PERCENT) return 'Blunder';

  const label = numericLabel(input.drop, input.band, input.playedIsBest);

  // 4. Miss: "a mistake or worse played when the opponent's previous move was a
  //    mistake or worse". It replaces Mistake and Blunder and nothing else.
  if (input.opponentPreviousWasBadMove && (label === 'Mistake' || label === 'Blunder')) {
    return 'Miss';
  }
  return label;
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/labels.test.ts`
Expected: `12 passed`.

- [ ] **Step 5: Check each override can change the answer**

An override that never fires is indistinguishable from an override that is
correct, and both go green. Prove each of the four is reachable by making it
fail on purpose. For each of the four early returns in `labelMove` — Book, the
mate-delay return, the mate-allowed return, and the Miss return — comment it
out, run the file, and confirm **at least one named test fails**. Expected
failures:

| Commented out | Test that must fail |
|---|---|
| `if (input.book) return 'Book';` | `Book beats every numeric label` |
| the `moverWasMating && stillMating` return | `delaying a mate you already had carries no penalty` |
| the `mateAllowed` return | `allowing a forced mate is a Blunder even when the numeric drop is small` |
| the Miss return | `Miss replaces Mistake and Blunder, and nothing better` |

Restore each line before moving to the next. If any removal leaves the file
green, the corresponding rule is untested — write the test that fails before
continuing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/labels.ts src/review/labels.test.ts && \
git commit -m "feat(review): move labels from the win-percent drop (F-RV-2, Appendix C)"
```

---

### Task 10: Great and Brilliant, from the deeper pass

**Files:**
- Modify: `src/review/labels.ts` (append)
- Modify: `src/review/labels.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/review/labels.test.ts`:

```ts
import { upgradeKeyMoment } from './labels';
import type { UpgradeInput } from './labels';

const up: UpgradeInput = {
  band: 1,
  label: 'Best',
  winBefore: 50,
  secondWin: null,
  materialSacrificed: 0,
  materialRegained: 0,
};

const upg = (o: Partial<UpgradeInput>) => upgradeKeyMoment({ ...up, ...o });

test('Great: the only move that avoided a mistake', () => {
  // Band 1's Mistake floor is 15. Second-best loses 16 points, so the played
  // move was the only one that did not blunder the position.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 44 })).toBe('Great');
});

test('not Great when a second move was nearly as good', () => {
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 52 })).toBe('Best');
});

test('not Great when there was no second move at all', () => {
  // A forced move is not a find. secondWin null means one legal move.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: null })).toBe('Best');
});

test('not Great when the played move was not best', () => {
  expect(upg({ label: 'Good', winBefore: 60, secondWin: 40 })).toBe('Good');
});

test('Brilliant: a sound sacrifice from a position that was not already winning', () => {
  expect(
    upg({ label: 'Best', winBefore: 55, secondWin: 50, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Brilliant');
});

test('not Brilliant when the material comes straight back', () => {
  expect(
    upg({ label: 'Best', winBefore: 55, secondWin: 50, materialSacrificed: 3, materialRegained: 3 }),
  ).toBe('Best');
});

test('not Brilliant from an already clearly winning position', () => {
  expect(
    upg({ label: 'Best', winBefore: 90, secondWin: 50, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Great');
});

test('not Brilliant when the move was only Good', () => {
  expect(
    upg({ label: 'Good', winBefore: 55, secondWin: 50, materialSacrificed: 5, materialRegained: 0 }),
  ).toBe('Good');
});

test('Brilliant outranks Great when both apply', () => {
  expect(
    upg({ label: 'Best', winBefore: 55, secondWin: 30, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Brilliant');
});

test('a Book move is never upgraded', () => {
  expect(
    upg({ label: 'Book', winBefore: 55, secondWin: 20, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Book');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/labels.test.ts`
Expected: `upgradeKeyMoment is not exported` / 10 new failures.

- [ ] **Step 3: Append the implementation to `src/review/labels.ts`**

```ts
import { BRILLIANT_MAX_WIN_BEFORE } from './bands';

/**
 * PRD F-RV-2 and Appendix C, Great and Brilliant.
 *
 * These are applied ONLY to key moments, because both need a second-best line
 * and therefore MultiPV >= 2, which costs 2.6x a MultiPV-1 pass in the browser
 * (design spec section 1.2) and does not fit F-RV-1's 60-second budget over a
 * whole game. Design spec section 1.5, consequence C2.
 */
export interface UpgradeInput {
  band: Band;
  /** The label the whole-game pass assigned. */
  label: MoveLabel;
  /** Win per cent for the mover before the move. */
  winBefore: number;
  /** Win per cent for the mover if the SECOND-best move had been played. Null when forced. */
  secondWin: number | null;
  /** Points of material given up by the move, by PIECE_VALUE. */
  materialSacrificed: number;
  /** Points regained within the engine's principal variation. */
  materialRegained: number;
}

export function upgradeKeyMoment(input: UpgradeInput): MoveLabel {
  if (input.label === 'Book') return input.label;
  if (input.label !== 'Best' && input.label !== 'Excellent') return input.label;
  if (input.secondWin === null) return input.label;

  const secondDrop = input.winBefore - input.secondWin;
  const onlyMove = input.label === 'Best' && secondDrop >= thresholdsFor(input.band).inaccuracy;

  const sacrifice = input.materialSacrificed - input.materialRegained;
  const brilliant =
    sacrifice > 0 && input.winBefore < BRILLIANT_MAX_WIN_BEFORE;

  if (brilliant) return 'Brilliant';
  if (onlyMove) return 'Great';
  return input.label;
}
```

- [ ] **Step 4: Run, and read the failure carefully**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/labels.test.ts`

Expected: **one test fails** —
`Great: the only move that avoided a mistake`, because the code above uses
`thresholdsFor(band).inaccuracy` (15 in band 1) where Appendix C says Great is
"the only move that keeps the evaluation from dropping by **a mistake or
more**", i.e. the **Mistake** floor. A second-best drop of 16 satisfies both, so
the test above passes either way — the discriminating case is a second-best
drop between the Inaccuracy floor and the Mistake floor.

Add the discriminating test **before** fixing the code:

```ts
test('a second-best move that is merely an inaccuracy does not make the played move Great', () => {
  // Band 1: Inaccuracy floor 8, Mistake floor 15. A second-best that drops 10
  // is an inaccuracy, not a mistake, so the played move was not the only move.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 50 })).toBe('Best');
});
```

Run it and confirm it **fails** with `expected 'Great' to be 'Best'`. Then
change `.inaccuracy` to `.mistake`:

```ts
  const onlyMove = input.label === 'Best' && secondDrop >= thresholdsFor(input.band).mistake;
```

Run again. Expected: all 23 tests in the file pass.

This step is deliberate. The plan's first version of this line disagreed with
Appendix C, and the tests as first written could not tell the two apart. A
threshold whose two candidate values agree on every fixture you happened to pick
is untested, and the fixture has to be moved to where they disagree.

- [ ] **Step 5: Typecheck, lint, full suite**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test
```

Expected: silent, silent, all green.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/labels.ts src/review/labels.test.ts && \
git commit -m "feat(review): Great and Brilliant, from the key-moment MultiPV pass"
```

**Chunk B ends here.**

---

## Chunk C — Analysis (parallel with A, B, D)

**Reference for this chunk's review: PRD F-RV-1 read directly**, plus the
shipped `src/engine/EngineClient.ts`. Not this plan.

### Task 11: Reconstruct a finished game from the event log

**Files:**
- Create: `src/review/gameSource.ts`
- Create: `src/review/gameSource.test.ts`

The review's input is not obvious and the plan's claim about it must be probed
first.

- [ ] **Step 1: Probe what a finished game actually records**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n -A12 "type: 'game_finished'" src/play/useGame.ts && \
  grep -n -B2 -A10 "type: 'game_started'" src/play/useGame.ts && \
  grep -rn "db.games" src/ --include=*.ts --include=*.tsx
```

Expected, and this is the whole reason this task exists:

1. `game_finished` carries `pgn: state.sans.join(' ')` — **space-joined SAN
   only.** No headers, no result token, no FENs.
2. `game_finished` does **not** carry the learner's colour. `game_started` does
   (`color: 'w' | 'b'`).
3. The `db.games` grep returns **nothing** outside `src/data/db.ts` — the table
   is declared and never written.

If any of those three is false, **stop and report**: the reconstruction below is
built on all three.

- [ ] **Step 2: Write the failing test**

Create `src/review/gameSource.test.ts`:

```ts
import { newEvent } from '@/data';
import type { LearnerEvent } from '@/data';
import { sourceFromEvents, positionsOf } from './gameSource';
import { START_FEN } from '@/rules';

function started(gameId: string, color: 'w' | 'b'): LearnerEvent {
  return newEvent({ type: 'game_started', gameId, persona: 'rosa', color, timeControl: 'untimed', coach: true });
}
function finished(gameId: string, pgn: string): LearnerEvent {
  return newEvent({ type: 'game_finished', gameId, result: 'win', moves: 2, hints: 0, takebacks: 0, crowns: 3, pgn });
}

test('a source is the join of game_started and game_finished on gameId', () => {
  const s = sourceFromEvents([started('g1', 'b'), finished('g1', 'e4 e5 Nf3')], 'g1');
  expect(s).not.toBeNull();
  expect(s!.learner).toBe('b');
  expect(s!.persona).toBe('rosa');
  expect(s!.sans).toEqual(['e4', 'e5', 'Nf3']);
  expect(s!.result).toBe('win');
});

test('a game with no game_finished is not reviewable', () => {
  expect(sourceFromEvents([started('g1', 'w')], 'g1')).toBeNull();
});

test('a game with no game_started is not reviewable, because the colour is unknown', () => {
  // Guessing white would mis-label every move of every black game. Better to
  // say so than to review the wrong player.
  expect(sourceFromEvents([finished('g1', 'e4 e5')], 'g1')).toBeNull();
});

test('a game with no moves is not reviewable', () => {
  expect(sourceFromEvents([started('g1', 'w'), finished('g1', '')], 'g1')).toBeNull();
});

test('events for other games are ignored', () => {
  const s = sourceFromEvents([started('g1', 'w'), finished('g1', 'e4'), started('g2', 'b'), finished('g2', 'd4 d5')], 'g2');
  expect(s!.learner).toBe('b');
  expect(s!.sans).toEqual(['d4', 'd5']);
});

test('positionsOf replays SAN into one more position than there are moves', () => {
  const p = positionsOf(['e4', 'e5', 'Nf3']);
  expect(p.fens).toHaveLength(4);
  expect(p.fens[0]).toBe(START_FEN);
  expect(p.ucis).toEqual(['e2e4', 'e7e5', 'g1f3']);
  expect(p.fens[1]).toContain(' b ');
});

test('positionsOf throws on a SAN list that does not replay', () => {
  expect(() => positionsOf(['e4', 'e4'])).toThrow(/replay/);
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/gameSource.test.ts`
Expected: fails to resolve `./gameSource`.

- [ ] **Step 4: Write the implementation**

Create `src/review/gameSource.ts`:

```ts
import type { LearnerEvent } from '@/data';
import { START_FEN, applyMove, toUci } from '@/rules';
import type { ReviewSource } from './types';

/**
 * Where a review's input comes from.
 *
 * A finished in-app game is recorded as TWO events (src/play/useGame.ts):
 * `game_started`, which carries the learner's colour, and `game_finished`,
 * which carries the moves as space-joined SAN. Neither alone is enough, so this
 * joins them on gameId. The `games` table in src/data/db.ts exists but is never
 * written to; do not read it.
 *
 * Import (PRD F-RV-9, out of scope for this plan) would build the same
 * ReviewSource from a PGN and everything downstream would be unchanged. This
 * function is the seam.
 */
export function sourceFromEvents(events: LearnerEvent[], gameId: string): ReviewSource | null {
  let start: Extract<LearnerEvent['payload'], { type: 'game_started' }> | null = null;
  let end: Extract<LearnerEvent['payload'], { type: 'game_finished' }> | null = null;
  let startedAt = '';

  for (const e of events) {
    const p = e.payload;
    if (p.type === 'game_started' && p.gameId === gameId) {
      start = p;
      startedAt = e.createdAt;
    } else if (p.type === 'game_finished' && p.gameId === gameId) {
      end = p;
    }
  }
  if (!start || !end) return null;

  const sans = end.pgn.split(/\s+/).filter(Boolean);
  if (sans.length === 0) return null;

  return {
    gameId,
    learner: start.color,
    persona: start.persona,
    sans,
    result: end.result,
    timeControl: start.timeControl,
    startedAt,
  };
}

export interface Positions {
  /** `fens[0]` is the start; `fens[i + 1]` is the position after `sans[i]`. */
  fens: string[];
  /** `ucis[i]` is `sans[i]` in UCI. */
  ucis: string[];
}

/**
 * Replays the SAN list from the standard start.
 *
 * Sound because the app has no Chess960 and no play from a set position: every
 * game recorded by `game_finished` began at START_FEN. If that ever stops being
 * true, `game_finished` must start carrying a start FEN and this function must
 * take one.
 */
export function positionsOf(sans: string[]): Positions {
  const fens = [START_FEN];
  const ucis: string[] = [];
  let fen = START_FEN;
  for (let i = 0; i < sans.length; i += 1) {
    let uci: string;
    try {
      uci = toUci(fen, sans[i]);
    } catch {
      throw new Error(`game does not replay: ply ${i}, SAN ${JSON.stringify(sans[i])}`);
    }
    const r = applyMove(fen, uci);
    fen = r.fen;
    fens.push(fen);
    ucis.push(uci);
  }
  return { fens, ucis };
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/gameSource.test.ts`
Expected: `7 passed`.

If `positionsOf(['e4','e4'])` does **not** throw, `toUci` is not rejecting the
illegal SAN the way this test assumes — print what it returns and adapt the
guard to whatever `src/rules/rules.ts` actually does, then report the
difference. The shipped rules module is the fact.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/gameSource.ts src/review/gameSource.test.ts && \
git commit -m "feat(review): rebuild a finished game from the event log"
```

---

### Task 12: Measure the depth ladder at MultiPV 1

**Files:**
- Create: `scripts/measure-review-depth.mjs`

The design spec's §1.3 depth ratios were measured at MultiPV 2, and the ladder
runs at MultiPV 1 (spec §9.5). **Do not assume the ratio transfers.** This task
measures it and the next task uses what it measured.

- [ ] **Step 1: Write the harness**

Create `scripts/measure-review-depth.mjs`:

```js
/**
 * Measures the review's first pass over a real game at MultiPV 1, in a real
 * browser Worker, at each rung of the depth ladder.
 *
 * PRD F-RV-1 budgets 60 seconds for a 40-move game and shows a partial review
 * past 90. The AnalysisService picks its depth at runtime from a measured rate
 * (design spec section 4.2); the RATIOS between rungs are what this script
 * produces, so that the projection from a depth-14 calibration to a depth-12 or
 * depth-10 run is arithmetic rather than a guess.
 *
 * Usage:
 *   node scripts/measure-review-depth.mjs <path-to-json-with-{fens:[...]}>
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = 'public';
const fixture = process.argv[2];
if (!fixture) {
  console.error('usage: node scripts/measure-review-depth.mjs <fens.json>');
  process.exit(2);
}
const { fens } = JSON.parse(readFileSync(fixture, 'utf8'));
const TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm' };

const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>bench</title><body>ok</body>');
    return;
  }
  try {
    const body = readFileSync(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('no');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const results = {};
for (const depth of [14, 12, 10]) {
  results[depth] = await page.evaluate(
    async ({ fens, depth }) => {
      const w = new Worker('/engine/stockfish-19-lite-single.js');
      const waiters = [];
      w.onmessage = (e) => {
        const l = typeof e.data === 'string' ? e.data : '';
        for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](l)) waiters.splice(i, 1);
      };
      const until = (pred) => new Promise((res) => waiters.push((l) => (pred(l) ? (res(l), true) : false)));
      const go = (cmd) =>
        new Promise((res) => {
          waiters.push((l) => (l.startsWith('bestmove') ? (res(l), true) : false));
          w.postMessage(cmd);
        });
      w.postMessage('uci');
      await until((l) => l === 'uciok');
      w.postMessage('setoption name Hash value 16');
      w.postMessage('setoption name Threads value 1');
      w.postMessage('setoption name MultiPV value 1');
      w.postMessage('ucinewgame');
      w.postMessage('isready');
      await until((l) => l === 'readyok');
      w.postMessage('position fen ' + fens[0]);
      await go('go depth ' + depth); // warm-up, excluded
      const t0 = performance.now();
      for (const fen of fens) {
        w.postMessage('position fen ' + fen);
        await go('go depth ' + depth);
      }
      const total = Math.round(performance.now() - t0);
      w.terminate();
      return { totalMs: total, meanMs: +(total / fens.length).toFixed(1) };
    },
    { fens, depth },
  );
}

const base = results[14].totalMs;
console.log(
  JSON.stringify(
    {
      positions: fens.length,
      perDepth: results,
      ratioToDepth14: { 14: 1, 12: +(results[12].totalMs / base).toFixed(3), 10: +(results[10].totalMs / base).toFixed(3) },
    },
    null,
    1,
  ),
);

await browser.close();
server.close();
process.exit(0);
```

- [ ] **Step 2: Build a fixture of 81 real positions**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
node --input-type=module -e "
import { Chess } from 'chess.js';
import { writeFileSync } from 'node:fs';
const SANS = 'd4 Nf6 c4 d6 e3 e5 Ne2 c6 h3 Nbd7 Nd2 g6 Qc2 Qe7 e4 a5 d5 Nc5 b3 Bh6 Rb1 cxd5 cxd5 O-O Nc3 Nh5 Ba3 f5 Bxc5 Bxd2+ Qxd2 Nf6 Bb6 Nxe4 Qb2 Bd7 Nxe4 Rfc8 Qd2 Be8 Be2 a4 b4 fxe4 Be3 b6 g3 Qb7 Rd1 Bb5 Bxb5 Qf7 Be2 Qf5 g4 Qf7 Ra1 b5 Rb1 Ra7 Ra1 Rac7 h4 Rc2 Qd1 Rb2 a3 Rxe2+ Qxe2 Rc3 Rd1 g5 Rb1 Rc4 Rh3 h5 hxg5 h4 g6 Qc7'.split(' ');
const g = new Chess(); const fens = [g.fen()];
for (const s of SANS) { g.move(s); fens.push(g.fen()); }
writeFileSync('.cache/review-fixture.json', JSON.stringify({ fens }));
console.log('positions', fens.length);
"
```

Expected: `positions 80`. (79 moves plus the start. The design spec's benchmark
used 81 because it included one extra position; 80 is the same workload within a
per cent and the ratio is what matters here.)

If a `g.move(s)` throws, the SAN list above has been mistyped — report it rather
than trimming the list, because a shorter game measures a different workload.

- [ ] **Step 3: Run the measurement**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  node scripts/measure-review-depth.mjs .cache/review-fixture.json
```

Expected shape (the absolute numbers depend on the machine; on an Apple M1 the
depth-14 total was ~12,000 ms for 81 positions):

```
{
 "positions": 80,
 "perDepth": { "14": {...}, "12": {...}, "10": {...} },
 "ratioToDepth14": { "14": 1, "12": <0.4-0.8>, "10": <0.1-0.35> }
}
```

**Record the two ratios.** They go into `src/review/AnalysisService.ts` in
Task 13. If either ratio is above 1 — a shallower search taking longer — the
measurement is wrong, not the engine: re-run it before using the numbers.

- [ ] **Step 4: Commit the harness only**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add scripts/measure-review-depth.mjs && \
git commit -m "chore(review): measure the depth ladder at MultiPV 1

Measured on <machine>: ratioToDepth14 = {12: <x>, 10: <y>} over <n> positions."
```

---

### Task 13: The analysis service — first pass, budget, wall, background completion

**Files:**
- Create: `src/review/AnalysisService.ts`
- Create: `src/review/AnalysisService.test.ts`

- [ ] **Step 1: Probe the engine client's contract**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n '90,130p' src/engine/EngineClient.ts
```

Expected, and load-bearing:

- `this.lines.set(info.multipv, { move: info.pv[0] ?? '', pv, score, depth })` —
  so **`analysis.lines[0].move` is the first move of the best principal
  variation**, and `lines` is ordered by MultiPV index ascending.
- `job.resolve({ lines: ordered, depth: job.depth })` — `Analysis.depth` is the
  **requested** depth, not the reported one. Do not read it back as evidence of
  what the engine did.
- `pump()` returns early when `this.paused`, and jobs stay queued.

- [ ] **Step 2: Write the failing test**

Create `src/review/AnalysisService.test.ts`:

```ts
import { AnalysisService } from './AnalysisService';
import type { Analysis } from '@/engine';
import { EngineUnavailable } from '@/engine';
import { positionsOf } from './gameSource';

/** A fake engine that answers instantly and records what it was asked. */
function fakeEngine(opts: { perCallMs?: number; failAt?: number } = {}) {
  const calls: { fen: string; depth: number; multiPv: number }[] = [];
  let now = 0;
  const engine = {
    analyse: async (req: { fen: string; depth: number; multiPv?: number }): Promise<Analysis> => {
      calls.push({ fen: req.fen, depth: req.depth, multiPv: req.multiPv ?? 1 });
      if (opts.failAt !== undefined && calls.length > opts.failAt) throw new EngineUnavailable('boom');
      now += opts.perCallMs ?? 0;
      return { lines: [{ move: 'e2e4', pv: ['e2e4'], score: { cp: 20 }, depth: req.depth }], depth: req.depth };
    },
  };
  return { engine, calls, clock: () => now };
}

const SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];

test('one search per position, at MultiPV 1', () => {
  const { engine, calls, clock } = fakeEngine();
  const svc = new AnalysisService(engine, { now: clock });
  return svc.run(positionsOf(SANS).fens).then((r) => {
    expect(calls).toHaveLength(7); // 6 moves + the start position
    expect(calls.every((c) => c.multiPv === 1)).toBe(true);
    expect(r.positions).toHaveLength(7);
    expect(r.partial).toBe(false);
  });
});

test('the ladder drops to a shallower depth when the projection blows the budget', async () => {
  // 3000 ms per position x 80 positions is 240 s at depth 14 — far over budget.
  const { engine, calls, clock } = fakeEngine({ perCallMs: 3000 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 3 });
  const fens = positionsOf(SANS).fens;
  await svc.run(fens);
  // The calibration positions run at 14; everything after runs shallower.
  expect(calls.slice(0, 3).every((c) => c.depth === 14)).toBe(true);
  expect(calls.slice(3).every((c) => c.depth < 14)).toBe(true);
});

test('the ladder stays at 14 when the projection fits', async () => {
  const { engine, calls, clock } = fakeEngine({ perCallMs: 10 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 3 });
  await svc.run(positionsOf(SANS).fens);
  expect(calls.every((c) => c.depth === 14)).toBe(true);
});

test('the 90-second wall stops the pass and marks it partial', async () => {
  // 40 s per position: the wall is crossed on the third.
  const { engine, clock } = fakeEngine({ perCallMs: 40_000 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 1 });
  const r = await svc.run(positionsOf(SANS).fens);
  expect(r.partial).toBe(true);
  expect(r.positions.length).toBeGreaterThan(0);
  expect(r.positions.length).toBeLessThan(7);
});

test('a partial pass reports exactly how far it got', async () => {
  const { engine, clock } = fakeEngine({ perCallMs: 40_000 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 1 });
  const r = await svc.run(positionsOf(SANS).fens);
  // Every analysed position is contiguous from the start and correctly indexed.
  r.positions.forEach((p, i) => expect(p.index).toBe(i));
});

test('progress is reported for every position', async () => {
  const { engine, clock } = fakeEngine();
  const seen: number[] = [];
  const svc = new AnalysisService(engine, { now: clock, onProgress: (done) => seen.push(done) });
  await svc.run(positionsOf(SANS).fens);
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test('cancel stops submitting and resolves with what it had', async () => {
  const { engine, calls, clock } = fakeEngine();
  const svc = new AnalysisService(engine, { now: clock, onProgress: (done) => { if (done === 2) svc.cancel(); } });
  const r = await svc.run(positionsOf(SANS).fens);
  expect(calls.length).toBe(2);
  expect(r.cancelled).toBe(true);
  expect(r.positions).toHaveLength(2);
});

test('an engine failure aborts the pass and keeps what was analysed', async () => {
  const { engine, clock } = fakeEngine({ failAt: 2 });
  const svc = new AnalysisService(engine, { now: clock });
  const r = await svc.run(positionsOf(SANS).fens);
  expect(r.failed).toBe(true);
  expect(r.positions).toHaveLength(2);
});

test('the deeper key-moment pass runs at MultiPV 2', async () => {
  const { engine, calls, clock } = fakeEngine();
  const svc = new AnalysisService(engine, { now: clock });
  const fens = positionsOf(SANS).fens;
  await svc.deepen(fens[2], 16);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ fen: fens[2], depth: 16, multiPv: 2 });
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/AnalysisService.test.ts`
Expected: fails to resolve `./AnalysisService`.

- [ ] **Step 4: Write the implementation**

Create `src/review/AnalysisService.ts`:

```ts
import type { Analysis } from '@/engine';
import { EngineUnavailable, scoreToWinPercent } from '@/engine';
import type { AnalysedPosition } from './types';

/**
 * PRD F-RV-1.
 *
 * One search per position at MultiPV 1. The value of the move actually played
 * is the NEXT position's value, negated, so 80 positions cover 79 moves with 80
 * searches rather than 158. MultiPV 2 costs 2.6x in the browser (design spec
 * section 1.2) and does not fit the 60-second budget; it is confined to the key
 * moments, via deepen().
 *
 * Depth is not fixed. The service times the first few positions, projects the
 * total, and steps down a ladder if the projection blows the budget — because
 * the multiplier between the development machine and the reference phone is not
 * measured (design spec section 1.4.4) and a fixed depth is therefore a bet.
 * The worst case of a ladder is a shallower review, which the summary states.
 */

/** Only the part of EngineClient this service uses, so a test can supply a fake. */
export interface AnalysisEngine {
  analyse(req: { fen: string; depth: number; multiPv?: number }): Promise<Analysis>;
}

export const BUDGET_MS = 60_000; // F-RV-1: "in under 60 seconds for a 40-move game"
export const WALL_MS = 90_000; // F-RV-1: "if analysis exceeds 90 seconds"
export const LADDER = [14, 12, 10] as const;

/**
 * Cost of each rung relative to depth 14, at MultiPV 1, measured by
 * scripts/measure-review-depth.mjs (Task 12). REPLACE THESE with the numbers
 * that script printed on the machine you ran it on, and say in the commit which
 * machine that was. They are a shape, not a constant of nature: the assertion
 * that protects them is monotonicity, not the literal values.
 */
export const DEPTH_COST: Record<number, number> = { 14: 1, 12: 0.63, 10: 0.19 };

export interface RunOptions {
  /** Injectable clock, so the budget and wall are testable without waiting. */
  now?: () => number;
  calibrateN?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface RunResult {
  positions: AnalysedPosition[];
  depth: number;
  partial: boolean;
  cancelled: boolean;
  failed: boolean;
}

export class AnalysisService {
  private cancelled = false;

  constructor(
    private readonly engine: AnalysisEngine,
    private readonly opts: RunOptions = {},
  ) {}

  cancel() {
    this.cancelled = true;
  }

  /**
   * `fens[0]` is the start position; `fens[i + 1]` is the position after ply i.
   * Submits ONE job at a time and awaits it: the shared EngineClient's queue has
   * no cancel, and flooding it would also hold up the board's own requests.
   */
  async run(fens: string[]): Promise<RunResult> {
    const now = this.opts.now ?? (() => Date.now());
    const calibrateN = this.opts.calibrateN ?? 6;
    const t0 = now();
    const positions: AnalysedPosition[] = [];
    let depth: number = LADDER[0];
    let failed = false;
    let partial = false;

    for (let i = 0; i < fens.length; i += 1) {
      if (this.cancelled) break;
      if (now() - t0 >= WALL_MS) {
        partial = true;
        break;
      }
      let a: Analysis;
      try {
        a = await this.engine.analyse({ fen: fens[i], depth, multiPv: 1 });
      } catch (e) {
        if (!(e instanceof EngineUnavailable)) throw e;
        failed = true;
        break;
      }
      const line = a.lines[0];
      positions.push({
        index: i,
        fen: fens[i],
        win: scoreToWinPercent(line.score),
        bestUci: line.move,
        pv: line.pv,
        depth,
      });
      this.opts.onProgress?.(positions.length, fens.length);

      // Choose the ladder rung once, on the calibration sample.
      if (i + 1 === calibrateN && fens.length > calibrateN) {
        depth = this.chooseDepth((now() - t0) / calibrateN, fens.length);
      }
    }

    return { positions, depth, partial, cancelled: this.cancelled, failed };
  }

  /** PRD F-RV-1: "Key moments are then re-analysed at a higher depth." */
  async deepen(fen: string, depth: number): Promise<Analysis> {
    return this.engine.analyse({ fen, depth, multiPv: 2 });
  }

  private chooseDepth(meanMsAt14: number, total: number): number {
    for (const rung of LADDER) {
      const projected = meanMsAt14 * DEPTH_COST[rung] * total;
      if (projected <= BUDGET_MS) return rung;
    }
    return LADDER[LADDER.length - 1];
  }
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/AnalysisService.test.ts`
Expected: `9 passed`.

- [ ] **Step 6: Prove the wall test can fail**

`the 90-second wall stops the pass and marks it partial` is the kind of
assertion that passes for the wrong reason — if `run` returned early for any
unrelated cause, `partial` would still be true. Temporarily change `WALL_MS` to
`90_000_000` and re-run.

Expected: **that test fails** with `expected true to be false` (or a length
assertion), and `one search per position, at MultiPV 1` still passes. Restore
`WALL_MS` and re-run: all green.

- [ ] **Step 7: Replace the measured constants**

Edit `DEPTH_COST` to the `ratioToDepth14` figures Task 12 printed. Then append
this test to `src/review/AnalysisService.test.ts`:

```ts
import { DEPTH_COST, LADDER } from './AnalysisService';

test('the ladder costs less at every step down', () => {
  for (let i = 1; i < LADDER.length; i += 1) {
    expect(DEPTH_COST[LADDER[i]]).toBeLessThan(DEPTH_COST[LADDER[i - 1]]);
    expect(DEPTH_COST[LADDER[i]]).toBeGreaterThan(0);
  }
  expect(DEPTH_COST[14]).toBe(1);
});
```

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/AnalysisService.test.ts`
Expected: `10 passed`. The test asserts the **shape** rather than the literals,
because the literals are a property of the machine that measured them.

- [ ] **Step 8: Typecheck, lint, full suite, commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test && \
git add src/review/AnalysisService.ts src/review/AnalysisService.test.ts && \
git commit -m "feat(review): the analysis pass, with a runtime depth ladder (F-RV-1)"
```

---

### Task 14: The deeper key-moment pass, against the real engine

**Files:**
- Modify: `src/review/AnalysisService.test.ts` (append one integration test)

A fake engine proves the service's control flow. It says nothing about whether
MultiPV 2 actually returns two lines, which is the whole basis of Great and
Brilliant.

- [ ] **Step 1: Write the integration test**

Append to `src/review/AnalysisService.test.ts`:

```ts
import { EngineClient } from '@/engine';
import { createRequire } from 'node:module';

/**
 * Drives the SHIPPED engine binary. Slow by unit-test standards (a few seconds)
 * and therefore worth it exactly once: everything else in this feature assumes
 * MultiPV 2 yields a second line, and nothing else checks it.
 */
test('the real engine returns two ordered lines at MultiPV 2', async () => {
  const require = createRequire(import.meta.url);
  const initEngine = require('stockfish');
  const engine = await initEngine(require.resolve('stockfish/bin/stockfish-19-lite-single.js'));

  const listeners: ((s: string) => void)[] = [];
  engine.listener = (l: string) => listeners.forEach((f) => f(l));

  const client = new EngineClient(() => ({
    postMessage: (m: string) => engine.sendCommand(m),
    terminate: () => {},
    onmessage: null,
    set onmessageHook(_v: unknown) {},
  }) as never);

  // The line above is a placeholder shape. Build the WorkerLike adapter to match
  // src/engine/EngineClient.ts's `WorkerLike` interface exactly — read that
  // interface and wire `onmessage` so the client receives every engine line.

  const a = await client.analyse({
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    depth: 12,
    multiPv: 2,
  });
  expect(a.lines.length).toBe(2);
  expect(a.lines[0].move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  expect(a.lines[1].move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  expect(a.lines[0].move).not.toBe(a.lines[1].move);
  client.dispose();
}, 60_000);
```

- [ ] **Step 2: Make the adapter real**

The `WorkerLike` shape above is deliberately incomplete — fill it in from the
interface as shipped:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n "/export interface WorkerLike/,/^}/p" src/engine/EngineClient.ts
```

Write an adapter whose `postMessage` forwards to `engine.sendCommand` and whose
`onmessage` is invoked with `{ data: line }` for every line the engine emits.
Look at `src/engine/EngineClient.test.ts` first — it already builds a fake
`WorkerLike` and the same shape works here with a real engine behind it.

- [ ] **Step 3: Run it**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/AnalysisService.test.ts -t "real engine"`
Expected: `1 passed`, in under 10 seconds.

If `a.lines.length` is 1 rather than 2, MultiPV is not reaching the engine, and
**Great and Brilliant cannot ship** — stop and report, because that invalidates
spec §5.2 overrides 3 and 4, not just this test.

- [ ] **Step 4: Confirm the position really has two distinct replies**

The assertion `lines[0].move !== lines[1].move` is satisfied by any position
with two legal moves, so it does not prove MultiPV is working — a bug that
returned the same line twice would fail it, but a bug that returned one line
would fail the length assertion instead. That pairing is the point: keep both.

- [ ] **Step 5: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/AnalysisService.test.ts && \
git commit -m "test(review): prove MultiPV 2 against the shipped engine"
```

**Chunk C ends here.**

---

## Chunk D — Moments, errors, words (parallel with A, B, C)

**Reference for this chunk's review: PRD F-RV-4, F-RV-5, F-RV-6 and F-CO-4 read
directly**, plus the shipped `src/coach/CoachService.ts` and
`src/tagger/tagger.ts`. Not this plan.

### Task 15: Phase of the game

**Files:**
- Create: `src/review/phase.ts`
- Create: `src/review/phase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/phase.test.ts`:

```ts
import { phaseOf, nonKingMaterial } from './phase';
import { START_FEN } from '@/rules';

test('material counts both sides and excludes kings', () => {
  // 8 pawns + 2 rooks + 2 knights + 2 bishops + 1 queen = 8 + 10 + 6 + 6 + 9 = 39 a side.
  expect(nonKingMaterial(START_FEN)).toBe(78);
});

test('the opening is the first ten moves, or while still in book', () => {
  expect(phaseOf({ ply: 0, fen: START_FEN, inBook: true })).toBe('opening');
  expect(phaseOf({ ply: 19, fen: START_FEN, inBook: false })).toBe('opening');
  // Out of the opening by ply count, but still theory: still the opening.
  expect(phaseOf({ ply: 24, fen: START_FEN, inBook: true })).toBe('opening');
});

test('the endgame is thin material, whatever the ply', () => {
  // Kings and a rook each.
  const thin = '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1';
  expect(phaseOf({ ply: 25, fen: thin, inBook: false })).toBe('endgame');
  // Two rooks a side plus pawns is still a middlegame by this rule.
});

test('everything else is the middlegame', () => {
  const mid = 'r1bq1rk1/pp2ppbp/2np1np1/8/2BNP3/2N1B3/PPP2PPP/R2Q1RK1 w - - 0 10';
  expect(phaseOf({ ply: 20, fen: mid, inBook: false })).toBe('middlegame');
});

test('a thin position inside the first ten moves is still the opening', () => {
  // The opening rule wins: a ten-move game that reached a bare-kings ending was
  // still in its opening, and calling it an endgame would put the error log's
  // phase counts somewhere nobody would look for them.
  const thin = '4k3/8/8/8/8/8/8/4K3 w - - 0 5';
  expect(phaseOf({ ply: 8, fen: thin, inBook: false })).toBe('opening');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/phase.test.ts`
Expected: fails to resolve `./phase`.

- [ ] **Step 3: Write the implementation**

Create `src/review/phase.ts`:

```ts
import { PIECE_VALUE, piecesOf } from '@/rules';
import type { Phase } from './types';

/**
 * The PRD names three phases (F-RV-3 "the phase in which the game turned",
 * F-RV-6 "phase") and defines none of them. These are the definitions, in one
 * place, so that the summary and the error log cannot drift apart.
 */

/** Twenty plies is the PRD's "first ten moves" (Appendix C, Book). */
export const OPENING_PLIES = 20;

/**
 * Both sides' non-king material in PIECE_VALUE points. The start position is 78.
 * Below this, it is an endgame: 26 is roughly "a rook and a couple of pawns each",
 * which is where king activity starts to be the main idea.
 */
export const ENDGAME_MATERIAL = 26;

export function nonKingMaterial(fen: string): number {
  let n = 0;
  for (const c of ['w', 'b'] as const) {
    for (const { piece } of piecesOf(fen, c)) {
      if (piece.type !== 'k') n += PIECE_VALUE[piece.type];
    }
  }
  return n;
}

export function phaseOf(at: { ply: number; fen: string; inBook: boolean }): Phase {
  if (at.inBook || at.ply < OPENING_PLIES) return 'opening';
  if (nonKingMaterial(at.fen) <= ENDGAME_MATERIAL) return 'endgame';
  return 'middlegame';
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/phase.test.ts`
Expected: `5 passed`. If `nonKingMaterial(START_FEN)` is not 78, print what
`piecesOf` returns for the start position and reconcile against
`src/rules/rules.ts` — the shipped `PIECE_VALUE` is the fact.

- [ ] **Step 5: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/phase.ts src/review/phase.test.ts && \
git commit -m "feat(review): one definition of the three phases"
```

---

### Task 16: Key-moment selection

**Files:**
- Create: `src/review/keyMoments.ts`
- Create: `src/review/keyMoments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/keyMoments.test.ts`:

```ts
import { selectKeyMoments, MAX_MOMENTS, MIN_MOMENTS } from './keyMoments';
import type { ReviewedMove } from './types';

function mv(o: Partial<ReviewedMove> & { ply: number }): ReviewedMove {
  return {
    san: 'e4',
    uci: 'e2e4',
    fenBefore: 'x',
    fenAfter: 'y',
    mover: 'w',
    best: { uci: 'e2e4', san: 'e4' },
    winBefore: 50,
    winAfterPlayed: 50,
    drop: 0,
    accuracy: 100,
    label: 'Good',
    book: false,
    phase: 'middlegame',
    ...o,
  };
}

test('only the learner’s own moves can be key moments', () => {
  const moves = [
    mv({ ply: 0, mover: 'w', drop: 40, winBefore: 60, winAfterPlayed: 20, label: 'Blunder' }),
    mv({ ply: 1, mover: 'b', drop: 50, winBefore: 60, winAfterPlayed: 10, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.every((m) => moves[m.ply].mover === 'w')).toBe(true);
});

test('the mistake that decided the game is the biggest drop that crossed 50', () => {
  const moves = [
    mv({ ply: 0, drop: 30, winBefore: 45, winAfterPlayed: 15, label: 'Blunder' }), // never above 50
    mv({ ply: 2, drop: 28, winBefore: 62, winAfterPlayed: 34, label: 'Blunder' }), // crossed
    mv({ ply: 4, drop: 35, winBefore: 40, winAfterPlayed: 5, label: 'Blunder' }), // bigger, never above 50
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'decided')?.ply).toBe(2);
});

test('a chance missed is the biggest drop from a winning position', () => {
  const moves = [
    mv({ ply: 0, drop: 5, winBefore: 50, winAfterPlayed: 45, label: 'Good' }),
    mv({ ply: 2, drop: 30, winBefore: 88, winAfterPlayed: 58, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'missed')?.ply).toBe(2);
});

test('a Miss label takes priority for the missed slot', () => {
  const moves = [
    mv({ ply: 0, drop: 18, winBefore: 60, winAfterPlayed: 42, label: 'Miss' }),
    mv({ ply: 2, drop: 30, winBefore: 88, winAfterPlayed: 58, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'missed')?.ply).toBe(0);
});

test('a good move the learner found is the biggest gain that was Best or Excellent', () => {
  const moves = [
    mv({ ply: 0, drop: 0, winBefore: 40, winAfterPlayed: 58, label: 'Best' }),
    mv({ ply: 2, drop: 0, winBefore: 50, winAfterPlayed: 52, label: 'Best' }),
    mv({ ply: 4, drop: 30, winBefore: 60, winAfterPlayed: 30, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'found')?.ply).toBe(0);
});

test('a book move is never a key moment, however large the swing', () => {
  const moves = [
    mv({ ply: 0, drop: 40, winBefore: 70, winAfterPlayed: 30, label: 'Book', book: true }),
    mv({ ply: 2, drop: 12, winBefore: 55, winAfterPlayed: 43, label: 'Mistake' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.some((m) => m.ply === 0)).toBe(false);
});

test('at most five moments, filled by descending swing', () => {
  const moves = Array.from({ length: 20 }, (_, i) =>
    mv({ ply: i * 2, drop: 30 - i, winBefore: 60, winAfterPlayed: 60 - (30 - i), label: 'Blunder' }),
  );
  const k = selectKeyMoments(moves, 'w');
  expect(k).toHaveLength(MAX_MOMENTS);
  // The five biggest swings, in ply order.
  expect(k.map((m) => m.ply)).toEqual([0, 2, 4, 6, 8]);
});

test('moments come back in ply order, not selection order', () => {
  const moves = [
    mv({ ply: 0, drop: 2, winBefore: 40, winAfterPlayed: 55, label: 'Best' }),
    mv({ ply: 2, drop: 30, winBefore: 62, winAfterPlayed: 32, label: 'Blunder' }),
    mv({ ply: 4, drop: 25, winBefore: 88, winAfterPlayed: 63, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.map((m) => m.ply)).toEqual([...k.map((m) => m.ply)].sort((a, b) => a - b));
});

test('no moment is selected twice under two kinds', () => {
  const moves = [mv({ ply: 0, drop: 40, winBefore: 90, winAfterPlayed: 50, label: 'Blunder' })];
  const k = selectKeyMoments(moves, 'w');
  expect(new Set(k.map((m) => m.ply)).size).toBe(k.length);
});

test('a clean short game yields fewer than the floor rather than padding', () => {
  const moves = [mv({ ply: 0, drop: 0, label: 'Best' }), mv({ ply: 2, drop: 0.5, label: 'Excellent' })];
  const k = selectKeyMoments(moves, 'w');
  expect(k.length).toBeLessThan(MIN_MOMENTS);
  // And nothing with a zero swing is presented as a "moment".
  expect(k.every((m) => m.kind === 'found')).toBe(true);
});

test('a game with no learner moves at all yields nothing', () => {
  expect(selectKeyMoments([mv({ ply: 1, mover: 'b', drop: 40 })], 'w')).toEqual([]);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/keyMoments.test.ts`
Expected: fails to resolve `./keyMoments`.

- [ ] **Step 3: Write the implementation**

Create `src/review/keyMoments.ts`:

```ts
import type { Color } from '@/rules';
import type { KeyMoment, MomentKind, ReviewedMove } from './types';

/**
 * PRD F-RV-4: "Three to five moments chosen by the size of the swing in
 * expected score, with at least one of each kind where present, a good move the
 * learner found, a chance the learner missed, and the mistake that decided the
 * game."
 *
 * Only the learner's moves are candidates. The opponent is a bot; its blunders
 * are not the learner's moments.
 */

export const MAX_MOMENTS = 5;
export const MIN_MOMENTS = 3;

/** Below this, a "swing" is engine noise rather than a moment. */
const MIN_SWING = 3;
/** "A chance the learner missed": a position that was close to won. */
const WINNING_WIN_PERCENT = 80;

export function selectKeyMoments(moves: ReviewedMove[], learner: Color): KeyMoment[] {
  const mine = moves.filter((m) => m.mover === learner && !m.book);
  const chosen = new Map<number, MomentKind>();

  const take = (m: ReviewedMove | undefined, kind: MomentKind) => {
    if (m && !chosen.has(m.ply)) chosen.set(m.ply, kind);
  };

  const biggestBy = (
    pool: ReviewedMove[],
    score: (m: ReviewedMove) => number,
  ): ReviewedMove | undefined =>
    pool.reduce<ReviewedMove | undefined>(
      (best, m) => (best === undefined || score(m) > score(best) ? m : best),
      undefined,
    );

  // 1. The mistake that decided the game: the biggest drop that took a position
  //    the learner was not losing into one they were.
  take(
    biggestBy(
      mine.filter((m) => m.winBefore > 50 && m.winAfterPlayed < 50 && m.drop >= MIN_SWING),
      (m) => m.drop,
    ),
    'decided',
  );

  // 2. A chance missed. A Miss label says the opponent had just erred, which is
  //    the sharper version of the idea, so it goes first.
  const misses = mine.filter((m) => m.label === 'Miss');
  take(
    misses.length > 0
      ? biggestBy(misses, (m) => m.drop)
      : biggestBy(
          mine.filter((m) => m.winBefore >= WINNING_WIN_PERCENT && m.winAfterPlayed < WINNING_WIN_PERCENT && m.drop >= MIN_SWING),
          (m) => m.drop,
        ),
    'missed',
  );

  // 3. A good move the learner found: the biggest improvement in the learner's
  //    own standing, among moves that were actually good.
  take(
    biggestBy(
      mine.filter((m) => (m.label === 'Best' || m.label === 'Excellent') && m.winAfterPlayed > m.winBefore),
      (m) => m.winAfterPlayed - m.winBefore,
    ),
    'found',
  );

  // 4. Fill to MAX_MOMENTS by descending swing.
  const bySwing = [...mine].filter((m) => m.drop >= MIN_SWING).sort((a, b) => b.drop - a.drop);
  for (const m of bySwing) {
    if (chosen.size >= MAX_MOMENTS) break;
    take(m, 'swing');
  }

  return [...chosen.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_MOMENTS)
    .map(([ply, kind]) => ({ ply, kind, deeper: null, explanation: null, lessonId: null }));
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/keyMoments.test.ts`
Expected: `11 passed`.

If `at most five moments, filled by descending swing` fails on the expected ply
list, print the actual list before changing anything: the fixture's swings
descend with `i`, so the five biggest are plies 0, 2, 4, 6, 8, and a different
answer means the sort or the `slice` is wrong, not the expectation.

- [ ] **Step 5: Confirm the cap is a cap and not a coincidence**

`expect(k).toHaveLength(MAX_MOMENTS)` is satisfied by a bug that always returns
five. Temporarily change `MAX_MOMENTS` to 3 and re-run.

Expected: that test fails with `expected length 3 to be 5` **and**
`a clean short game yields fewer than the floor rather than padding` still
passes. Restore it.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/keyMoments.ts src/review/keyMoments.test.ts && \
git commit -m "feat(review): pick three to five key moments (F-RV-4)"
```

---

### Task 17: Themes and the error log

**Files:**
- Create: `src/review/errorLog.ts`
- Create: `src/review/errorLog.test.ts`

- [ ] **Step 1: Probe the tagger's real surface**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "^export " src/tagger/tagger.ts
```

Expected: `hangingPieces`, `winningCaptures`, `mateInOne`, `justCastled`,
`threatsAgainst`, `facts`, and the `Facts` / `HangingPiece` / `CaptureFact` /
`Threats` interfaces.

**This is the whole tagger.** PRD §10.3 lists sixteen motifs (fork, pin,
skewer, discovered attack, back-rank mate, deflection…). None of those exist
yet. The error log therefore tags what the tagger can verify and marks
everything else `'unclassified'` — it does **not** guess a motif, because
F-CO-4 forbids stating what has not been verified, and a wrong theme sends the
fix-it drill after the wrong idea.

- [ ] **Step 2: Write the failing test**

Create `src/review/errorLog.test.ts`:

```ts
import { themeOf, errorsFrom, THEME_LESSON, TYPICAL_THEMES } from './errorLog';
import type { ReviewedMove } from './types';

function mv(o: Partial<ReviewedMove> & { ply: number; fenBefore: string }): ReviewedMove {
  return {
    san: 'Qh5',
    uci: 'd1h5',
    fenAfter: 'x',
    mover: 'w',
    best: { uci: 'e2e4', san: 'e4' },
    winBefore: 60,
    winAfterPlayed: 30,
    drop: 30,
    accuracy: 20,
    label: 'Blunder',
    book: false,
    phase: 'middlegame',
    ...o,
  };
}

// White to move; Black's knight on e5 is free.
const FREE_KNIGHT = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1';
// White to move with mate in one: Qh5xf7 is not it here, so use a clean back-rank.
const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';

test('a move that leaves a piece hanging is tagged hanging_piece', () => {
  // After the move, one of the mover's own pieces can be taken for free.
  const t = themeOf({
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 1',
    playedUci: 'd1h5',
    bestUci: 'g1f3',
  });
  expect(typeof t).toBe('string');
});

test('missing a free capture is tagged missed_capture', () => {
  const t = themeOf({
    fenBefore: FREE_KNIGHT,
    fenAfter: FREE_KNIGHT.replace(' w ', ' b '),
    playedUci: 'a2a3',
    bestUci: 'f3e5',
  });
  expect(t).toBe('missed_capture');
});

test('missing a mate in one is tagged missed_mate', () => {
  const t = themeOf({
    fenBefore: MATE_IN_ONE,
    fenAfter: MATE_IN_ONE.replace(' w ', ' b '),
    playedUci: 'g1g2',
    bestUci: 'a1a8',
  });
  expect(t).toBe('missed_mate');
});

test('an error the tagger cannot verify is unclassified, never guessed', () => {
  const quiet = '8/8/4k3/8/8/4K3/8/8 w - - 0 1';
  expect(themeOf({ fenBefore: quiet, fenAfter: quiet.replace(' w ', ' b '), playedUci: 'e3d3', bestUci: 'e3e4' })).toBe(
    'unclassified',
  );
});

test('only mistakes, misses and blunders reach the log', () => {
  const moves: ReviewedMove[] = [
    mv({ ply: 0, fenBefore: FREE_KNIGHT, label: 'Blunder' }),
    mv({ ply: 2, fenBefore: FREE_KNIGHT, label: 'Mistake' }),
    mv({ ply: 4, fenBefore: FREE_KNIGHT, label: 'Miss' }),
    mv({ ply: 6, fenBefore: FREE_KNIGHT, label: 'Inaccuracy' }),
    mv({ ply: 8, fenBefore: FREE_KNIGHT, label: 'Good' }),
    mv({ ply: 10, fenBefore: FREE_KNIGHT, label: 'Book', book: true }),
  ];
  const errs = errorsFrom(moves, { gameId: 'g1', learner: 'w', timeControl: 'untimed', now: '2026-09-19T00:00:00.000Z' });
  expect(errs.map((e) => e.ply)).toEqual([0, 2, 4]);
});

test('the opponent’s errors are not the learner’s errors', () => {
  const moves: ReviewedMove[] = [
    mv({ ply: 0, fenBefore: FREE_KNIGHT, mover: 'w', label: 'Blunder' }),
    mv({ ply: 1, fenBefore: FREE_KNIGHT, mover: 'b', label: 'Blunder' }),
  ];
  const errs = errorsFrom(moves, { gameId: 'g1', learner: 'w', timeControl: 'untimed', now: '2026-09-19T00:00:00.000Z' });
  expect(errs).toHaveLength(1);
  expect(errs[0].ply).toBe(0);
});

test('every entry carries the fields F-RV-6 asks for', () => {
  const errs = errorsFrom([mv({ ply: 0, fenBefore: FREE_KNIGHT, label: 'Blunder' })], {
    gameId: 'g1',
    learner: 'w',
    timeControl: 'untimed',
    now: '2026-09-19T00:00:00.000Z',
  });
  const e = errs[0];
  expect(e.gameId).toBe('g1');
  expect(e.theme).toEqual(expect.any(String));
  expect(e.phase).toEqual(expect.any(String));
  expect(e.clockMs).toBeNull(); // untimed
  expect(e.bestUci).toBe('e2e4');
  expect(e.bestSan).toBe('e4');
  expect(typeof e.typical).toBe('boolean');
  expect(e.createdAt).toBe('2026-09-19T00:00:00.000Z');
});

test('a theme the Section 1 curriculum teaches is typical; one it does not is not', () => {
  for (const t of TYPICAL_THEMES) expect(TYPICAL_THEMES.includes(t)).toBe(true);
  expect(TYPICAL_THEMES.includes('unclassified')).toBe(false);
});

test('every typical theme maps to a lesson that exists in the curriculum', async () => {
  const { SECTION_1 } = await import('@/path/curriculum');
  const ids = new Set(SECTION_1.units.flatMap((u) => u.lessons.map((l) => l.id)));
  for (const theme of TYPICAL_THEMES) {
    const lesson = THEME_LESSON[theme];
    expect(lesson, `theme ${theme} has no lesson`).toBeTruthy();
    expect(ids.has(lesson!), `lesson ${lesson} for theme ${theme} is not in the curriculum`).toBe(true);
  }
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/errorLog.test.ts`
Expected: fails to resolve `./errorLog`.

- [ ] **Step 4: Write the implementation**

Create `src/review/errorLog.ts`:

```ts
import { facts, hangingPieces, mateInOne, winningCaptures } from '@/tagger';
import { applyMove, toSan, turn } from '@/rules';
import type { Color } from '@/rules';
import type { ErrorEntry, ReviewedMove } from './types';
import { phaseOf } from './phase';

/**
 * PRD F-RV-6: "Every mistake and blunder is written to the learner's error log
 * with its theme, phase, clock time, the lesson it maps to, and a flag for
 * whether the error is typical at the learner's level."
 *
 * PRD 10.3 lists sixteen motifs for the tagger. src/tagger/tagger.ts implements
 * four of them (hanging piece, winning capture, mate in one, threats), so this
 * module tags those four and marks everything else `unclassified`. It does not
 * guess: F-CO-4 forbids stating what has not been verified, and a wrong theme
 * points the fix-it drill at the wrong idea, which is worse than no theme.
 */

export const TYPICAL_THEMES = ['hung_piece', 'missed_capture', 'missed_mate', 'ignored_threat'] as const;
export type Theme = (typeof TYPICAL_THEMES)[number] | 'unclassified';

/**
 * The lesson each theme maps to (F-RV-6 "the lesson it maps to", F-RV-5 "linked
 * to the lesson that teaches the idea"). Ids are from src/path/curriculum.ts and
 * a test asserts every one of them exists.
 */
export const THEME_LESSON: Record<Theme, string | null> = {
  hung_piece: '1.3.1',
  missed_capture: '1.3.2',
  missed_mate: '1.4.1',
  ignored_threat: '1.3.3',
  unclassified: null,
};

export function themeOf(at: { fenBefore: string; fenAfter: string; playedUci: string; bestUci: string }): Theme {
  const mover = turn(at.fenBefore);

  // 1. Did the best move take a free piece the learner left alone?
  const free = winningCaptures(at.fenBefore);
  if (free.length > 0 && free.some((c) => c.uci === at.bestUci)) return 'missed_capture';

  // 2. Was there a mate in one the learner did not play?
  const mate = mateInOne(at.fenBefore);
  if (mate !== null && toSan(at.fenBefore, at.playedUci) !== mate) return 'missed_mate';

  // 3. Did the move leave one of the learner's own pieces free to take?
  const hangingAfter = hangingPieces(at.fenAfter, mover);
  const hangingBefore = hangingPieces(at.fenBefore, mover);
  if (hangingAfter.length > hangingBefore.length) return 'hung_piece';

  // 4. Was there a threat against the learner that the move did not answer?
  const before = facts(at.fenBefore);
  if (before.threats.captures.length > 0) {
    const stillThreatened = facts(at.fenAfter).captures.length > 0;
    if (stillThreatened) return 'ignored_threat';
  }

  return 'unclassified';
}

export function errorsFrom(
  moves: ReviewedMove[],
  ctx: { gameId: string; learner: Color; timeControl: 'untimed' | '10+0'; now: string },
): ErrorEntry[] {
  const out: ErrorEntry[] = [];
  for (const m of moves) {
    if (m.mover !== ctx.learner) continue;
    if (m.label !== 'Mistake' && m.label !== 'Blunder' && m.label !== 'Miss') continue;

    const theme = themeOf({
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      playedUci: m.uci,
      bestUci: m.best.uci,
    });

    out.push({
      gameId: ctx.gameId,
      ply: m.ply,
      fenBefore: m.fenBefore,
      playedSan: m.san,
      bestSan: m.best.san,
      bestUci: m.best.uci,
      label: m.label,
      theme,
      phase: m.phase,
      // F-RV-6 asks for clock time. GameState.clockMs is never persisted
      // (src/play/useGame.ts writes no clock into game_finished), so this is
      // null for every game in this release and the field is kept for when it
      // is not. Recorded in the design spec, section 7.3.
      clockMs: null,
      lessonId: THEME_LESSON[theme],
      // "Typical at the learner's level" has no first-release source: F-RV-6
      // names the puzzle ladder, which does not exist. The honest substitute is
      // a statement about the curriculum, not about other learners. Design spec
      // section 9.6.
      typical: (TYPICAL_THEMES as readonly string[]).includes(theme),
      createdAt: ctx.now,
    });
  }
  return out;
}

/** Re-exported so callers do not need to reach into phase.ts as well. */
export { phaseOf, applyMove };
```

- [ ] **Step 5: Run and reconcile the theme tests against the real tagger**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/errorLog.test.ts`

Some of the theme fixtures above are likely to disagree with the shipped tagger:
`winningCaptures` is deliberately pessimistic and `threatsAgainst` returns an
empty result when the side to move is in check ("unknown", not "safe").

**Reconcile by printing what the tagger actually says**, never by loosening the
assertion:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
npx vitest run -t "missed_capture" --reporter=verbose 2>&1 | tail -30
```

Then adjust the **fixture FENs** until each one genuinely exhibits the motif the
test names, and re-run. A theme test that passes on a position that does not
contain the motif is worse than no test.

Expected when done: `9 passed`.

- [ ] **Step 6: Fix the lesson ids**

`every typical theme maps to a lesson that exists in the curriculum` will fail
if `1.3.1`, `1.3.2`, `1.3.3` or `1.4.1` are not real lesson ids. Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
node --input-type=module -e "
const m = await import('./src/path/curriculum.ts').catch(() => null);
" 2>/dev/null || grep -n "id: '1\." src/path/curriculum.ts
```

Read the real lesson ids and titles out of `src/path/curriculum.ts` and map each
theme to the lesson that actually teaches it. **The curriculum is the fact**;
the ids above are this plan's guess and are expected to need correction.

- [ ] **Step 7: Lint — the barrel re-export at the bottom**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run lint`

If `export { phaseOf, applyMove };` trips an unused-import or
no-useless-reexport rule, delete that line and have callers import from
`./phase` and `@/rules` directly. It is a convenience, not a requirement.

- [ ] **Step 8: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/errorLog.ts src/review/errorLog.test.ts && \
git commit -m "feat(review): the error log, tagged only with what the tagger verified (F-RV-6)"
```

---

### Task 18: Review coach templates

**Files:**
- Modify: `content/coach/templates.json`

- [ ] **Step 1: Probe the template contract**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n "/line(/,/^  }/p" src/coach/CoachService.ts && \
  node -e "const t=require('./content/coach/templates.json');console.log(Object.keys(t.templates).join(', '))"
```

Expected:

- `line()` substitutes `{placeholder}` and **throws**
  `coach template <event> missing fact <k>` when a fact is `undefined` or `''`.
  That throw is the honesty mechanism (F-CO-4) and must not be caught inside
  `CoachService`.
- `line()` returns `null` when `this.muted`. **The review must use an unmuted
  instance**: an explanation is content, not chatter, and a learner who muted
  the in-game coach has not asked for a review with no words in it.
- `CoachEvent = keyof typeof templates.templates`, so adding keys to this JSON
  extends the type automatically — no TypeScript change is needed.
- The existing keys are: `lessonIntro, correct, wrongAuthored, wrongEngine,
  reveal, hintPiece, hintSquare, takeaway, hang, missedCapture, goodCapture,
  castled, check, threatIgnored, mateAvailable, gameWon, gameLost, gameDrawn`.

- [ ] **Step 2: Add the review templates**

Add these keys to the `templates` object in `content/coach/templates.json`,
after `gameDrawn`. Every placeholder is a fact the review can verify; there is
no placeholder here that the engine or the tagger does not supply.

```json
    "reviewHungPiece": [
      "{playedSan} left your {pieceName} on {square} free to take. {bestSan} keeps it.",
      "After {playedSan}, your {pieceName} on {square} could be taken for nothing. {bestSan} was the move."
    ],
    "reviewMissedCapture": [
      "There was a free {pieceName} on {square} here. {bestSan} takes it.",
      "{bestSan} wins the {pieceName} on {square}. {playedSan} let it go."
    ],
    "reviewMissedMate": [
      "There was a checkmate here: {bestSan}.",
      "{bestSan} is mate. {playedSan} gave it up."
    ],
    "reviewIgnoredThreat": [
      "Your opponent was threatening something and {playedSan} did not answer it. {bestSan} does.",
      "{playedSan} ignored the threat. {bestSan} deals with it."
    ],
    "reviewUnclassified": [
      "{bestSan} was stronger than {playedSan} here.",
      "The engine prefers {bestSan} to {playedSan} in this position."
    ],
    "reviewGoodMove": [
      "{playedSan} was the best move here. Well found.",
      "{playedSan} is exactly right."
    ],
    "reviewLessonLink": [
      "This is the idea from {lessonTitle}. Replay it?",
      "{lessonTitle} covers this one. Want another look?"
    ],
    "reviewAsk": [
      "Something better than {playedSan} was available. Can you find it?",
      "You played {playedSan}. There was a stronger move — have a go."
    ]
```

- [ ] **Step 3: Confirm the JSON is still valid and the type widened**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  node -e "const t=require('./content/coach/templates.json');const k=Object.keys(t.templates);console.log(k.length, k.filter(x=>x.startsWith('review')).join(', '))" && \
  npm run typecheck
```

Expected: `26 reviewHungPiece, reviewMissedCapture, reviewMissedMate, reviewIgnoredThreat, reviewUnclassified, reviewGoodMove, reviewLessonLink, reviewAsk` and a silent typecheck.

- [ ] **Step 4: Check the content verifier still passes**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run verify:content`
Expected: whatever it printed at `481cd63`, unchanged. If it validates
`templates.json` against a schema and now fails, **read the schema** — a new key
may need declaring, and that is a real change to make rather than a reason to
drop a template.

- [ ] **Step 5: Run the coach's own tests**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/coach/CoachService.test.ts`
Expected: unchanged pass count. If a test enumerates the template keys, it will
fail on the new count — update the enumeration; do not remove the assertion.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add content/coach/templates.json && \
git commit -m "feat(coach): review templates, every placeholder a verified fact"
```

---

### Task 19: Explanations that cannot invent anything

**Files:**
- Create: `src/review/explain.ts`
- Create: `src/review/explain.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/explain.test.ts`:

```ts
import { CoachService } from '@/coach';
import { explainMoment } from './explain';
import type { ReviewedMove } from './types';

function mv(o: Partial<ReviewedMove> = {}): ReviewedMove {
  return {
    ply: 4,
    san: 'Qh5',
    uci: 'd1h5',
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 1',
    mover: 'w',
    best: { uci: 'g1f3', san: 'Nf3' },
    winBefore: 55,
    winAfterPlayed: 25,
    drop: 30,
    accuracy: 20,
    label: 'Blunder',
    book: false,
    phase: 'opening',
    ...o,
  };
}

// A deterministic coach: always the first template variant.
const coach = () => new CoachService(() => 0);

test('an explanation names the move played and the move that was better', () => {
  const t = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: null });
  expect(t).toContain('Nf3');
  expect(t).toContain('Qh5');
});

test('a hung piece explanation names the piece and the square', () => {
  const t = explainMoment(coach(), {
    move: mv(),
    theme: 'hung_piece',
    lessonTitle: null,
    hung: { pieceName: 'queen', square: 'h5' },
  });
  expect(t).toContain('queen');
  expect(t).toContain('h5');
});

test('a good move is praised, not explained away', () => {
  const t = explainMoment(coach(), { move: mv({ label: 'Best', drop: 0 }), theme: 'unclassified', lessonTitle: null });
  expect(t).toContain('Qh5');
  expect(t).not.toContain('stronger');
});

test('a lesson link is appended when there is a lesson, and not when there is not', () => {
  const withLesson = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: 'Forks' });
  expect(withLesson).toContain('Forks');
  const without = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: null });
  expect(without).not.toContain('Replay');
});

test('a missing fact yields null rather than an invented sentence', () => {
  // hung_piece needs pieceName and square. Withhold them.
  const t = explainMoment(coach(), { move: mv(), theme: 'hung_piece', lessonTitle: null });
  expect(t).toBeNull();
});

test('the underlying throw is real — CoachService is not being handed a default', () => {
  // The subject here is an error, so the error path must be the handled path.
  // If this does NOT throw, explainMoment is filling in a fact from somewhere
  // and F-CO-4 is broken.
  let threw = false;
  try {
    coach().line('reviewHungPiece', { playedSan: 'Qh5', bestSan: 'Nf3' });
  } catch (e) {
    threw = true;
    expect((e as Error).message).toMatch(/missing fact/);
  }
  expect(threw).toBe(true);
});

test('a muted coach still explains — muting the in-game coach is not muting the review', () => {
  const c = coach();
  c.muted = true;
  const t = explainMoment(c, { move: mv(), theme: 'unclassified', lessonTitle: null });
  expect(t).not.toBeNull();
});

test('an explanation is one to three sentences (F-RV-5)', () => {
  const t = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: 'Forks' })!;
  const sentences = t.split(/(?<=[.?!])\s+/).filter(Boolean);
  expect(sentences.length).toBeGreaterThanOrEqual(1);
  expect(sentences.length).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/explain.test.ts`
Expected: fails to resolve `./explain`.

- [ ] **Step 3: Write the implementation**

Create `src/review/explain.ts`:

```ts
import { CoachService } from '@/coach';
import type { CoachEvent } from '@/coach';
import type { ReviewedMove } from './types';
import type { Theme } from './errorLog';

/**
 * PRD F-RV-5 and F-CO-4.
 *
 * The only sentences this can produce are the ones in
 * content/coach/templates.json, filled from facts supplied by the caller. When
 * a fact is missing, CoachService throws and this returns null: the key moment
 * then renders WITHOUT an explanation rather than with a plausible one. That is
 * the whole design — an explanation the engine did not verify is worse than
 * silence, because the learner cannot tell the difference.
 *
 * A muted coach still explains. `muted` is the in-game chatter setting; a
 * learner who turned that off did not ask for a wordless review.
 */

export interface ExplainInput {
  move: ReviewedMove;
  theme: Theme;
  /** The title of the lesson that teaches the idea, or null. */
  lessonTitle: string | null;
  /** Only when the theme is hung_piece: the piece and where it stands. */
  hung?: { pieceName: string; square: string };
  /** Only when the theme is missed_capture: what was free and where. */
  free?: { pieceName: string; square: string };
}

const THEME_EVENT: Record<Theme, CoachEvent> = {
  hung_piece: 'reviewHungPiece',
  missed_capture: 'reviewMissedCapture',
  missed_mate: 'reviewMissedMate',
  ignored_threat: 'reviewIgnoredThreat',
  unclassified: 'reviewUnclassified',
};

export function explainMoment(coach: CoachService, input: ExplainInput): string | null {
  const wasMuted = coach.muted;
  coach.muted = false;
  try {
    const facts: Record<string, string | number | undefined> = {
      playedSan: input.move.san,
      bestSan: input.move.best.san,
      pieceName: input.hung?.pieceName ?? input.free?.pieceName,
      square: input.hung?.square ?? input.free?.square,
    };

    const good = input.move.label === 'Best' || input.move.label === 'Excellent' || input.move.label === 'Great' || input.move.label === 'Brilliant';
    const event: CoachEvent = good ? 'reviewGoodMove' : THEME_EVENT[input.theme];

    const body = coach.line(event, facts);
    if (body === null) return null;

    if (input.lessonTitle === null) return body;
    const link = coach.line('reviewLessonLink', { lessonTitle: input.lessonTitle });
    return link === null ? body : `${body} ${link}`;
  } catch {
    // CoachService threw because a template needed a fact nobody verified.
    // F-CO-4: say nothing rather than something.
    return null;
  } finally {
    coach.muted = wasMuted;
  }
}

/** PRD F-RV-4: the question asked before the answer is revealed. */
export function askForBetter(coach: CoachService, move: ReviewedMove): string | null {
  const wasMuted = coach.muted;
  coach.muted = false;
  try {
    return coach.line('reviewAsk', { playedSan: move.san });
  } catch {
    return null;
  } finally {
    coach.muted = wasMuted;
  }
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/explain.test.ts`
Expected: `8 passed`.

If `a good move is praised, not explained away` fails because the
`reviewGoodMove` template happens to contain the word "stronger", change the
**assertion** to name a word that only the wrong branch would produce — the
point is that the good-move branch was taken, and any string that discriminates
between the two branches will do.

- [ ] **Step 5: Prove the null path is reachable**

`a missing fact yields null rather than an invented sentence` is the assertion
this whole design rests on. Prove it can fail: temporarily change the `catch`
block to `return 'something plausible';` and re-run.

Expected: that test fails with `expected 'something plausible' to be null`, and
`an explanation names the move played and the move that was better` still
passes. Restore the `catch`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/explain.ts src/review/explain.test.ts && \
git commit -m "feat(review): explanations from verified facts, or nothing (F-RV-5, F-CO-4)"
```

---

### Task 20: A property test — no explanation ever contains an unverified claim

**Files:**
- Modify: `src/review/explain.test.ts` (append)

A per-case test proves the cases somebody thought of. This proves the property.

- [ ] **Step 1: Write the test**

Append to `src/review/explain.test.ts`:

```ts
import templates from '@content/coach/templates.json';
import type { Theme } from './errorLog';

test('every review template only uses placeholders the review can verify', () => {
  // The complete set of facts explainMoment and askForBetter ever supply.
  const SUPPLIED = new Set(['playedSan', 'bestSan', 'pieceName', 'square', 'lessonTitle']);
  const reviewKeys = Object.keys(templates.templates).filter((k) => k.startsWith('review'));
  expect(reviewKeys.length).toBeGreaterThan(0); // the sweep must have inputs

  for (const key of reviewKeys) {
    for (const variant of (templates.templates as Record<string, string[]>)[key]) {
      for (const [, name] of variant.matchAll(/\{(\w+)\}/g)) {
        expect(SUPPLIED.has(name), `${key} uses {${name}}, which nothing verifies`).toBe(true);
      }
    }
  }
});

test('every theme has a template, and every one of them renders', () => {
  const themes: Theme[] = ['hung_piece', 'missed_capture', 'missed_mate', 'ignored_threat', 'unclassified'];
  expect(themes).toHaveLength(5); // lower bound: the sweep is not empty
  for (const theme of themes) {
    const t = explainMoment(coach(), {
      move: mv(),
      theme,
      lessonTitle: null,
      hung: { pieceName: 'queen', square: 'h5' },
      free: { pieceName: 'knight', square: 'e5' },
    });
    expect(t, `theme ${theme} produced no explanation with every fact supplied`).not.toBeNull();
  }
});
```

The `expect(reviewKeys.length).toBeGreaterThan(0)` and
`expect(themes).toHaveLength(5)` lines are not decoration. A sweep that finds
nothing passes silently, and a coverage check's failure mode is never a red
result — it is a narrower one.

- [ ] **Step 2: Run**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/explain.test.ts`
Expected: `10 passed`.

- [ ] **Step 3: Prove the sweep bites**

Temporarily add `"{winPercent} is the evaluation."` as a third variant of
`reviewUnclassified` in `content/coach/templates.json` and re-run.

Expected: `every review template only uses placeholders the review can verify`
fails with `reviewUnclassified uses {winPercent}, which nothing verifies`.
Remove the variant and re-run: green.

- [ ] **Step 4: Typecheck, lint, full suite, commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test && \
git add src/review/explain.test.ts && \
git commit -m "test(review): no template can name a fact the review does not verify"
```

**Chunk D ends here. Chunk E may start once A, B, C and D are all merged.**

---

## Chunk E — Screens (after A, B, C and D)

**Reference for this chunk's review: `docs/product/Wireframes-v1.1.png` screens
14, 15 and 16, and Concept-Note §7**, plus the shipped `src/board/Board.tsx` and
`src/lesson/LessonPlayer.tsx`. Not this plan.

### Task 21: Compose the review — accuracy, counts, turning phase

**Files:**
- Create: `src/review/buildReview.ts`
- Create: `src/review/buildReview.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/buildReview.test.ts`:

```ts
import { buildReview, judgeMoves } from './buildReview';
import type { AnalysedPosition } from './types';
import { positionsOf } from './gameSource';

const SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'];

function analysed(wins: number[]): AnalysedPosition[] {
  const { fens } = positionsOf(SANS);
  return wins.map((win, i) => ({ index: i, fen: fens[i], win, bestUci: 'a2a3', pv: ['a2a3'], depth: 14 }));
}

test('the mover’s win per cent after a move is 100 minus the next position’s', () => {
  // Position 0: white to move, 60. Position 1: black to move, 55, so white sits
  // at 45 after the move — a 15-point drop for white.
  const moves = judgeMoves({
    positions: analysed([60, 55, 50, 50, 50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  expect(moves[0].winBefore).toBe(60);
  expect(moves[0].winAfterPlayed).toBe(45);
  expect(moves[0].drop).toBe(15);
  expect(moves[0].mover).toBe('w');
  expect(moves[0].label).toBe('Mistake');
});

test('a move that improves the position has a drop of zero, never a negative one', () => {
  const moves = judgeMoves({
    positions: analysed([40, 30, 50, 50, 50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  // White was at 40; after the move black sits at 30, so white is at 70.
  expect(moves[0].winAfterPlayed).toBe(70);
  expect(moves[0].drop).toBe(0);
  expect(moves[0].label).toBe('Best');
});

test('a partial analysis judges only the moves it has both ends of', () => {
  // Five positions cover four moves, not eight.
  const moves = judgeMoves({
    positions: analysed([50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  expect(moves).toHaveLength(4);
});

test('accuracy is the mean over non-book moves, per side', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([60, 55, 55, 55, 55, 55, 55, 55, 55]),
    band: 1,
    book: { name: 'Italian Game', leftBookAtPly: 4, bookPlies: [true, true, true, true, false, false, false, false] },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.opening).toEqual({ name: 'Italian Game', leftBookAtPly: 4 });
  // Plies 0-3 are book and excluded from both sides' accuracy.
  expect(r.moves.filter((m) => m.book)).toHaveLength(4);
  expect(r.accuracy.w).not.toBeNull();
  expect(r.accuracy.b).not.toBeNull();
});

test('a side with no non-book moves has null accuracy, not 100', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: ['e4'], result: 'draw', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([50, 50]).slice(0, 2),
    band: 1,
    book: { name: "King's Pawn Game", leftBookAtPly: null, bookPlies: [true] },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.accuracy.w).toBeNull();
  expect(r.accuracy.b).toBeNull();
});

test('counts are per label and omit labels that did not occur', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([60, 55, 55, 55, 55, 55, 55, 55, 55]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  expect(total).toBe(r.moves.length);
  expect(r.counts.Brilliant).toBeUndefined();
});

test('the turning phase is where the learner’s biggest crossing of 50 happened', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'loss', timeControl: 'untimed', startedAt: 'x' },
    // White at 70; after ply 4 the position is lost.
    positions: analysed([70, 30, 70, 30, 70, 80, 20, 50, 50]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.turningPhase).toBe('opening'); // all within the first ten moves
});

test('a game that never turned reports null rather than guessing a phase', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'draw', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([52, 48, 52, 48, 52, 48, 52, 48, 52]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.turningPhase).toBeNull();
});

test('the review carries its depth and its partial flag through', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([50, 50, 50]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 10,
    partial: true,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.depth).toBe(10);
  expect(r.partial).toBe(true);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/buildReview.test.ts`
Expected: fails to resolve `./buildReview`.

- [ ] **Step 3: Write the implementation**

Create `src/review/buildReview.ts`:

```ts
import { moveAccuracy } from '@/engine';
import { toSan, turn } from '@/rules';
import type { Color } from '@/rules';
import type { AnalysedPosition, Band, MoveLabel, Phase, Review, ReviewedMove, ReviewSource } from './types';
import { isBadMove, labelMove } from './labels';
import { positionsOf } from './gameSource';
import { phaseOf } from './phase';
import { errorsFrom } from './errorLog';
import { selectKeyMoments } from './keyMoments';

/**
 * Turns a first pass into a Review (PRD F-RV-3).
 *
 * The one piece of arithmetic worth stating plainly: the engine reports a score
 * from the side-to-move's view, and the Lichess curve is symmetric about 50, so
 * the mover's standing AFTER their move is `100 - win(nextPosition)`. That is
 * why one search per position is enough — design spec section 1.5, C1.
 */

export interface JudgeInput {
  positions: AnalysedPosition[];
  sans: string[];
  band: Band;
  /** `bookPlies[i]` — was the position after ply i still in the book. */
  bookPlies: boolean[];
}

export function judgeMoves(input: JudgeInput): ReviewedMove[] {
  const { fens, ucis } = positionsOf(input.sans);
  const out: ReviewedMove[] = [];
  let previousWasBad = false;

  // A move needs the position before it AND the position after it. A partial
  // pass has one fewer judgeable move than it has analysed positions.
  const judgeable = Math.max(0, Math.min(input.positions.length - 1, input.sans.length));

  for (let ply = 0; ply < judgeable; ply += 1) {
    const before = input.positions[ply];
    const after = input.positions[ply + 1];
    const mover = turn(fens[ply]) as Color;
    const winBefore = before.win;
    const winAfterPlayed = 100 - after.win;
    const drop = Math.max(0, winBefore - winAfterPlayed);
    const book = input.bookPlies[ply] === true;

    const label: MoveLabel = labelMove({
      band: input.band,
      drop,
      playedIsBest: ucis[ply] === before.bestUci,
      book,
      opponentPreviousWasBadMove: previousWasBad,
      winBefore,
      winAfterPlayed,
      // Mate detection from the curve: scoreToWinPercent collapses mate to
      // 100/0, so a mover sitting at exactly 0 after their move, from a
      // position that was not already 0, has allowed one.
      mateAllowed: winAfterPlayed === 0 && winBefore > 0,
      moverWasMating: winBefore === 100,
      stillMating: winAfterPlayed === 100,
    });

    out.push({
      ply,
      san: input.sans[ply],
      uci: ucis[ply],
      fenBefore: fens[ply],
      fenAfter: fens[ply + 1],
      mover,
      best: { uci: before.bestUci, san: safeSan(fens[ply], before.bestUci) },
      winBefore,
      winAfterPlayed,
      drop,
      accuracy: moveAccuracy(drop),
      label,
      book,
      phase: phaseOf({ ply, fen: fens[ply], inBook: book }),
    });
    previousWasBad = isBadMove(label);
  }
  return out;
}

/**
 * The engine's best move should always be legal, but a partial info line or a
 * synthetic fallback (EngineClient emits `{ move: best, pv: [best] }` when no
 * info arrived) can produce something toSan rejects. Showing the UCI is honest;
 * throwing away the whole review is not.
 */
function safeSan(fen: string, uci: string): string {
  try {
    return toSan(fen, uci);
  } catch {
    return uci;
  }
}

export interface BuildInput {
  source: ReviewSource;
  positions: AnalysedPosition[];
  band: Band;
  book: { name: string | null; leftBookAtPly: number | null; bookPlies: boolean[] };
  depth: number;
  partial: boolean;
  now: string;
}

export function buildReview(input: BuildInput): Review {
  const moves = judgeMoves({
    positions: input.positions,
    sans: input.source.sans,
    band: input.band,
    bookPlies: input.book.bookPlies,
  });

  const counts: Partial<Record<MoveLabel, number>> = {};
  for (const m of moves) counts[m.label] = (counts[m.label] ?? 0) + 1;

  const meanFor = (c: Color): number | null => {
    const mine = moves.filter((m) => m.mover === c && !m.book);
    if (mine.length === 0) return null;
    return Number((mine.reduce((n, m) => n + m.accuracy, 0) / mine.length).toFixed(1));
  };

  return {
    gameId: input.source.gameId,
    learner: input.source.learner,
    depth: input.depth,
    partial: input.partial,
    moves,
    accuracy: { w: meanFor('w'), b: meanFor('b') },
    counts,
    opening: input.book.name === null ? null : { name: input.book.name, leftBookAtPly: input.book.leftBookAtPly },
    turningPhase: turningPhaseOf(moves, input.source.learner),
    keyMoments: selectKeyMoments(moves, input.source.learner),
    errors: errorsFrom(moves, {
      gameId: input.source.gameId,
      learner: input.source.learner,
      timeControl: input.source.timeControl,
      now: input.now,
    }),
    createdAt: input.now,
  };
}

/**
 * PRD F-RV-3, "the phase in which the game turned". Null when nothing crossed
 * the line — a game that stayed level never turned, and naming a phase anyway
 * would be a claim about a thing that did not happen.
 */
export function turningPhaseOf(moves: ReviewedMove[], learner: Color): Phase | null {
  const crossings = moves.filter(
    (m) => m.mover === learner && !m.book && m.winBefore > 50 && m.winAfterPlayed < 50,
  );
  if (crossings.length === 0) return null;
  return crossings.reduce((a, b) => (b.drop > a.drop ? b : a)).phase;
}
```

- [ ] **Step 4: Run and reconcile**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/buildReview.test.ts`
Expected: `9 passed`.

`the mover's win per cent after a move is 100 minus the next position's` is the
load-bearing one. If it fails, **print `moves[0]` in full** before touching
anything: the sign convention is the single place this feature is most likely to
be wrong, and the symmetry it relies on was asserted in Task 8
(`100 - toWinPercent(cp) === toWinPercent(-cp)`).

- [ ] **Step 5: Prove the negation is real**

Change `const winAfterPlayed = 100 - after.win;` to `= after.win;` and re-run.

Expected: **at least three tests fail**, including
`a move that improves the position has a drop of zero, never a negative one`. If
fewer than two fail, the fixtures are symmetric about 50 and cannot discriminate
between the two implementations — move a fixture's numbers off 50 until they can.
Restore the line.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/buildReview.ts src/review/buildReview.test.ts && \
git commit -m "feat(review): compose the review — accuracy, counts, turning phase (F-RV-3)"
```

---

### Task 22: The label chip

**Files:**
- Create: `src/review/LabelChip.tsx`
- Create: `src/review/LabelChip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/review/LabelChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { LabelChip, LABEL_GLYPH } from './LabelChip';
import type { MoveLabel } from './types';

const ALL: MoveLabel[] = [
  'Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
];

test('every label has a glyph, and the set is the complete label set', () => {
  expect(ALL).toHaveLength(10); // lower bound: the sweep has inputs
  for (const l of ALL) expect(LABEL_GLYPH[l], `${l} has no glyph`).toBeTruthy();
  expect(Object.keys(LABEL_GLYPH).sort()).toEqual([...ALL].sort());
});

test('the glyphs are distinct, so the second channel actually discriminates', () => {
  expect(new Set(Object.values(LABEL_GLYPH)).size).toBe(ALL.length);
});

test('the accessible name is the label word, never the glyph', () => {
  for (const l of ALL) {
    const { unmount } = render(<LabelChip label={l} />);
    expect(screen.getByText(l)).toBeInTheDocument();
    unmount();
  }
});

test('the glyph is hidden from assistive technology', () => {
  render(<LabelChip label="Blunder" />);
  const glyph = screen.getByText(LABEL_GLYPH.Blunder, { ignore: 'script' });
  expect(glyph).toHaveAttribute('aria-hidden', 'true');
});

test('colour is never the only channel — the word is always rendered', () => {
  render(<LabelChip label="Mistake" />);
  // The word is present in the DOM, not conveyed by a class alone.
  expect(screen.getByText('Mistake')).toBeVisible();
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/LabelChip.test.tsx`
Expected: fails to resolve `./LabelChip`.

- [ ] **Step 3: Write the component**

Create `src/review/LabelChip.tsx`:

```tsx
import type { MoveLabel } from './types';

/**
 * PRD F-RV-2: "All icons and colours are the product's own design."
 *
 * Three channels per label: the WORD (always rendered, and the accessible
 * name), a distinct GLYPH (aria-hidden), and one of the three semantic colour
 * tokens the app already has. No new colour tokens: eight new hues would be
 * eight new obligations for tests/audit-platform/controls.spec.ts's contrast
 * sweep and would buy nothing the word and the glyph do not already carry.
 * Design spec section 5.4.
 */

export const LABEL_GLYPH: Record<MoveLabel, string> = {
  Brilliant: '!!',
  Great: '!',
  Best: '★',
  Excellent: '◆',
  Good: '✓',
  Book: '▤',
  Inaccuracy: '?!',
  Mistake: '?',
  Miss: '⊘',
  Blunder: '??',
};

const TONE: Record<MoveLabel, string> = {
  Brilliant: 'text-mark-good',
  Great: 'text-mark-good',
  Best: 'text-mark-good',
  Excellent: 'text-mark-good',
  Good: 'text-content',
  Book: 'text-content-dim',
  Inaccuracy: 'text-mark-review',
  Mistake: 'text-mark-review',
  Miss: 'text-danger',
  Blunder: 'text-danger',
};

export function LabelChip({ label }: { label: MoveLabel }) {
  return (
    <span className={`t-label inline-flex items-center gap-1 ${TONE[label]}`}>
      <span aria-hidden="true">{LABEL_GLYPH[label]}</span>
      <span>{label}</span>
    </span>
  );
}
```

- [ ] **Step 4: Confirm the colour classes exist**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "mark-good\|mark-review\|--danger\|--content-dim" src/app/theme.css | head -20 && \
  grep -rn "text-mark-good\|text-content-dim\|text-danger" src/ --include=*.tsx | head -5
```

Expected: the tokens exist in `theme.css` and at least one of the utility
classes is already in use elsewhere. **If `text-mark-good` is not a class the
Tailwind config generates**, look at how an existing component applies
`--mark-good` (`src/board/boardColors.ts` uses these tokens) and follow that
pattern instead — inventing a class name that resolves to nothing would leave a
label with no colour at all, which no test above would catch because the word
and glyph would still be there.

- [ ] **Step 5: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/LabelChip.test.tsx`
Expected: `5 passed`.

- [ ] **Step 6: Lint**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run lint`
Expected: exits 0.

**If it reports `react-refresh/only-export-components` for `LABEL_GLYPH`**, the
rule is configured as a warning and `--max-warnings 0` makes it fatal. The fix
is **not** to disable the rule: move `LABEL_GLYPH` and `TONE` into a new
`src/review/labelStyle.ts` and import them here. Update the test's import too.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/LabelChip.tsx src/review/LabelChip.test.tsx && \
git commit -m "feat(review): label chips with a word, a glyph and a tone"
```

---

### Task 23: The review hook — run, cache, deepen, bank

**Files:**
- Create: `src/review/useReview.ts`
- Create: `src/review/useReview.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/useReview.test.ts`:

```ts
import { reviewFor, deepenMoments, bankReview, materialSwing } from './useReview';
import type { Review } from './types';

/** A fake Dexie table with just the two methods the module uses. */
function fakeTable() {
  const rows = new Map<string, Review>();
  return {
    rows,
    get: async (k: string) => rows.get(k),
    put: async (r: Review) => {
      rows.set(r.gameId, r);
      return r.gameId;
    },
  };
}

const SANS = ['e4', 'e5', 'Nf3', 'Nc6'];

function fakeEngine() {
  return {
    analyse: async (req: { fen: string; depth: number; multiPv?: number }) => ({
      lines:
        (req.multiPv ?? 1) >= 2
          ? [
              { move: 'g1f3', pv: ['g1f3'], score: { cp: 30 }, depth: req.depth },
              { move: 'b1c3', pv: ['b1c3'], score: { cp: 10 }, depth: req.depth },
            ]
          : [{ move: 'g1f3', pv: ['g1f3'], score: { cp: 20 }, depth: req.depth }],
      depth: req.depth,
    }),
  };
}

const source = {
  gameId: 'g1',
  learner: 'w' as const,
  persona: 'rosa',
  sans: SANS,
  result: 'win' as const,
  timeControl: 'untimed' as const,
  startedAt: '2026-09-19T00:00:00.000Z',
};

test('a cached complete review is returned without touching the engine', async () => {
  const table = fakeTable();
  const cached = { gameId: 'g1', partial: false, moves: [], keyMoments: [] } as unknown as Review;
  await table.put(cached);
  let called = 0;
  const engine = { analyse: async () => { called += 1; throw new Error('should not be called'); } };
  const r = await reviewFor({ source, table, engine: engine as never, band: 1, book: null });
  expect(r.review).toBe(cached);
  expect(called).toBe(0);
});

test('a cached PARTIAL review is re-run, not served', async () => {
  const table = fakeTable();
  await table.put({ gameId: 'g1', partial: true, moves: [], keyMoments: [] } as unknown as Review);
  const r = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  expect(r.review.partial).toBe(false);
  expect(r.review.moves.length).toBeGreaterThan(0);
});

test('a completed review is written to the table', async () => {
  const table = fakeTable();
  await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  expect(table.rows.has('g1')).toBe(true);
});

test('deepenMoments fills each moment and leaves the rest alone', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  const filled = await deepenMoments(review, fakeEngine() as never, 16, 1);
  for (const m of filled.keyMoments) {
    expect(m.deeper).not.toBeNull();
    expect(m.deeper!.depth).toBe(16);
    expect(m.deeper!.secondWin).not.toBeNull();
  }
});

test('a moment with only one legal reply gets a null secondWin, not a fabricated one', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  const oneLine = { analyse: async (req: { depth: number }) => ({ lines: [{ move: 'g1f3', pv: ['g1f3'], score: { cp: 30 }, depth: req.depth }], depth: req.depth }) };
  const filled = await deepenMoments(review, oneLine as never, 16, 1);
  for (const m of filled.keyMoments) expect(m.deeper?.secondWin).toBeNull();
});

test('the deeper pass is what applies Great — without it the label never appears', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  const before = review.keyMoments.map((m) => review.moves[m.ply].label);
  // A wide gap between the first and second lines makes every Best an only move.
  const wide = {
    analyse: async (req: { depth: number; multiPv?: number }) => ({
      lines: [
        { move: 'g1f3', pv: ['g1f3'], score: { cp: 400 }, depth: req.depth },
        { move: 'b1c3', pv: ['b1c3'], score: { cp: -400 }, depth: req.depth },
      ],
      depth: req.depth,
    }),
  };
  const filled = await deepenMoments(review, wide as never, 16, 1);
  const after = filled.keyMoments.map((m) => filled.moves[m.ply].label);
  // At least one label changed, and nothing outside the key moments moved.
  expect(after).not.toEqual(before);
  filled.moves.forEach((m, i) => {
    if (!filled.keyMoments.some((k) => k.ply === i)) expect(m.label).toBe(review.moves[i].label);
  });
});

test('materialSwing is negative when the mover gives material away', () => {
  // White plays Qxd8?? losing the queen for nothing is hard to fixture briefly;
  // use a plain capture of a pawn, which is a POSITIVE swing for the mover.
  const before = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
  const after = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  expect(materialSwing(before, after, 'w')).toBeGreaterThan(0);
  // And negative from the other side's point of view.
  expect(materialSwing(before, after, 'b')).toBeLessThan(0);
});

test('banking a complete review produces exactly one payload', () => {
  const review = {
    gameId: 'g1',
    partial: false,
    accuracy: { w: 72.5, b: 60 },
    learner: 'w',
    counts: { Blunder: 2, Mistake: 3 },
  } as unknown as Review;
  const p = bankReview(review, true);
  expect(p).toEqual({
    type: 'game_reviewed',
    gameId: 'g1',
    accuracy: 72.5,
    blunders: 2,
    mistakes: 3,
    drillCompleted: true,
    partial: false,
  });
});

test('a partial review cannot be banked', () => {
  const review = { gameId: 'g1', partial: true, accuracy: { w: 50, b: 50 }, learner: 'w', counts: {} } as unknown as Review;
  expect(bankReview(review, false)).toBeNull();
});

test('banking uses the learner’s own accuracy, not the opponent’s', () => {
  const review = { gameId: 'g1', partial: false, accuracy: { w: 30, b: 90 }, learner: 'b', counts: {} } as unknown as Review;
  expect(bankReview(review, false)!.accuracy).toBe(90);
});

test('a null accuracy banks as 0 rather than crashing or claiming 100', () => {
  const review = { gameId: 'g1', partial: false, accuracy: { w: null, b: null }, learner: 'w', counts: {} } as unknown as Review;
  expect(bankReview(review, false)!.accuracy).toBe(0);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/useReview.test.ts`
Expected: fails to resolve `./useReview`.

- [ ] **Step 3: Write the module**

Create `src/review/useReview.ts`:

```ts
import { scoreToWinPercent } from '@/engine';
import type { EventPayload } from '@/data';
import { PIECE_VALUE, applyMove, piecesOf } from '@/rules';
import type { Color } from '@/rules';
import { AnalysisService, type AnalysisEngine } from './AnalysisService';
import { buildReview } from './buildReview';
import { positionsOf } from './gameSource';
import { upgradeKeyMoment } from './labels';
import type { Band, KeyMoment, Review, ReviewSource } from './types';

/**
 * Orchestration for one review. No React in this file — it is a .ts module so
 * that eslint's react-refresh rule stays out of the way and so the whole flow
 * is testable without rendering anything.
 */

export interface ReviewTable {
  get(gameId: string): Promise<Review | undefined>;
  put(review: Review): Promise<unknown>;
}

export interface BookLookup {
  name: string | null;
  leftBookAtPly: number | null;
  bookPlies: boolean[];
}

export interface ReviewRun {
  review: Review;
  fromCache: boolean;
}

export async function reviewFor(args: {
  source: ReviewSource;
  table: ReviewTable;
  engine: AnalysisEngine;
  band: Band;
  book: BookLookup | null;
  onProgress?: (done: number, total: number) => void;
  service?: AnalysisService;
  now?: () => string;
}): Promise<ReviewRun> {
  const cached = await args.table.get(args.source.gameId);
  // A partial review is a promise the app has not kept yet, so it is re-run
  // rather than served. A complete one is derived data and never goes stale:
  // the same moves at the same depth give the same review.
  if (cached && !cached.partial) return { review: cached, fromCache: true };

  const { fens } = positionsOf(args.source.sans);
  const service = args.service ?? new AnalysisService(args.engine, { onProgress: args.onProgress });
  const run = await service.run(fens);

  const book: BookLookup = args.book ?? {
    name: null,
    leftBookAtPly: 0,
    bookPlies: args.source.sans.map(() => false),
  };

  const review = buildReview({
    source: args.source,
    positions: run.positions,
    band: args.band,
    book,
    depth: run.depth,
    partial: run.partial || run.cancelled || run.failed,
    now: (args.now ?? (() => new Date().toISOString()))(),
  });

  await args.table.put(review);
  return { review, fromCache: false };
}

/**
 * PRD F-RV-1: "Key moments are then re-analysed at a higher depth." Runs after
 * the summary is on screen, so it is outside the 60-second budget entirely
 * (design spec section 1.5, C2).
 */
export async function deepenMoments(
  review: Review,
  engine: AnalysisEngine,
  depth: number,
  band: Band,
): Promise<Review> {
  const service = new AnalysisService(engine);
  const moments: KeyMoment[] = [];
  const moves = [...review.moves];

  for (const m of review.keyMoments) {
    const move = moves[m.ply];
    if (!move) {
      moments.push(m);
      continue;
    }
    try {
      const a = await service.deepen(move.fenBefore, depth);
      const first = a.lines[0];
      const second = a.lines[1];
      const deeper = {
        depth,
        bestWin: scoreToWinPercent(first.score),
        // One legal move means no second line. Null says so; a fabricated
        // number would turn every forced move into a "Great" find.
        secondWin: second ? scoreToWinPercent(second.score) : null,
        bestUci: first.move,
        secondUci: second?.move ?? null,
      };
      moments.push({ ...m, deeper });

      // THIS is where Great and Brilliant are applied. Without it,
      // upgradeKeyMoment is dead code and two of Appendix C's labels never
      // appear, which no test of labels.ts alone would notice.
      const sacrifice = materialSwing(move.fenBefore, move.fenAfter, move.mover);
      moves[m.ply] = {
        ...move,
        label: upgradeKeyMoment({
          band,
          label: move.label,
          winBefore: move.winBefore,
          secondWin: deeper.secondWin,
          materialSacrificed: Math.max(0, -sacrifice),
          materialRegained: regainedInPv(move.fenAfter, first.pv, move.mover),
        }),
      };
    } catch {
      // The deeper pass is an enhancement. If the engine is gone, the moment
      // still renders from the first pass, without Great or Brilliant.
      moments.push(m);
    }
  }
  return { ...review, moves, keyMoments: moments };
}

/** Change in the mover's material, in PIECE_VALUE points, across one move. */
export function materialSwing(fenBefore: string, fenAfter: string, mover: Color): number {
  return balance(fenAfter, mover) - balance(fenBefore, mover);
}

function balance(fen: string, mover: Color): number {
  const other: Color = mover === 'w' ? 'b' : 'w';
  const side = (c: Color) =>
    piecesOf(fen, c).reduce((n, { piece }) => (piece.type === 'k' ? n : n + PIECE_VALUE[piece.type]), 0);
  return side(mover) - side(other);
}

/**
 * How much of a sacrifice the engine's own line gives straight back. Appendix C
 * says Brilliant needs material "given up and not immediately regained", so
 * "immediately" gets a number: the next four plies of the principal variation.
 */
export function regainedInPv(fenAfter: string, pv: string[], mover: Color): number {
  let fen = fenAfter;
  const start = balance(fen, mover);
  for (const uci of pv.slice(0, 4)) {
    try {
      fen = applyMove(fen, uci).fen;
    } catch {
      break;
    }
  }
  return Math.max(0, balance(fen, mover) - start);
}

/**
 * PRD 2.2 and F-RV-7c. Returns the event payload to append, or null when the
 * review must not count.
 *
 * The CALLER appends this before rendering any "done" heading — a screen that
 * states a fact must have banked the state that makes it true. Design spec
 * section 8.
 */
export function bankReview(review: Review, drillCompleted: boolean): EventPayload | null {
  if (review.partial) return null;
  const mine = review.learner === 'w' ? review.accuracy.w : review.accuracy.b;
  return {
    type: 'game_reviewed',
    gameId: review.gameId,
    accuracy: mine ?? 0,
    blunders: review.counts.Blunder ?? 0,
    mistakes: review.counts.Mistake ?? 0,
    drillCompleted,
    partial: false,
  };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/useReview.test.ts`
Expected: `9 passed`.

- [ ] **Step 5: Prove the cache check discriminates**

`a cached complete review is returned without touching the engine` and
`a cached PARTIAL review is re-run, not served` are the pair that pins the
behaviour. Change `if (cached && !cached.partial)` to `if (cached)` and re-run.

Expected: **`a cached PARTIAL review is re-run, not served` fails**, and the
other cache test still passes. Restore.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/useReview.ts src/review/useReview.test.ts && \
git commit -m "feat(review): run, cache, deepen and bank one review"
```

---

### Task 24: The summary screen

**Files:**
- Create: `src/review/Summary.tsx`
- Create: `src/review/Summary.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/review/Summary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Summary } from './Summary';
import type { Review } from './types';

function review(o: Partial<Review> = {}): Review {
  return {
    gameId: 'g1',
    learner: 'w',
    depth: 14,
    partial: false,
    moves: [],
    accuracy: { w: 72.5, b: 61.3 },
    counts: { Best: 10, Good: 5, Mistake: 3, Blunder: 2 },
    opening: { name: 'Italian Game', leftBookAtPly: 8 },
    turningPhase: 'middlegame',
    keyMoments: [
      { ply: 10, kind: 'decided', deeper: null, explanation: null, lessonId: null },
      { ply: 20, kind: 'missed', deeper: null, explanation: null, lessonId: null },
    ],
    errors: [],
    createdAt: '2026-09-19T00:00:00.000Z',
    ...o,
  };
}

test('accuracy is shown for both sides', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText(/72\.5/)).toBeVisible();
  expect(screen.getByText(/61\.3/)).toBeVisible();
});

test('a null accuracy renders an em dash, never a number', () => {
  render(<Summary review={review({ accuracy: { w: null, b: null } })} onStart={() => {}} />);
  expect(screen.queryByText(/100/)).not.toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('the opening name and the move it left book are both shown', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText(/Italian Game/)).toBeVisible();
  // Ply 8 is White's fifth move.
  expect(screen.getByText(/move 5/i)).toBeVisible();
});

test('a game that never left book says so rather than naming a move', () => {
  render(<Summary review={review({ opening: { name: 'Ruy Lopez', leftBookAtPly: null } })} onStart={() => {}} />);
  expect(screen.getByText(/never left/i)).toBeVisible();
});

test('a game with no opening name omits the line entirely', () => {
  render(<Summary review={review({ opening: null })} onStart={() => {}} />);
  expect(screen.queryByText(/left the book/i)).not.toBeInTheDocument();
});

test('each label that occurred is listed with its count and its word', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText('Blunder')).toBeVisible();
  expect(screen.getByText('Mistake')).toBeVisible();
  // A label that did not occur is not listed as zero.
  expect(screen.queryByText('Brilliant')).not.toBeInTheDocument();
});

test('the depth the review actually ran at is stated', () => {
  render(<Summary review={review({ depth: 10 })} onStart={() => {}} />);
  expect(screen.getByText(/depth 10/i)).toBeVisible();
});

test('a partial review says so and cannot be started as if complete', () => {
  render(<Summary review={review({ partial: true })} onStart={() => {}} />);
  expect(screen.getByText(/still analysing/i)).toBeVisible();
});

test('the number of moments is stated rather than padded to three', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText(/2 moments/i)).toBeVisible();
});

test('the primary action starts the first moment', async () => {
  const onStart = vi.fn();
  render(<Summary review={review()} onStart={onStart} />);
  await userEvent.click(screen.getByRole('button', { name: /first moment/i }));
  expect(onStart).toHaveBeenCalledOnce();
});

test('the label definitions are one tap away and name every label', async () => {
  render(<Summary review={review()} onStart={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /what do these mean/i }));
  for (const l of ['Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder']) {
    expect(screen.getAllByText(l).length).toBeGreaterThan(0);
  }
});

test('there is exactly one live region on this screen', () => {
  const { container } = render(<Summary review={review()} onStart={() => {}} />);
  expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/Summary.test.tsx`
Expected: fails to resolve `./Summary`.

- [ ] **Step 3: Write the component**

Create `src/review/Summary.tsx`:

```tsx
import { useState } from 'react';
import { btn } from '@/app/Button';
import { plural } from '@/app/plural';
import { LabelChip } from './LabelChip';
import type { MoveLabel, Review } from './types';

/**
 * PRD F-RV-3 and Wireframes screen 14. Concept-Note section 7: "accuracy for
 * both sides, the move at which the game left the opening book, a count of
 * moves by label, the phase where the game turned".
 *
 * Layout note: the counts are a WRAPPING LIST, not a fixed grid, because the
 * app must survive a 32px root without a horizontal scrollbar
 * (tests/audit-platform/reflow.spec.ts) and a grid of ten chips will not.
 */

const ORDER: MoveLabel[] = [
  'Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
];

const DEFINITION: Record<MoveLabel, string> = {
  Brilliant: 'A sound sacrifice from a position that was not already winning. Rare.',
  Great: 'The only move that kept the position from going badly wrong.',
  Best: 'The move the engine would play.',
  Excellent: 'As good as makes no difference.',
  Good: 'Fine. A small amount given away.',
  Book: 'A known opening move. Not judged.',
  Inaccuracy: 'A little loose. Something better was there.',
  Mistake: 'This cost real ground.',
  Miss: 'Your opponent slipped and this let them off.',
  Blunder: 'This changed the game.',
};

/** Ply 0 is White's move 1; ply 8 is White's move 5. */
function moveNumber(ply: number): number {
  return Math.floor(ply / 2) + 1;
}

export function Summary({ review, onStart }: { review: Review; onStart: () => void }) {
  const [showDefs, setShowDefs] = useState(false);
  const present = ORDER.filter((l) => (review.counts[l] ?? 0) > 0);
  const moments = review.keyMoments.length;

  return (
    <div className="mx-auto w-full max-w-xl p-4">
      <h1 className="t-display">Game review</h1>

      <p aria-live="polite" className="t-caption mt-1 text-content-dim">
        {review.partial
          ? 'Still analysing the last few moves. This review is not complete yet.'
          : `Analysed at depth ${review.depth}.`}
      </p>

      <section className="mt-4 rounded-xl border border-edge bg-surface-raised p-4" aria-labelledby="rv-acc">
        <h2 id="rv-acc" className="t-heading">Accuracy</h2>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="t-label text-content-dim">You</dt>
            <dd className="t-display-lg">{fmt(review.learner === 'w' ? review.accuracy.w : review.accuracy.b)}</dd>
          </div>
          <div>
            <dt className="t-label text-content-dim">Opponent</dt>
            <dd className="t-display-lg">{fmt(review.learner === 'w' ? review.accuracy.b : review.accuracy.w)}</dd>
          </div>
        </dl>
      </section>

      {review.opening && (
        <p className="t-body mt-4">
          {review.opening.name}
          {review.opening.leftBookAtPly === null
            ? ' — the game never left the book.'
            : ` — you left the book at move ${moveNumber(review.opening.leftBookAtPly)}.`}
        </p>
      )}

      <section className="mt-4" aria-labelledby="rv-counts">
        <h2 id="rv-counts" className="t-heading">Your moves</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {present.map((l) => (
            <li key={l} className="flex items-baseline gap-2">
              <span className="t-display">{review.counts[l]}</span>
              <LabelChip label={l} />
            </li>
          ))}
        </ul>
        <button type="button" className={`${btn.quiet} mt-2`} onClick={() => setShowDefs((v) => !v)}>
          What do these mean?
        </button>
        {showDefs && (
          <dl className="mt-2 rounded-xl border border-edge bg-surface-raised p-4">
            {ORDER.map((l) => (
              <div key={l} className="mt-2 first:mt-0">
                <dt><LabelChip label={l} /></dt>
                <dd className="t-caption text-content-dim">{DEFINITION[l]}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {review.turningPhase && (
        <p className="t-body mt-4">The game turned in the {review.turningPhase}.</p>
      )}

      <p className="t-body mt-4">
        {moments === 0
          ? 'Nothing in this game needed a second look.'
          : `${moments} ${plural(moments, 'moment', 'moments')} worth a second look.`}
      </p>

      {moments > 0 && (
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={onStart}>
          Start with the first moment
        </button>
      )}
    </div>
  );
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(1);
}
```

- [ ] **Step 4: Check `plural`'s real signature before trusting the call above**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  cat src/app/plural.ts
```

Adapt the `plural(...)` call to whatever it actually takes. If the signature
does not fit, inline `moments === 1 ? 'moment' : 'moments'` — the helper is a
convenience and this plan's guess at its arguments is exactly the kind of literal
that ages badly.

- [ ] **Step 5: Run and reconcile**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/Summary.test.tsx`
Expected: `12 passed`.

`there is exactly one live region on this screen` will fail if any shared
component you render also declares `aria-live`. If it does, remove the
`aria-live` from the paragraph above and route the message through the existing
region instead — two live regions on one screen is the defect, not the test.

Likewise, the typography classes (`t-display`, `t-heading`, `t-label`,
`t-body`, `t-caption`, `t-display-lg`) are assumed from `src/app/theme.css`.
Confirm with `grep -n "^\.t-" src/app/theme.css` and use the real names.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/Summary.tsx src/review/Summary.test.tsx && \
git commit -m "feat(review): the summary screen (F-RV-3, wireframe 14)"
```

---

### Task 25: The key-moment screen — retry before reveal

**Files:**
- Create: `src/review/KeyMomentView.tsx`
- Create: `src/review/KeyMomentView.test.tsx`

- [ ] **Step 1: Probe the Board's props**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n "/export interface BoardProps/,/^}/p" src/board/types.ts && \
  grep -n "export function Board" src/board/Board.tsx
```

Expected: `BoardProps` with `fen`, `orientation`, `mode`, `onMove`,
`highlights`, `arrows`, `replay`, `disabled`, `textEntry`, `announce`,
`onDragStart`, `onDragEnd`, and
`export function Board(props: BoardProps & { size?: number; decorative?: boolean; testId?: string })`.

**This is the only board.** It carries the keyboard cursor, the single live
region and the one tab stop. Do not build another.

- [ ] **Step 2: Write the failing test**

Create `src/review/KeyMomentView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyMomentView } from './KeyMomentView';
import type { KeyMoment, ReviewedMove } from './types';

const move: ReviewedMove = {
  ply: 10,
  san: 'Qh5',
  uci: 'd1h5',
  fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 1',
  mover: 'w',
  best: { uci: 'g1f3', san: 'Nf3' },
  winBefore: 55,
  winAfterPlayed: 25,
  drop: 30,
  accuracy: 20,
  label: 'Blunder',
  book: false,
  phase: 'opening',
};

const moment: KeyMoment = {
  ply: 10,
  kind: 'decided',
  deeper: null,
  explanation: 'Nf3 was stronger than Qh5 here.',
  lessonId: null,
};

const props = {
  move,
  moment,
  learner: 'w' as const,
  ask: 'You played Qh5. There was a stronger move — have a go.',
  index: 0,
  total: 3,
  onNext: () => {},
  onLesson: () => {},
};

test('the position shown is the one BEFORE the learner’s move', () => {
  render(<KeyMomentView {...props} />);
  // The board is given fenBefore. Assert through the board's own testId hook.
  expect(screen.getByTestId('review-board')).toHaveAttribute('data-fen', move.fenBefore);
});

test('the answer is not on screen until the learner asks or tries', () => {
  render(<KeyMomentView {...props} />);
  expect(screen.queryByText(/Nf3/)).not.toBeInTheDocument();
  expect(screen.getByText(/have a go/i)).toBeVisible();
});

test('a wrong try does not reveal the answer', async () => {
  render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: /^i tried a1a2$/i }).catch?.(() => null) ?? screen.getByTestId('review-board'));
  // Driving the board directly is brittle; the component exposes onMove through
  // the board. See Step 4 for the supported way to simulate this.
});

test('Show me reveals the better move and the explanation', async () => {
  render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.getByText(/Nf3/)).toBeVisible();
  expect(screen.getByText(/stronger than Qh5/)).toBeVisible();
});

test('a moment with no explanation reveals the move and says nothing else', async () => {
  render(<KeyMomentView {...props} moment={{ ...moment, explanation: null }} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.getByText(/Nf3/)).toBeVisible();
  // No invented sentence in place of the missing one.
  expect(screen.queryByText(/stronger/i)).not.toBeInTheDocument();
});

test('the lesson link appears only when the moment has a lesson', async () => {
  const { rerender } = render(<KeyMomentView {...props} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.queryByRole('button', { name: /replay/i })).not.toBeInTheDocument();
  rerender(<KeyMomentView {...props} moment={{ ...moment, lessonId: '1.3.1' }} />);
  expect(screen.getByRole('button', { name: /replay/i })).toBeVisible();
});

test('position in the run is stated', () => {
  render(<KeyMomentView {...props} />);
  expect(screen.getByText(/1 of 3/i)).toBeVisible();
});

test('Great and Brilliant are omitted while the deeper pass has not landed', async () => {
  render(<KeyMomentView {...props} move={{ ...move, label: 'Best' }} moment={{ ...moment, deeper: null }} />);
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  expect(screen.queryByText('Great')).not.toBeInTheDocument();
  expect(screen.queryByText('Brilliant')).not.toBeInTheDocument();
});

test('there is exactly one live region and one board on this screen', () => {
  const { container } = render(<KeyMomentView {...props} />);
  expect(container.querySelectorAll('[aria-live]').length).toBeLessThanOrEqual(1);
  expect(screen.getAllByTestId('review-board')).toHaveLength(1);
});
```

- [ ] **Step 3: Write the component**

Create `src/review/KeyMomentView.tsx`:

```tsx
import { useState } from 'react';
import { Board } from '@/board';
import type { BoardMove } from '@/board';
import { CoachBubble } from '@/coach';
import { btn } from '@/app/Button';
import type { Color } from '@/rules';
import { LabelChip } from './LabelChip';
import type { KeyMoment, ReviewedMove } from './types';

/**
 * PRD F-RV-4 and Wireframes screen 15.
 *
 * "At each moment the position is shown before the learner's move and the
 * learner is asked to find the better move (retry before reveal). 'Show me'
 * reveals the answer."
 *
 * The board is the SHARED Board: its keyboard cursor, its single live region
 * and its one tab stop. Nothing here adds a second of any of those.
 */

export function KeyMomentView({
  move,
  moment,
  learner,
  ask,
  index,
  total,
  onNext,
  onLesson,
}: {
  move: ReviewedMove;
  moment: KeyMoment;
  learner: Color;
  ask: string | null;
  index: number;
  total: number;
  onNext: () => void;
  onLesson: (lessonId: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [tries, setTries] = useState(0);
  const [announce, setAnnounce] = useState<string | undefined>(undefined);

  const onMove = (m: BoardMove) => {
    if (revealed) return;
    if (m.uci === move.best.uci) {
      setRevealed(true);
      setAnnounce(`${m.san} — that is the move.`);
      return;
    }
    setTries((n) => n + 1);
    setAnnounce(`${m.san} is not it. Try again, or choose Show me.`);
  };

  return (
    <div className="mx-auto w-full max-w-xl p-4">
      <p className="t-label text-content-dim">
        Moment {index + 1} of {total}
      </p>

      <Board
        testId="review-board"
        fen={move.fenBefore}
        orientation={learner}
        mode={revealed ? 'static' : 'play'}
        onMove={onMove}
        announce={announce}
        highlights={revealed ? { [move.uci.slice(2, 4) as never]: 'review' } : undefined}
      />

      <CoachBubble text={revealed ? moment.explanation : ask} tone={revealed ? 'neutral' : 'neutral'} />

      {revealed ? (
        <>
          <p className="t-body mt-3">
            The move was <strong>{move.best.san}</strong>. You played {move.san}.
          </p>
          <p className="mt-1">
            <LabelChip label={move.label} />
          </p>
          {moment.lessonId && (
            <button type="button" className={`${btn.secondary} mt-3 w-full`} onClick={() => onLesson(moment.lessonId!)}>
              Replay the lesson
            </button>
          )}
          <button type="button" className={`${btn.primary} mt-3 w-full`} onClick={onNext}>
            {index + 1 === total ? 'Finish' : 'Next moment'}
          </button>
        </>
      ) : (
        <>
          {tries > 0 && <p className="t-caption mt-2 text-content-dim">Not that one. Have another go.</p>}
          <button type="button" className={`${btn.secondary} mt-3 w-full`} onClick={() => setRevealed(true)}>
            Show me
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Fix the third test properly**

`a wrong try does not reveal the answer` as drafted reaches into the board and
is unrunnable. Replace it with one that drives the board the way the repo's own
board tests do:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "onMove\|getByTestId\|squareAt\|keyboard" src/lesson/LessonPlayer.board.test.tsx | head -20
```

Copy that file's technique for making a move (it exercises the same shared
`Board`), and write:

```tsx
test('a wrong try does not reveal the answer', async () => {
  render(<KeyMomentView {...props} />);
  // ...make a legal but wrong move using the technique from
  // src/lesson/LessonPlayer.board.test.tsx...
  expect(screen.queryByText(/Nf3/)).not.toBeInTheDocument();
  expect(screen.getByText(/another go/i)).toBeVisible();
});

test('the right move reveals without needing Show me', async () => {
  render(<KeyMomentView {...props} />);
  // ...make the move g1f3...
  expect(screen.getByText(/Nf3/)).toBeVisible();
});
```

Both are required. Without the second, the first passes for a component that
never reveals anything at all.

- [ ] **Step 5: Check `data-fen` really exists**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "data-fen\|testId" src/board/Board.tsx
```

If the Board does not set `data-fen`, the first test cannot assert what it
claims. **Do not add `data-fen` to `Board.tsx`** — that file belongs to no chunk
here. Assert the position some other way the Board already supports (for
example by the accessible description of a square that differs between
`fenBefore` and `fenAfter`), and note the substitution in the test's comment.

- [ ] **Step 6: Run and reconcile**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/KeyMomentView.test.tsx`
Expected: all tests pass once Steps 4 and 5 are settled.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/review/KeyMomentView.tsx src/review/KeyMomentView.test.tsx && \
git commit -m "feat(review): key moments with retry before reveal (F-RV-4)"
```

---

### Task 26: The fix-it drill, and banking the review

**Files:**
- Create: `src/review/FixItDrill.tsx`
- Create: `src/review/fixIt.ts`
- Create: `src/review/fixIt.test.ts`
- Create: `src/review/FixItDrill.test.tsx`

**Why this is in scope at all** — design spec §6 argues it. In one line: it is a
pure function from the error log to a `Lesson` object plus the shipped
`LessonPlayer`, so it costs no new infrastructure, and without it the error log
has no consumer and F-RV-7c's "completing the drill completes the review item"
has to be invented somewhere else anyway.

- [ ] **Step 1: Write the failing test for the drill builder**

Create `src/review/fixIt.test.ts`:

```ts
import { drillFrom, MIN_DRILL, MAX_DRILL } from './fixIt';
import type { ErrorEntry } from './types';

function err(o: Partial<ErrorEntry> = {}): ErrorEntry {
  return {
    gameId: 'g1',
    ply: 10,
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    playedSan: 'Qh5',
    bestSan: 'Nf3',
    bestUci: 'g1f3',
    label: 'Blunder',
    theme: 'hung_piece',
    phase: 'opening',
    clockMs: null,
    lessonId: '1.3.1',
    typical: true,
    createdAt: '2026-09-19T00:00:00.000Z',
    ...o,
  };
}

test('fewer than three errors means no drill at all', () => {
  expect(drillFrom([])).toBeNull();
  expect(drillFrom([err(), err({ ply: 12 })])).toBeNull();
});

test('three errors make a three-challenge drill', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })]);
  expect(d).not.toBeNull();
  expect(d!.challenges).toHaveLength(3);
  expect(d!.challenges.length).toBeGreaterThanOrEqual(MIN_DRILL);
});

test('more than five errors are capped at five, biggest first', () => {
  const errs = Array.from({ length: 9 }, (_, i) => err({ ply: i * 2 }));
  const d = drillFrom(errs);
  expect(d!.challenges).toHaveLength(MAX_DRILL);
});

test('each challenge is find_the_move on the position before the mistake', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })])!;
  for (const c of d.challenges) {
    expect(c.type).toBe('find_the_move');
    expect(c.fen).toBe(err().fenBefore);
    if (c.type === 'find_the_move') {
      expect(c.answer.moves).toContain('g1f3');
      expect(c.answer.moves).toContain('Nf3');
    }
  }
});

test('challenge ids are unique, so the player can key on them', () => {
  const d = drillFrom([err({ ply: 10 }), err({ ply: 12 }), err({ ply: 14 })])!;
  expect(new Set(d.challenges.map((c) => c.id)).size).toBe(3);
});

test('the drill carries no XP of its own', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })])!;
  expect(d.xp).toBe(0);
});

test('the suggested lesson is the one the most errors point at', () => {
  const d = drillFrom([
    err({ ply: 10, lessonId: '1.3.1' }),
    err({ ply: 12, lessonId: '1.3.2' }),
    err({ ply: 14, lessonId: '1.3.2' }),
  ])!;
  expect(d.suggestedLessonId).toBe('1.3.2');
});

test('no lesson is suggested when no error mapped to one', () => {
  const d = drillFrom([
    err({ ply: 10, lessonId: null, theme: 'unclassified' }),
    err({ ply: 12, lessonId: null, theme: 'unclassified' }),
    err({ ply: 14, lessonId: null, theme: 'unclassified' }),
  ])!;
  expect(d.suggestedLessonId).toBeNull();
});

test('the shape is a Lesson the shipped player accepts', async () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })])!;
  // Structural: every field LessonPlayer reads must be present.
  expect(d.id).toEqual(expect.any(String));
  expect(d.unit).toEqual(expect.any(String));
  expect(d.title).toEqual(expect.any(String));
  expect(d.card.idea).toEqual(expect.any(String));
  expect(Array.isArray(d.card.diagrams)).toBe(true);
  expect(Array.isArray(d.explain)).toBe(true);
  expect(d.takeaway).toEqual(expect.any(String));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/fixIt.test.ts`
Expected: fails to resolve `./fixIt`.

- [ ] **Step 3: Probe the Lesson shape before writing the builder**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n "/export interface Lesson/,/^}/p" src/lesson/types.ts && \
  sed -n "/type: 'find_the_move'/p" src/lesson/types.ts
```

Expected: `Lesson { id, unit, title, xp, card: { idea, diagrams, habit? }, explain[], challenges[], takeaway }`
and a `find_the_move` challenge carrying `{ id, fen, prompt, concept, hints?, reason?, answer: { moves: string[] }, wrong? }`.

**Everything the drill needs is already in `ErrorEntry`.** That is the whole
argument for building it now rather than waiting for a puzzle ladder.

- [ ] **Step 4: Write the builder**

Create `src/review/fixIt.ts`:

```ts
import type { Challenge, Lesson } from '@/lesson';
import type { ErrorEntry } from './types';

/**
 * PRD F-RV-7: "The review ends with a three-to-five-puzzle drill built from the
 * error log and a single suggested next lesson."
 *
 * SCOPE, stated plainly: F-RV-7 and PRD 6.1 describe "similar positions" drawn
 * from a puzzle ladder and scheduled at growing intervals. No puzzle ladder and
 * no scheduler exist (src/screens/PuzzlesScreen.tsx is a placeholder), so this
 * replays the learner's OWN positions from this game. That is retrieval
 * practice on the exact position they just got wrong — narrower than F-RV-7 and
 * honestly narrower. Design spec section 6.4 names the destination for the rest.
 */

export const MIN_DRILL = 3;
export const MAX_DRILL = 5;

export interface Drill extends Lesson {
  suggestedLessonId: string | null;
}

const PROMPT: Record<string, string> = {
  hung_piece: 'You left a piece to be taken here. Find the move that keeps it.',
  missed_capture: 'Something was free here. Take it.',
  missed_mate: 'There is a checkmate in one. Find it.',
  ignored_threat: 'Your opponent was threatening something. Deal with it.',
  unclassified: 'There was a better move here. Find it.',
};

/**
 * Returns null when there are fewer than MIN_DRILL errors. A two-question
 * "three to five puzzle drill" would have to lie in its own copy, and a review
 * of a clean game should end on the last key moment rather than on a stub.
 */
export function drillFrom(errors: ErrorEntry[]): Drill | null {
  if (errors.length < MIN_DRILL) return null;

  const picked = [...errors]
    .sort((a, b) => rank(b) - rank(a) || a.ply - b.ply)
    .slice(0, MAX_DRILL)
    .sort((a, b) => a.ply - b.ply);

  const challenges: Challenge[] = picked.map((e) => ({
    type: 'find_the_move',
    id: `fix-${e.gameId}-${e.ply}`,
    fen: e.fenBefore,
    prompt: PROMPT[e.theme] ?? PROMPT.unclassified,
    concept: e.theme,
    // Both notations, because the player accepts either and the learner may be
    // in text-entry mode.
    answer: { moves: [e.bestUci, e.bestSan] },
  }));

  return {
    id: `fix-${picked[0].gameId}`,
    unit: 'review',
    title: 'Fix it',
    // XP for a review is awarded once by the game_reviewed event. A drill that
    // also awarded XP would pay twice for one loop.
    xp: 0,
    card: { idea: 'The positions from this game where something went wrong. One move each.', diagrams: [] },
    explain: [],
    challenges,
    takeaway: 'Same positions, second chance. That is where the improvement comes from.',
    suggestedLessonId: mostCommonLesson(picked),
  };
}

/** Blunders before mistakes before misses; within a class, the later the worse. */
function rank(e: ErrorEntry): number {
  return e.label === 'Blunder' ? 3 : e.label === 'Miss' ? 2 : 1;
}

function mostCommonLesson(errors: ErrorEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const e of errors) if (e.lessonId) counts.set(e.lessonId, (counts.get(e.lessonId) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [id, c] of counts) if (c > n) { best = id; n = c; }
  return best;
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/fixIt.test.ts`
Expected: `9 passed`.

`more than five errors are capped at five` is satisfied by any bug that returns
five. Temporarily change `MAX_DRILL` to 4 and confirm that test fails with
`expected length 5 to be 4` while `three errors make a three-challenge drill`
still passes. Restore.

- [ ] **Step 6: Write the drill screen and its test**

Create `src/review/FixItDrill.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { FixItDrill } from './FixItDrill';
import { drillFrom } from './fixIt';
import type { ErrorEntry } from './types';

const errs: ErrorEntry[] = [10, 12, 14].map((ply) => ({
  gameId: 'g1',
  ply,
  fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
  playedSan: 'Qh5',
  bestSan: 'Nf3',
  bestUci: 'g1f3',
  label: 'Blunder',
  theme: 'hung_piece',
  phase: 'opening',
  clockMs: null,
  lessonId: '1.3.1',
  typical: true,
  createdAt: '2026-09-19T00:00:00.000Z',
}));

test('the drill renders through the shipped lesson player', () => {
  render(<FixItDrill drill={drillFrom(errs)!} onDone={() => {}} onLesson={() => {}} />);
  // The player's own card screen is what appears first.
  expect(screen.getByText(/Fix it/i)).toBeVisible();
});

test('no XP is claimed, because the review event awards it', () => {
  render(<FixItDrill drill={drillFrom(errs)!} onDone={() => {}} onLesson={() => {}} />);
  expect(screen.queryByText(/XP/i)).not.toBeInTheDocument();
});
```

Create `src/review/FixItDrill.tsx`:

```tsx
import { LessonPlayer } from '@/lesson';
import type { Drill } from './fixIt';

/**
 * PRD F-RV-7 and Wireframes screen 16.
 *
 * This is the whole drill: the shipped LessonPlayer, handed a Lesson built at
 * runtime. No new player, no new challenge type, no content pipeline.
 *
 * `onDone` is called from `onOutcome`, which the player fires exactly once when
 * the close screen is REACHED — not when it is dismissed. That is the banking
 * point: the review must be recorded before any screen says it is done. Design
 * spec section 8.
 */
export function FixItDrill({
  drill,
  onDone,
  onLesson,
}: {
  drill: Drill;
  onDone: () => void;
  onLesson: (lessonId: string) => void;
}) {
  return (
    <LessonPlayer
      lesson={drill}
      hintsAllowed={false}
      showXp={false}
      title="Fix it"
      exitLabel="Exit review"
      closeHeading="Review done"
      closeAction="Back to the path"
      onOutcome={onDone}
      onComplete={() => {
        if (drill.suggestedLessonId) onLesson(drill.suggestedLessonId);
      }}
      onExit={onDone}
    />
  );
}
```

- [ ] **Step 7: Run and reconcile against the real player**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/FixItDrill.test.tsx`

If the player throws on this `Lesson` — most likely on `card.diagrams` being
empty or `explain` being empty — read `src/lesson/LessonPlayer.tsx` and
`src/lesson/LessonMachine.ts` and give the drill the minimum those files
actually require. Then update `fixIt.ts` **and** the structural test in
`fixIt.test.ts` together, so the test keeps asserting the real contract.

- [ ] **Step 8: Confirm the banking point is `onOutcome`, not `onComplete`**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n -B3 -A6 "onOutcome" src/lesson/LessonPlayer.tsx
```

Expected: `onOutcome` fires once when `phase.kind === 'close'` is reached,
ref-guarded; `onComplete` fires when the learner dismisses that screen. If that
is reversed, swap the two props here — **the requirement is that the
`game_reviewed` event is appended before the "Review done" heading paints**, and
whichever callback fires first is the one to use.

- [ ] **Step 9: Typecheck, lint, full suite, commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test && \
git add src/review/fixIt.ts src/review/fixIt.test.ts src/review/FixItDrill.tsx src/review/FixItDrill.test.tsx && \
git commit -m "feat(review): a fix-it drill from the learner's own errors (F-RV-7, reduced scope)"
```

---

### Task 27: The review route component and the barrel

**Files:**
- Create: `src/review/ReviewScreen.tsx`
- Create: `src/review/ReviewScreen.test.tsx`
- Create: `src/review/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/review/ReviewScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ReviewScreen } from './ReviewScreen';

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/play/review/:gameId" element={<ReviewScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('the analysing state shows a progress bar with a readable quantity', async () => {
  at('/play/review/g1');
  const bar = await screen.findByRole('progressbar');
  expect(bar).toHaveAttribute('aria-valuemax');
  // A bar alone is not a readable quantity.
  expect(screen.getByText(/move \d+ of \d+/i)).toBeVisible();
});

test('an unknown game says so rather than showing an empty review', async () => {
  at('/play/review/does-not-exist');
  expect(await screen.findByText(/could not find that game/i)).toBeVisible();
});

test('the screen carries its own way out, as ModalTask requires', async () => {
  at('/play/review/g1');
  expect(await screen.findByRole('button', { name: /close|exit|back/i })).toBeVisible();
});

test('there is exactly one live region on the screen at a time', async () => {
  const { container } = at('/play/review/g1');
  await screen.findByRole('progressbar');
  expect(container.querySelectorAll('[aria-live]').length).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Write the component**

Create `src/review/ReviewScreen.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db, useProgress } from '@/data';
import { getEngine } from '@/engine';
import { CoachService } from '@/coach';
import { btn } from '@/app/Button';
import { reportError } from '@/analytics';
import { bandForUnit } from './bands';
import { drillFrom } from './fixIt';
import { positionsOf, sourceFromEvents } from './gameSource';
import { loadBook, lookupOpening } from './openingBook';
import { askForBetter, explainMoment } from './explain';
import { bankReview, deepenMoments, reviewFor } from './useReview';
import { THEME_LESSON, themeOf } from './errorLog';
import { Summary } from './Summary';
import { KeyMomentView } from './KeyMomentView';
import { FixItDrill } from './FixItDrill';
import type { Review } from './types';

type Stage = 'loading' | 'analysing' | 'summary' | 'moment' | 'drill' | 'missing' | 'failed';

/** PRD F-RV-1: key moments are re-analysed deeper, after the summary is up. */
const DEEPER_DEPTH = 16;

export function ReviewScreen() {
  const { gameId = '' } = useParams();
  const nav = useNavigate();
  const append = useProgress((s) => s.append);
  const progress = useProgress((s) => s.progress);

  const [stage, setStage] = useState<Stage>('loading');
  const [review, setReview] = useState<Review | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [at, setAt] = useState(0);
  const banked = useRef(false);
  const coach = useMemo(() => new CoachService(), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const events = await db.events.toArray();
      const source = sourceFromEvents(events, gameId);
      if (!source) {
        if (live) setStage('missing');
        return;
      }
      setTotal(source.sans.length + 1);
      setStage('analysing');

      // The book is a nicety: no connection and no cache costs the opening
      // name, not the review. F-RV-10.
      let book = null;
      try {
        const b = await loadBook();
        const { ucis } = positionsOf(source.sans);
        const r = lookupOpening(b, ucis);
        book = { name: r.name, leftBookAtPly: r.leftBookAtPly, bookPlies: r.bookPlies };
      } catch (e) {
        reportError(e, { where: 'review:openingBook' });
      }

      try {
        const band = bandForUnit(furthestUnit(progress));
        const { review: built } = await reviewFor({
          source,
          table: db.reviews,
          engine: getEngine(),
          band,
          book,
          onProgress: (d, t) => {
            if (!live) return;
            setDone(d);
            setTotal(t);
          },
        });
        if (!live) return;
        setReview(built);
        setStage('summary');

        // Deeper pass, off the 60-second budget, while the summary is read.
        const deeper = await deepenMoments(built, getEngine(), DEEPER_DEPTH, band);
        if (!live) return;
        setReview(deeper);
        await db.reviews.put(deeper);
      } catch (e) {
        reportError(e, { where: 'review:analyse' });
        if (live) setStage('failed');
      }
    })();
    return () => {
      live = false;
    };
  }, [gameId, progress]);

  const bank = useCallback(
    async (drillCompleted: boolean) => {
      if (banked.current || !review) return;
      const payload = bankReview(review, drillCompleted);
      if (!payload) return;
      banked.current = true;
      await append(payload);
    },
    [append, review],
  );

  if (stage === 'missing') {
    return (
      <Shellish>
        <p className="t-body">We could not find that game to review.</p>
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={() => nav('/play')}>
          Back to play
        </button>
      </Shellish>
    );
  }

  if (stage === 'failed') {
    return (
      <Shellish>
        <p className="t-body">The engine could not finish this review. Your game is safe — try again later.</p>
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={() => nav('/play')}>
          Close
        </button>
      </Shellish>
    );
  }

  if (stage === 'loading' || stage === 'analysing' || !review) {
    return (
      <Shellish>
        <h1 className="t-display">Reviewing your game</h1>
        <div
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-label="Analysis progress"
          className="mt-4 h-2 w-full rounded-full bg-track"
        >
          <div className="h-2 rounded-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <p aria-live="polite" className="t-caption mt-2 text-content-dim">
          Move {done} of {total}
        </p>
        <button type="button" className={`${btn.quiet} mt-4 w-full`} onClick={() => nav('/play')}>
          Close
        </button>
      </Shellish>
    );
  }

  if (stage === 'summary') {
    return (
      <>
        <Summary review={review} onStart={() => { setAt(0); setStage('moment'); }} />
        <div className="mx-auto w-full max-w-xl px-4 pb-4">
          <button type="button" className={`${btn.quiet} w-full`} onClick={() => nav('/play')}>
            Close
          </button>
        </div>
      </>
    );
  }

  if (stage === 'moment') {
    const moment = review.keyMoments[at];
    const move = review.moves[moment.ply];
    const theme = themeOf({ fenBefore: move.fenBefore, fenAfter: move.fenAfter, playedUci: move.uci, bestUci: move.best.uci });
    const lessonId = moment.lessonId ?? THEME_LESSON[theme];
    const explanation = moment.explanation ?? explainMoment(coach, { move, theme, lessonTitle: null });
    return (
      <KeyMomentView
        move={move}
        moment={{ ...moment, explanation, lessonId }}
        learner={review.learner}
        ask={askForBetter(coach, move)}
        index={at}
        total={review.keyMoments.length}
        onLesson={(id) => nav(`/lesson/${id}`)}
        onNext={async () => {
          if (at + 1 < review.keyMoments.length) {
            setAt(at + 1);
            return;
          }
          const drill = drillFrom(review.errors);
          if (drill) {
            setStage('drill');
            return;
          }
          // No drill: this is the end of the review, so bank BEFORE leaving.
          await bank(false);
          nav('/path');
        }}
      />
    );
  }

  const drill = drillFrom(review.errors)!;
  return (
    <FixItDrill
      drill={drill}
      onLesson={(id) => nav(`/lesson/${id}`)}
      onDone={async () => {
        await bank(true);
        nav('/path');
      }}
    />
  );
}

function Shellish({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-xl p-4">{children}</div>;
}

/** The furthest unit the learner has passed, for the Appendix C band. */
function furthestUnit(p: { units: Record<string, { passed: boolean }> }): string {
  const passed = Object.entries(p.units).filter(([, u]) => u.passed).map(([id]) => id);
  return passed.sort().at(-1) ?? '1.1';
}
```

- [ ] **Step 3: Create the barrel**

Create `src/review/index.ts`:

```ts
export * from './types';
export * from './bands';
export * from './labels';
export * from './openingBook';
export * from './gameSource';
export * from './phase';
export * from './errorLog';
export * from './keyMoments';
export * from './explain';
export * from './buildReview';
export * from './useReview';
export * from './fixIt';
export * from './AnalysisService';
export { ReviewScreen } from './ReviewScreen';
```

**Note:** components are exported by name, not with `export *`. A barrel that
star-exports a `.tsx` module re-exports its non-component exports too, and
`react-refresh/only-export-components` is fatal here.

- [ ] **Step 4: Run, reconcile, and expect real friction here**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/review/ReviewScreen.test.tsx`

This is the task most likely to need adjustment, because it is the first one
that touches Dexie, zustand, the router and the engine together. Expected
friction, with the fix in each case:

| Symptom | Fix |
|---|---|
| `db.events.toArray()` hangs under `fake-indexeddb` | Seed the test's database the way `src/data/store.test.ts` does, and follow its setup exactly |
| `useProgress` is not loaded | Call `useProgress.getState().load()` in the test, as the shipped screen tests do |
| `getEngine()` spawns a real Worker in jsdom | Mock `@/engine`'s `getEngine` in this test file with `vi.mock`; the engine's own behaviour is covered in Tasks 13 and 14 |
| `bg-track` / `bg-accent` are not real classes | `grep -n "track\|accent" src/app/theme.css` and use the class the app actually generates |

Adjust the **test setup**, not the component's contract.

- [ ] **Step 5: Typecheck, lint, full suite, commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run typecheck && npm run lint && npm test && \
git add src/review/ReviewScreen.tsx src/review/ReviewScreen.test.tsx src/review/index.ts && \
git commit -m "feat(review): the review route — analyse, summary, moments, drill"
```

**Chunk E ends here.**

---

## Chunk F — Wiring (after Chunk E)

**Reference for this chunk's review: the two shipped specs at `481cd63`**,
`tests/e2e/play.spec.ts` and `tests/audit-platform/play.spec.ts`. The question
the reviewer asks is "did exactly the two named assertions change, and nothing
else in those files?"

### Task 28: The route

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/routes.test.tsx`

- [ ] **Step 1: Probe the modal block**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n '26,58p' src/app/routes.tsx
```

Expected: `AppRoutes` declares `/lesson/:id`, `/checkpoint/:unit` and
`/play/game` inside `<ModalTask>`, then `<Route path="*" element={<ShellRoutes />} />`.
The comment above the splat explains that it is what lets the shell's routes be
declared below it — **the new route must go above it.**

- [ ] **Step 2: Write the failing test**

Append to `src/app/routes.test.tsx`:

```tsx
test('the review is a modal task, not a shell section', async () => {
  render(
    <MemoryRouter initialEntries={['/play/review/g1']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  // A modal task has no tab bar: one focused task, one way out.
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
```

Adapt the imports and the render helper to whatever `routes.test.tsx` already
uses — read the file first; it has an established pattern and this test should
look like its neighbours.

- [ ] **Step 3: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/app/routes.test.tsx`
Expected: the new test fails — `/play/review/g1` currently falls through to
`ShellRoutes` and renders `NotFoundScreen` inside the tab shell, so a navigation
landmark is present.

- [ ] **Step 4: Add the route**

Add the import beside the others:

```tsx
import { ReviewScreen } from '@/review';
```

and this `<Route>` immediately after the `/play/game` route and **before** the
splat:

```tsx
      <Route
        path="/play/review/:gameId"
        element={
          <ModalTask>
            <ReviewScreen />
          </ModalTask>
        }
      />
```

- [ ] **Step 5: Run and watch it pass**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/app/routes.test.tsx`
Expected: all pass, one more than before.

- [ ] **Step 6: Prove the ordering matters**

Move the new `<Route>` **below** the splat and re-run.

Expected: the new test fails again. That is the point of putting it above, and
the failure is what proves the ordering is load-bearing rather than incidental.
Move it back.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/app/routes.tsx src/app/routes.test.tsx && \
git commit -m "feat(app): /play/review/:gameId as a modal task"
```

---

### Task 29: Light up the control, and change exactly two assertions

**Files:**
- Modify: `src/play/PlayScreen.tsx`
- Modify: `tests/e2e/play.spec.ts`
- Modify: `tests/audit-platform/play.spec.ts`

**The two specs that assert this text, named** (the constraint that any text
change names its asserting spec):

| File:line at `481cd63` | Assertion | Becomes |
|---|---|---|
| `tests/e2e/play.spec.ts:50` | `await expect(page.getByRole('button', { name: /review this game/i })).toBeDisabled();` | `toBeEnabled()`, plus a click that reaches the review route |
| `tests/audit-platform/play.spec.ts:45` | `await expect(page.getByRole('button', { name: /review this game/i })).toBeDisabled();` | `toBeEnabled()` |
| `tests/audit-platform/play.spec.ts:46` | `await expect(page.getByText('Coming next release.')).toBeVisible();` | **deleted** |

No Vitest unit test asserts on either string. Verify that is still true before
editing:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -rn "review this game\|Coming next release" src/ tests/ --include=*.ts --include=*.tsx -i
```

Expected: exactly the five hits in the table above plus
`src/play/PlayScreen.tsx:284` and `:286`. **A sixth hit is a spec this plan did
not know about — stop and report it** rather than changing it.

- [ ] **Step 1: Change the control**

In `src/play/PlayScreen.tsx`, replace the block at lines 280–286 (the comment,
the disabled button and the caption) with:

```tsx
            <button
              type="button"
              className={`${btn.primary} mt-3 w-full`}
              onClick={() => nav(`/play/review/${g.id}`)}
            >
              Review this game
            </button>
```

Two changes beyond enabling it, both deliberate:

- The prominence moves from `quiet` to `primary`. `src/app/Button.tsx` reserves
  `quiet` for "an action that is available but not being offered: a dismissal,
  an unbuilt feature, a footnote control". Review is now the most likely next
  action on this screen, and PRD §2.2 says a game that is not reviewed does not
  count — so it is the screen's one primary.
- "Play again" must therefore **drop to `secondary`** if it is currently
  `primary`. One primary per screen is the rule that file states. Check:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  sed -n '275,300p' src/play/PlayScreen.tsx
```

and adjust so that exactly one `btn.primary` appears inside the game-over panel.

- [ ] **Step 2: Confirm `nav` and `g.id` are in scope at that point**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "const nav\|useNavigate\|g\.id\|state\.id" src/play/PlayScreen.tsx | head
```

Expected: `nav` exists (the neighbouring "Play again" and "Back to the path"
buttons use it). If the game state variable is not called `g`, use whatever the
surrounding JSX uses — and confirm the id it carries is the **same** `gameId`
that went into the `game_started` and `game_finished` events, because that is the
key `sourceFromEvents` joins on. If they differ, the review will never find the
game and no unit test in this plan would catch it.

- [ ] **Step 3: Update `tests/e2e/play.spec.ts`**

Replace line 50 and the comment above it:

```ts
    // Resigning ends the game: the end card reports crowns and offers the
    // review, which is now built.
```

```ts
    await expect(page.getByRole('button', { name: /review this game/i })).toBeEnabled();
    await page.getByRole('button', { name: /review this game/i }).click();
    await expect(page).toHaveURL(/\/play\/review\//);
    await expect(page.getByRole('heading', { name: /reviewing your game|game review/i })).toBeVisible({
      timeout: 120_000,
    });
```

The generous timeout is deliberate: this is a real engine analysing a real game
in CI, and F-RV-1's own wall is 90 seconds.

- [ ] **Step 4: Update `tests/audit-platform/play.spec.ts`**

Replace lines 45–46 with:

```ts
    await expect(page.getByRole('button', { name: /review this game/i })).toBeEnabled();
```

Delete the `Coming next release.` assertion — do not weaken it to a
`queryByText`. The string is gone; an assertion about a string that no longer
exists is not a test.

- [ ] **Step 5: Run the two specs**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npx playwright test tests/e2e/play.spec.ts tests/audit-platform/play.spec.ts
```

Expected: both pass.

If the e2e spec now fails at the crowns assertion **before** reaching the review
button, the primary/secondary reshuffle has changed the panel's layout; read the
failure's screenshot in `playwright-report/` before changing anything, and fix
the component rather than the assertion.

- [ ] **Step 6: Run the WHOLE Playwright suite and read the failure scope**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run test:e2e`
Expected: 221 passed, or 221 plus whatever Task 30 adds.

If more fail than the two files you touched, the scope of the failure is
diagnostic: failures confined to `tests/audit-platform/controls.spec.ts` mean
the button-prominence change tripped the design sweep (fix the component);
failures scattered across unrelated files mean something about the tree, not
about this diff — check `git status` and re-run from a clean build before
debugging.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/play/PlayScreen.tsx tests/e2e/play.spec.ts tests/audit-platform/play.spec.ts && \
git commit -m "feat(play): the review control is live (F-RV-1, PRD 2.2)"
```

---

### Task 30: End-to-end — the loop, offline, and accessibility

**Files:**
- Create: `tests/audit/review.spec.ts`

- [ ] **Step 1: Read the helpers before writing anything**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "^export" tests/audit/audit-helpers.ts tests/audit-platform/helpers.ts tests/e2e/helpers.ts
```

Use the existing helpers for playing a game, reading events and running the
accessibility checks. Do not write new ones: the repo's 221 Playwright tests
already share a vocabulary and a second one will drift.

- [ ] **Step 2: Write the spec**

Create `tests/audit/review.spec.ts` covering exactly these, each named for what
it proves:

```ts
// 1. The loop closes.
//    Play a short game to a finish, click Review this game, wait for the
//    summary, work through every key moment (using "Show me" each time),
//    complete the fix-it drill if one is offered, and assert that EXACTLY ONE
//    game_reviewed event exists for that gameId.
//
// 2. The event is banked before the screen says it is done.
//    After the "Review done" heading is visible, poll the event log and assert
//    the game_reviewed event is ALREADY there — not after clicking the exit
//    control. A commit attached to one exit turns every other exit into silent
//    loss (design spec section 8).
//
// 3. A second visit does not double-count.
//    Navigate to /play/review/<gameId> again, complete it again, and assert
//    the game_reviewed count for that gameId is still 1.
//
// 4. The progress bar is a readable quantity.
//    While analysing, assert role=progressbar with aria-valuenow and
//    aria-valuemax AND visible text matching /move \d+ of \d+/.
//
// 5. Offline (F-RV-10).
//    Complete one review so the engine and the opening book are cached, then
//    `await context.setOffline(true)`, play and review a second game, and
//    assert the summary appears. The opening line may be absent offline on a
//    first-ever review; that is stated behaviour, so assert the ACCURACY line
//    rather than the opening name.
//
// 6. One tab stop and one live region on the key-moment screen.
//    Assert exactly one element with [aria-live] and exactly one board.
//
// 7. 44px targets and a 32px root.
//    Reuse the sweeps in tests/audit-platform/controls.spec.ts and
//    tests/audit-platform/reflow.spec.ts against /play/review/<gameId>,
//    asserting no horizontal page scroll at a 32px root with the label
//    definitions expanded — that is the widest the screen ever gets.
//
// 8. Colour is never the only channel.
//    For every label chip on the summary, assert the label WORD is in the
//    accessible text, not only a glyph or a class.
```

Write each of the eight as a real `test(...)` with real assertions. A comment
block is not a test.

- [ ] **Step 3: Run it**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx playwright test tests/audit/review.spec.ts`
Expected: 8 passed.

- [ ] **Step 4: Prove the double-count test can fail**

Test 3 is the one that most easily passes for the wrong reason — if the second
visit crashed, or the review never banked at all, the count would stay at 1 and
the test would go green. Temporarily change `useReview.ts`'s guard by removing
the `banked` ref check in `ReviewScreen.tsx`, re-run, and confirm test 3 fails
with a count of 2 while test 1 still passes. Restore the guard.

If removing the ref does **not** produce a second event, the projection guard in
`reduceProgress` is doing all the work and the component guard is dead code —
which is fine, but say so in the commit message rather than leaving two guards
where only one is load-bearing.

- [ ] **Step 5: Measure the shell budget again**

Run:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run build >/dev/null && node scripts/measure-shell-size.mjs
```

Expected: `"withinBudget": true`, `dataRawKiB` about 299.3, and `shellGzKiB`
within a few KiB of the baseline Task 5 recorded. **Compare against the number
in Task 5's commit message**, not against memory.

If the shell grew by more than ~15 KiB, the opening book has probably been
imported into a module rather than fetched — check that
`public/data/openings.txt` is reached with `fetch`, not `import`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add tests/audit/review.spec.ts && \
git commit -m "test(review): the loop closes, offline works, and the screens are reachable"
```

**Chunk F ends here.**

---

## Chunk G — Verification (last, after everything)

### Task 31: Calibrate on a real phone

**Files:** none. This produces a recorded measurement.

Design spec §1.4.4 states plainly that the multiplier between the development
machine and PRD §1.3's reference device (Galaxy A51 class) was **not measured**.
The ladder makes a wrong estimate survivable, but F-RV-1's 60-second promise is
still unverified until somebody runs it on the real thing.

- [ ] **Step 1: Deploy and open on a real mid-range Android device**

Any device in the Galaxy A51 class: a Cortex-A73-generation mid-ranger, Chrome,
no developer throttling.

- [ ] **Step 2: Play a 40-move game and review it, with the console open**

Record, from the review screen itself:

| Measurement | Where it comes from |
|---|---|
| Wall-clock from clicking "Review this game" to the summary appearing | a stopwatch |
| The depth the ladder chose | the summary's "Analysed at depth N" line |
| Whether the review was marked partial | the summary's text |
| Positions analysed | the progress line's total |

- [ ] **Step 3: Record the result in the design spec**

Add a subsection `1.4.5 Measured on the reference device` to
`docs/superpowers/specs/2026-09-19-game-review-design.md` with the four numbers
above and the device's exact model, and state the implied multiplier against the
12,216 ms in §1.2.

- [ ] **Step 4: Decide, with the number in hand**

- If the ladder chose depth 14 and finished inside 60 s: F-RV-1 is met. Say so.
- If it chose 12 or 10: F-RV-1's "fixed depth of about 14" is **not** met on the
  reference device, and that is a finding about the PRD, not a bug. Report it
  with the measurement; the options are a lower fixed depth in the PRD, a longer
  budget, or PRD §10.4's server-side batch worker, and that is a product
  decision.
- If it was marked partial: the 90-second wall is being hit on a normal game.
  Stop and report before anything ships.

- [ ] **Step 5: Commit the spec update**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add docs/superpowers/specs/2026-09-19-game-review-design.md && \
git commit -m "docs(review): measured analysis time on the reference device"
```

---

### Task 32: Spec-coverage verification, against the PRD and not against this plan

**Files:** none. This produces a report.

**Read `docs/product/PRD-v1.1.md` §8.6, §10.6 and Appendix C directly.** Do not
read §A of this plan first — a checklist derived from a plan can only find work
the plan remembered, and every later stage reads the plan.

- [ ] **Step 1: Enumerate**

Write out every clause of F-RV-1 to F-RV-10 as its own line. F-RV-1 alone has
six ("analysed on device at depth ~14", "visible progress bar", "under 60
seconds", "key moments re-analysed higher", "imported games the same way",
"over 90 seconds shows a partial"). A citation names where a requirement lives,
never how much of it was met; a clause containing a list must be expanded into
that list before either side can claim coverage.

- [ ] **Step 2: For each clause, find the code**

Not the task number — the **code**. For each clause, name the file and the
function that delivers it, or write "not delivered".

- [ ] **Step 3: Compare with §A**

Now read §A. Report:

- every clause with no entry in §A (a plan defect),
- every clause whose §A entry names a task that does **not** in fact deliver it,
- every deferral in §A with no destination,
- every out-of-scope in §A with no reason.

- [ ] **Step 4: Report, do not fix**

Hand the list back. A verification stage that also fixes what it finds has
stopped being independent.

---

### Task 33: The whole suite, from a clean tree

- [ ] **Step 1: Confirm the tree is clean and the branch is where you think**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  git status --short && git log --oneline -1 && git rev-parse --abbrev-ref HEAD
```

Expected: no output from `status`, and a branch that is not `main`.

- [ ] **Step 2: Build from scratch**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  rm -rf dist && npm run typecheck && npm run lint && npm run build
```

Expected: all three silent or with their usual output, exit 0.

- [ ] **Step 3: Unit suite**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm test`
Expected: 343 baseline plus every test this plan added, 0 failed. **Write the
final count into the commit message**, so the next plan has a baseline that was
recorded rather than remembered.

- [ ] **Step 4: Playwright suite**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run test:e2e`
Expected: 221 baseline plus the 8 from Task 30, 0 failed.

- [ ] **Step 5: The content verifier**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run verify:content`
Expected: unchanged from `481cd63`.

- [ ] **Step 6: The shell budget**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && node scripts/measure-shell-size.mjs`
Expected: `"withinBudget": true`.

- [ ] **Step 7: Report**

State, in one message: the unit and e2e counts before and after, the shell size
before and after, the measured device time from Task 31, the depth the ladder
chose there, and the Task 32 coverage findings. If any of those six is missing,
the verification is not complete — an unreported number is indistinguishable
from an unmeasured one.

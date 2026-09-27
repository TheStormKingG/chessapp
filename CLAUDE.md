# ChessApp — working agreement

Instructions for any agent working in this repository. Read this before the
first change.

ChessApp is an offline-first, mobile-first PWA: Vite, React 19, TypeScript,
Dexie (IndexedDB), Zustand, `chess.js`, a bundled Stockfish build, Supabase for
auth and sync, deployed to GitHub Pages at
`https://thestormkingg.github.io/chessapp/`. There is no server in this
repository and no SQL executed from the client.

---

## 1. How work moves

Spec → plan → chunked execution → independent verification. Do not skip a stage
because the change looks small.

1. **Spec** (`docs/superpowers/specs/`). What the change is, what it is not,
   how it will be verified, and what could go wrong with the mitigation for
   each. A spec that does not say how it will be proven is not finished.
2. **Plan** (`docs/superpowers/plans/`). Numbered chunks and tasks, each naming
   the files it creates or edits and the command that proves it. The plan
   restates the standing constraints (§2) that apply to it.
3. **Chunked execution.** One chunk lands at a time, each on green checks. A
   chunk that grows past its plan gets the plan amended, not quietly exceeded.
4. **Independent verification.** The review of a chunk must have a reference
   other than the code being reviewed — the spec, the PRD, a measurement. A
   review that reads only the diff confirms the diff.
5. **Spec-coverage map.** When a chunk closes, map every spec clause to the
   task that delivered it or to an explicit deferral. A row that cites a task
   which did not deliver the clause is a defect in its own right (§4.7).

`docs/product/PRD-v1.1.md` is the product authority. Where the code and the PRD
disagree, **record the divergence in both places** — correct the doc in place
and say what shipped instead. Never delete the claim so the gap disappears, and
never leave the two to disagree silently.

---

## 2. Standing constraints

Each of these is a defect this codebase has already paid for.

- **Never `git add -A`.** Stage named paths.
- **Never commit `.env.secrets` or `.env.local`.** Never print a secret value,
  in a log, a test fixture, a commit message or a workflow.
- **A verification command's exit status must be its own.** Do not pipe a suite
  through `tail`, `tee`, `head` or `grep` and read the pipeline's status — that
  reports the filter's success, not the suite's. If you must pipe, use
  `set -o pipefail` or `${PIPESTATUS[0]}`. Read each command's exit code
  directly.
- **`PREVIEW=1` builds before it serves** (`playwright.config.ts`). Do not
  reintroduce a path that serves a stale `dist-e2e`. Only the deploy workflow
  ever built it, so a local run once reported green against code that was not in
  the bundle.
- **`chess.js` is imported only in `src/rules/rules.ts`.** Everything else calls
  `rules.ts`. A missing rule is added there, with its own test.
- **A verifier sends `ucinewgame` between positions.** Without it the content
  verifier was stably wrong across four green runs, and reversing the file order
  changed the answer. Determinism is not correctness.
- **`explain.ts` returns `null` rather than state an unverified fact.** Do not
  weaken that. Fix the call site that supplies no facts instead.

### Commands

```bash
npm run lint        # eslint . --max-warnings 0
npm run typecheck   # tsc -b
npm test            # vitest run
npm run verify:content
npm run build
PREVIEW=1 npx playwright test tests/e2e
```

Run them as separate commands and read each exit code.

---

## 3. Data, auth and destruction

These are the changes that cannot be taken back, because every existing client
already holds a database.

- **Dexie schema** (`src/data/db.ts`, currently version 3). A new or changed
  `this.version(n).stores({...})` needs a matching case in
  `src/data/dbMigration.test.ts` that opens the old version, writes data,
  upgrades, and asserts the data survived. Prove the upgrade before shipping it.
- **The event log is append-only** (`src/data/events.ts`). Adding an event type
  is fine. Removing one, renaming a field, re-typing a field, or changing what
  an existing field means is not — events already written are still in every
  learner's database, and the projections (`src/data/reduce.ts`, `resume.ts`)
  must keep folding every shape ever emitted.
- **Supabase.** The schema lives in `supabase/migrations/` and is applied with
  `supabase db push`. Rehearse it first with `supabase/dryrun/` — a
  `BEGIN … ROLLBACK` run with assertions on the RLS policies — before touching
  anything. Auth configuration is version-controlled in `supabase/config.toml`.
  RLS is the only thing standing between one learner's rows and another's.
- **Deleting or overwriting progress.** `src/app/clearDeviceData.ts`,
  `db.delete()`, `.clear()`, a `.put()` over a projection, a storage-key prefix
  change. The "clear this device's data" action must clear exactly what its
  confirmation promises — it once left `localStorage` behind. Sync merges
  (`src/sync/merge.ts`) union local and remote events; a merge that overwrites
  loses progress that exists nowhere else.

Treat any change to `src/sync/`, `supabase/`, or a deletion path as needing a
second opinion, not a quick fix.

---

## 4. The defect catalogue — check these, every time

These are the classes that have actually cost this project time. They are stated
as checks, not as history.

**4.1 A test that cannot fail.** Before you believe a green test, ask what would
make it red.

- A negative assertion whose precondition vanished, so it now passes for the
  wrong reason.
- An assertion inside a guard — `if (x) { expect(...) }` — with nothing proving
  the guard is ever true.
- A sweep that reports a count it did not measure (two units walked, twenty-nine
  reported).
- A substring assertion a near-miss also satisfies: `1 miss` matches `1 misses`.
  Anchor it or assert the whole value.
- A "matches exactly once" guard is also satisfied by matching never; it
  certifies nothing.

**4.2 A verification instrument reporting on itself.** A suite piped through
`tail`, so the shell read the filter's status. A `pgrep` liveness probe that
matched its own command line. A test mode serving a prebuilt artefact nobody
rebuilt. Ask what the instrument would report if the thing it measures were
absent.

**4.3 State surviving between items.** A component rendered once per item in a
sequence needs a stable `key`. `KeyMomentView` shipped without one and every
moment after the first rendered already revealed — while every single-item unit
test passed. A per-item unit test cannot see this class: a test must advance
through **three or more** items and assert the per-item state resets.

**4.4 Commit-on-exit.** Progress banks on arrival at the state that earns it,
never from a dismiss button's `onClick`. Banking from one exit path turns every
other exit into silent loss. The test asserts the order.

**4.5 A stateful child process inheriting state.** See `ucinewgame` in §2. Any
long-lived child — engine, worker, server — is reset between cases, and the
proof is that reversing the input order does not change the answer.

**4.6 An irreversible data change without a proven migration.** See §3.

**4.7 Claiming what was not verified.** The honesty rule: state what was
verified, or state nothing.

- A coach explanation naming a fact no placeholder carries.
- A banner promising work that nothing performs — there was no background
  scheduler behind "still analysing".
- A spec-coverage row citing a task that did not deliver the clause.
- A PRD promising a capability nothing implements.
- A commit message asserting a measurement the diff does not contain.

When copy is corrected, assert the **absence of the promise** as well as the
presence of the truth — a banner can be reworded back into a promise without
failing an assertion about its new wording.

**4.8 Concept tags.** `concept` strings are consumed by
`src/checkpoint/CheckpointMachine.ts` to draw a checkpoint's retry set. Two
spellings of one concept split its bank in half and a retry comes back short or
empty. Use the enumerated vocabulary; `verify:content` fails an unknown tag.

---

## 5. Reporting

When a finding does not survive checking, say so and do not fix it. Several
audit findings here were wrong, and recording *why* they were wrong is worth
more than a defensive change. Likewise, when you deviate from an instruction
because the instruction was inaccurate, state the deviation and the evidence.

Commit messages explain the reasoning: what was wrong, why the fix is the right
shape, what was verified and how, and what was checked and found not to be a
defect. End with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 6. CI

- `.github/workflows/deploy.yml` — lint, typecheck, unit tests, content
  verification, e2e against a production bundle, then build and publish. Runs on
  push to `main`.
- `.github/workflows/smoke.yml` — Playwright against the live URL after a
  successful deploy.
- `.github/workflows/ai-review.yml` — the AI reviewer. It runs on every pull
  request, posts inline comments, and **fails the job when it reports a
  `critical` finding**. The prompt is `.github/ai-review/prompt.md` and is built
  from §4; the runner is `scripts/ai-review.mjs`. When a new defect class costs
  this project time, add it to §4 **and** to the prompt — the catalogue and the
  reviewer must not drift apart. The job needs the `ANTHROPIC_API_KEY`
  repository secret and fails loudly without it rather than passing quietly.

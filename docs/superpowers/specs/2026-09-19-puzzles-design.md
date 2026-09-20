# Puzzles — design

**Date:** 2026-09-19
**PRD:** §8.4 (F-PZ-1 to F-PZ-9), Appendix B (theme ladder), Appendix D (licences)
**Phase:** 1 Alpha — "rated and themed puzzles, daily puzzle", plus "offline
Section 1 and 2 packs" and "non-visual mode extended to puzzles".

---

## 0. What this replaces

`src/screens/PuzzlesScreen.tsx` is an eight-line stub reading "Puzzles arrive in
the next release." Puzzles is one of five tabs in the shell, so a fifth of the
app's navigation is currently an apology. This design fills it.

`ProgressScreen` is the other stub. It is **out of scope here** — it belongs
with the skill profile and rating estimate in Phase 2, and the puzzle dashboard
(F-PZ-8) that would live there is deliberately deferred with it.

---

## 1. Scope

### 1.1 In

| ID | Requirement | Note |
|---|---|---|
| F-PZ-1 | Rated puzzles, unlimited stream, predicted success 70–85% | Rating simplified — see §1.3 |
| F-PZ-2 | Themed practice, no timer, no rating impact | Theme definitions from the CC0 Lichess theme list |
| F-PZ-3 | Fix my mistakes, first in the stream when non-empty | Reuses the review feature's error log |
| F-PZ-4 | Hint accounting | Owned by `session.ts`; see §3.3 |
| F-PZ-5 | Explain on miss | Reuses `src/review/explain.ts` unmodified |
| F-PZ-6 | Daily puzzle, three attempts, calendar | Deterministic from the date; see §4.3 |
| F-PZ-9 | Per-band packs downloadable for offline solving | Falls out of §2 |
| — | Non-visual mode on the solving screen | Phase 1 scope line |

### 1.2 Out, with destinations

| ID | Requirement | Destination |
|---|---|---|
| F-PZ-7 | Sprint and streak run | Phase 2 Beta — the release plan lists them there |
| F-PZ-8 | Puzzle dashboard | Phase 2 Beta, with the skill profile it reports into |
| — | Full Glicko-2 | When F-PZ-8 needs to display a deviation. See §1.3 |
| — | Server reconciliation of the puzzle rating | Phase 2, with accounts and sync |

Every deferral above names where it goes. None is "later".

### 1.3 The rating deviation from the PRD, stated plainly

F-PZ-1 specifies Glicko-2. This design ships a simpler rating: a number and a
confidence, updated by a step scaled by the rating gap and by remaining
uncertainty.

**Why.** Glicko-2's volatility term exists to model a rating that changes
erratically over time. Its only consumer in this pass is puzzle selection, which
depends on the rating and its confidence and not on the volatility. The screen
that would surface the deviation is F-PZ-8, which is out of scope. So the extra
machinery would be written, tested, and read by nothing.

**What this costs.** A learner whose true strength jumps suddenly is tracked
slightly more slowly than Glicko-2 would track them. At alpha scale, with 20–50
learners over four weeks, that difference is not measurable.

**Where it changes back.** `rating.ts` is a pure function with one call site in
`select.ts`. Swapping in Glicko-2 is a replacement of one module, not a
migration — provided the persisted shape carries a confidence from the start,
which it does.

This is a deliberate, recorded divergence from F-PZ-1, not an oversight. If the
divergence is unwanted, the PRD should be amended or Glicko-2 built; the code and
the PRD should not be left disagreeing silently.

---

## 2. The data pipeline

### 2.1 Source and licence

The Lichess puzzle database, CC0, already listed on the PRD's Appendix D licence
matrix ("Lichess games, evaluations, puzzles — CC0 — content pipeline and
shipped puzzle packs"). The theme names and their one-sentence definitions are a
separate CC0 entry on the same matrix and are reused verbatim.

**No new licence obligations.** The Licences screen needs no new entry, because
both rows are already covered by the existing Lichess entry added in the review
feature. This must be **verified at implementation time**, not assumed — the
review feature found the screen's own docblock had gone stale.

### 2.2 Acquisition

`scripts/build-puzzles.mjs`, mirroring the existing `scripts/build-opening-book.mjs`.

The dump (~250 MB compressed) is downloaded once into `.cache/lichess-puzzles/`.
That directory is gitignored and never committed, exactly as `.cache/chess-openings`
is for the opening book. The script fails with a clear message if the cache is
absent rather than downloading silently.

### 2.3 Filtering

Keep a puzzle only if all hold:

- Its themes intersect the eight Section 1–2 themes of Appendix B: back-rank
  mate, mate in one, smothered mate, mate in two, attacking f2/f7, skewer, fork,
  discovered attack.
- `NbPlays` ≥ 50 and `RatingDeviation` ≤ 100 — the same settled-rating bar
  Appendix B's own analysis used, so the shipped ratings mean what the appendix
  says they mean.
- Solution length ≤ 4 plies for bands below 1000. A beginner band full of
  six-ply combinations is mis-banded regardless of its rating.

### 2.4 Output

One file per band in `public/data/puzzles/`, sorted by rating, fixed-width
records so a lookup is a binary search rather than a parse of the whole file —
the technique the opening book already uses and which keeps the parse cost
independent of pack size.

Target: ~8,000 puzzles total, ~800 KiB raw across all bands, with the first band
a learner fetches around 200 KiB.

**Budget consequence:** packs are fetched at runtime and served by the CacheFirst
`/data/` route that already exists. They are **not** precached — `globPatterns`
must not gain them. The shell budget has ~7 KiB of headroom against its 300 KiB
limit, so precaching would break it. A test asserts the built `sw.js` covers
`/data/` and that the packs are absent from the precache manifest, as the
opening book's test already does.

### 2.5 Verification

`scripts/verify-puzzles.mjs`, modelled on `scripts/verify-content.mjs`:

- The FEN is legal and it is the stated side's move.
- The solution line is legal from the FEN.
- Stockfish at depth 14, MultiPV 2, agrees the first solution move is the unique
  best by at least a 100 cp margin.
- **`ucinewgame` is sent between positions.** Non-negotiable: without it, the
  Section 1 verifier was stably wrong across four green runs because an
  inherited hash lifted two positions over the bar, and reversing file order
  changed the answer. A verifier that is deterministic is not thereby correct.

The script is a `verify:puzzles` npm script and runs in CI beside `verify:content`.

---

## 3. The domain

Four pure modules, in the shape the review feature settled into: logic in pure
functions, screens that render them, and no third place where a rule can live.

### 3.1 `src/puzzles/rating.ts`

```
next(rating, confidence, puzzleRating, solved) -> { rating, confidence }
```

Starts at 800 with low confidence (F-PZ-1's "high uncertainty"). Step size
scales with the rating gap and with remaining uncertainty, so early attempts
move fast and the number settles as evidence accumulates.

Pure, total, and exhaustively testable — including the properties that matter:
solving a much harder puzzle moves the rating more than solving an easier one,
confidence is monotonically non-decreasing, and the rating is bounded.

### 3.2 `src/puzzles/select.ts`

Picks the next puzzle so predicted success falls in 70–85% (F-PZ-1). Predicted
success is a function of the rating gap, so selection is: derive the rating
window that yields that band, binary-search the pack for it, exclude recently
seen ids, pick.

**The empty-window case is a real case, not an error.** A learner at the top of
the shipped band has no puzzle in window. Behaviour: widen to the next band's
pack; if that is also empty, return the closest available and say so. It must
not return nothing, and it must not silently return an out-of-band puzzle
without the screen knowing.

### 3.3 `src/puzzles/session.ts`

A pure reducer over one attempt, exactly like `LessonMachine`. It owns F-PZ-4,
which is subtle enough to deserve a single home:

| Sequence | Credit | Rating |
|---|---|---|
| Correct, no hint taken | Full | Moves |
| Correct, after a hint | Progress only | Does not move |
| Failed, after a hint | Counts as failed for mastery | Moves (as a loss) |

The rule is shown in the hint control's tooltip, per F-PZ-4's own wording.

**Mastery is `hints === 0 && misses === 0`.** Stated explicitly because the
checkpoint machine originally admitted one prior miss, which meant a learner
guessing twice could not fail. Do not reintroduce a tolerance here.

### 3.4 `src/puzzles/queue.ts`

Stream order. F-PZ-3 makes the fix-my-mistakes set first whenever it is
non-empty, so the queue consults the existing error log
(`src/review/errorLog.ts`) before falling back to rated selection. Exact
positions from the learner's own games come first, then similar positions —
"similar" being the same primary theme and a puzzle rating within 150 points, as
F-PZ-3 specifies.

Errors the tagger could not classify produce a lesson link, not a drill. The
review feature already tags only four of the sixteen motifs, so the unclassified
path is the common one and must be the well-built one, not the fallback.

---

## 4. Data and events

### 4.1 The event

One new payload in the existing union in `src/data/events.ts`:

```ts
| {
    type: 'puzzle_attempted';
    puzzleId: string;
    themes: string[];
    puzzleRating: number;
    solved: boolean;
    hinted: boolean;
    misses: number;
    source: 'rated' | 'themed' | 'daily' | 'fix';
    ms: number;
  }
```

`source` is load-bearing: F-PZ-2 says themed practice has no rating impact, so
the projection must be able to tell a themed attempt from a rated one. A boolean
would not survive the arrival of sprint and streak run in Phase 2.

### 4.2 Projection and schema

The puzzle rating is **projected from the event log by the same pure reducer**,
never stored as an independently mutable value. This is the existing discipline
and it is what makes the rating rebuildable if the formula changes — which it
will, when Glicko-2 lands.

Dexie schema goes to **v4** for a `puzzles` table caching fetched pack metadata.
The migration is written and proven before anything writes to it, as the v3
review migration was.

### 4.3 The daily puzzle without a server

F-PZ-6 requires the same puzzle for everyone on a given day. There is no server.

The index is derived deterministically from the calendar date against a small
dedicated daily pack: same date, same puzzle, every device, no network. Three
attempts, a calendar of solved days, explanation after completion. Solving it
within 48 hours counts toward the streak — **the streak itself is not built in
this pass**, so the event is recorded and the streak consumes it when streaks
land later in Phase 1.

**Timezone is decided explicitly: the device's local date.** A learner's "today"
is their today. The consequence — two learners in different zones briefly see
different daily puzzles — is accepted, and is preferable to a UTC rollover that
changes the puzzle mid-afternoon for some learners.

---

## 5. The screens

### 5.1 `PuzzlesScreen`

Replaces the stub. Three entry points: the rated stream, themed practice, the
daily puzzle. Fix-my-mistakes appears **above** them when the error log is
non-empty, because F-PZ-3 makes it first.

### 5.2 `PuzzlePlayer`

Mirrors `LessonPlayer`: same shared `Board`, same hint control, same close
behaviour.

**Completion is banked on arrival at the result, never from a dismiss button's
`onClick`.** Copied deliberately: banking from the dismiss handler lost a
completed lesson when the learner exited via ✕, and the review feature's
end-to-end test asserts the same ordering because a commit attached to one exit
turns every other exit into silent loss.

### 5.3 Themed practice

One or more themes and a band, no timer, no rating impact. Definitions are the
one-sentence Lichess ones. Every Section 1 and 2 lesson links to the themed
practice for its motif (F-PZ-2) — the map from lesson to theme already exists in
`src/path/curriculum.ts` and is reused, not duplicated.

### 5.4 Explain on miss

F-PZ-5 reuses `src/review/explain.ts` **unmodified**. It already refuses to
state a fact the analysis has not verified, which is exactly what a "Why?"
control needs.

**The lesson learned there applies here.** That module's honesty rule worked
correctly while its only call site supplied no facts, so hung-piece and
missed-capture moments rendered with no explanation at all — silence that looked
like discipline. The puzzle call site must supply the facts its templates
require, and a test must assert that a real miss produces a real explanation,
not merely that a fabricated one produces none.

### 5.5 Non-visual mode

Through the single live region the lesson player uses: the position on arrival,
the side to move, the result of each attempt, the explanation on request.

Invariants, asserted: exactly one non-`aria-hidden` live region, one board, and
no stray tab stops. The count of raw `[aria-live]` elements is **two** by
design — dnd-kit adds its own inside `role="application"` and `Board.tsx`
neutralises it with `aria-hidden` rather than removing it. Assert the
non-hidden count; a raw count asserts a library's internals.

---

## 6. Testing

**Unit:** the four pure modules, which is most of the logic. Properties, not
just examples — a rating that moves the wrong way on a loss should fail a
property test, not survive because no example covered it.

**A note on what unit tests cannot see here.** A per-item test proves nothing
about state carried between items. The puzzle stream renders one puzzle after
another through one component, so at least one test must advance through **three
or more** puzzles and assert the per-puzzle state resets each time. This exact
defect shipped in the review feature: `KeyMomentView` was rendered without a
`key`, so every moment after the first appeared already solved, and every
single-moment unit test passed.

**End-to-end:** solve one, miss one, take a hint and assert the rating does not
move, and assert the attempt is banked before the result screen says so.

**Content:** `verify:puzzles` gates the pool.

**The suite runs against the code under test.** `PREVIEW=1` now builds before it
serves; before that fix a local run served a stale `dist-e2e` that only CI ever
built, and reported green about code that was not in the bundle.

---

## 7. What could go wrong

| Risk | Mitigation |
|---|---|
| The 250 MB dump is unavailable or its schema changed | The script fails loudly with what it expected; the packs are committed, so a broken upstream does not break a build |
| The pool is mis-banded, so predicted success is wrong | `verify:puzzles` checks solutions, not difficulty. Difficulty is validated by the alpha's own data — the PRD says the learner's record overrides the ladder once there are enough attempts |
| Puzzle packs push the app over its storage budget on a cheap phone | Per-band packs mean a learner holds their current and next band, not the pool |
| A shipped puzzle has more than one solution | The MultiPV-2 margin check with `ucinewgame` between positions |
| The rating is wrong and the learner sees only puzzles that are too hard | The rating is projected from the event log, so a corrected formula re-derives every historical rating rather than needing a migration |

---

## 8. Out of scope, explicitly

Sprint and streak run (F-PZ-7), the puzzle dashboard (F-PZ-8), full Glicko-2,
server reconciliation, puzzle tiers and puzzle battles (the PRD defers the last
two itself), and `ProgressScreen`.

Section 2 content is a **separate spec and a separate plan**. The only coupling
is F-PZ-2's lesson-to-theme links, which resolve through the existing
`curriculum.ts` map and need no coordination beyond it.

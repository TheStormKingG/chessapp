# Section 2 Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author all eight units of PRD Appendix A Section 2 — roughly 38 lessons, 520 challenges, 8 checkpoint banks and 8 guidebooks — in the existing content formats, verified one unit at a time.

**Architecture:** Content only. No new screens, no new challenge types, no schema changes beyond enumerating the concept vocabulary. Each unit is authored, verified by `verify:content`, and only then marked `built: true` in `src/path/curriculum.ts`, so a half-authored unit is never reachable by a learner.

**Tech Stack:** JSON content against `content/schema/*.json`, ajv validation, chess.js legality, Stockfish 19 MultiPV-2 depth-14 uniqueness checking, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-section-2-content-design.md`

---

## A. Spec-coverage map

| Spec clause | Entry |
|---|---|
| §2.1 unit 2.1 Real Chess | Task 3 |
| §2.1 unit 2.2 Forks | Task 4 |
| §2.1 unit 2.3 Pins and skewers | Task 5 |
| §2.1 unit 2.4 Back-rank and helper mates | Task 6 |
| §2.1 unit 2.5 Discovered attacks | Task 7 |
| §2.1 unit 2.6 Opening principles | Task 8 |
| §2.1 unit 2.7 Endgame rules | Task 9 |
| §2.1 unit 2.8 Notation and the clock | Task 10 |
| §2.2 story games (SG on 2.2, 2.8) | **Deferred → Phase 2 Beta, "story games and drills"** |
| §2.2 drills (D on 2.7) | **Deferred → Phase 2 Beta, same line** |
| §2.2 habit level two | **Deferred → the bot ladder, PRD §8.5.** Task 4 authors the `habit` string only |
| §2.2 a fourth challenge type | **Out of scope — §4 forbids inventing one. Task 8 and Task 10 must report rather than invent** |
| §3 habit strings authored as Section 1 does | Tasks 3–10, wherever Appendix A assigns one |
| §4 no new challenge type | Enforced per unit; Tasks 8 and 10 carry the explicit stop-and-report |
| §5 concept vocabulary enumerated in the schema | Task 1 |
| §5 Section 1's tags normalised | Task 1 |
| §6 every unit passes `verify:content` | Tasks 3–10, each at its own Step 4 |
| §6 `ucinewgame` between positions | Already in the verifier; Task 11 confirms it is still there |
| §7 unit by unit, Appendix A order | The task order, and the `built` flag in Task 2 |
| §7 per-unit deliverable: lessons, checkpoint, guidebook | Tasks 3–10 |
| §8 every challenge has a hint | Task 11 sweeps for this across all eight units |
| §8 one answer per challenge, proven | `verify:content` per unit |
| §8 voice matches Section 1 | Task 3 establishes the reference; Task 11 spot-checks |
| §9 verifier runtime measured after 2.1 | Task 3 Step 5 |
| §9 size budget | Task 11 |
| §10 `curriculum.ts` shared with the puzzles plan | Task 2, and the note below |

**Clauses with no entry: none.** Counted, not assumed.

**Coordination with the puzzles plan:** both touch `src/path/curriculum.ts`. This plan adds Section 2's unit and lesson ids; the puzzles plan's Task 16 derives `themeForLesson` from the existing `THEME_LESSON` map. They do not overlap in content, but they overlap in file, so whichever lands second rebases. Do not both edit it at the same moment.

---

## B. Standing constraints

1. **Do not invent a challenge type. EIGHT exist** — `find_the_move`, `find_them_all`, `name_the_pattern`, `which_square`, `is_it_safe`, `play_it_out`, `find_the_sequence`, `guess_the_move` — and Section 1 uses seven of them. (An earlier draft of this plan said three; that was wrong, and it made units 2.6–2.8 look far more constrained than they are.) A lesson that will not fit **any of the eight** is a finding to report, naming the lesson and the reason. A new type is a renderer, a schema change, a verifier case and an accessibility path — none of which is authoring.

2. **Every challenge gets a hint.** Section 1 shipped with 32 of 82 challenges having a dead hint control, found only by a later sweep. Author the hint with the challenge, not afterwards.

3. **`ucinewgame` between positions is non-negotiable.** Without it the verifier was stably wrong across four green runs and reversing file order changed the answer. Section 2 roughly doubles the corpus, which puts more positions near the margin.

4. **A unit is verified before the next is authored.** Discovering a systematic error after eight units means having made it 500 times.

5. **`built: true` is flipped only after that unit's verifier run is green.** A half-authored unit must never be reachable.

6. **Never `git add -A`.** Never commit `.env.secrets` or `.env.local`.

7. **Positions must be reachable in a real game.** A fork taught from a position with three queens teaches nothing a learner will meet.

---

## Task 1: The concept vocabulary, and normalising what drifted

**Files:**
- Modify: `content/schema/lesson.schema.json`
- Modify: `content/schema/checkpoint.schema.json`
- Modify: content files under `content/section-1/` (tag spellings only)
- Modify: `scripts/verify-content.mjs` if the vocabulary needs loading

- [ ] **Step 1: Enumerate every concept tag in use, with its count**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -ho '"concept": "[a-z-]*"' content/section-1/*/*.json | sed 's/.*: "//;s/"//' | sort | uniq -c | sort -rn
```

Record the full list with counts. This is the input to the vocabulary and the evidence for which spellings are duplicates.

- [ ] **Step 2: Decide the canonical spelling for each duplicate pair, and prove they are duplicates**

Known pairs from the spec: `check-mate`/`checkmate`, `castling`/`castling-rules`, `en-passant`/`en-passant-timing`.

**Do not assume a pair is a duplicate because the names look alike.** For each candidate pair, read the challenges carrying each tag:

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -B 8 '"concept": "en-passant-timing"' content/section-1/*/*.json | grep '"prompt"'
  grep -B 8 '"concept": "en-passant"' content/section-1/*/*.json | grep '"prompt"'
```

If the two sets ask about genuinely different things — "can you take en passant here" versus "you had one move to do it and it has gone" — they are **two concepts with confusable names**, not one concept spelled twice, and merging them would be wrong. In that case keep both and give them clearly distinct names.

Report which pairs you merged and which you kept, with the evidence.

- [ ] **Step 3: Write the failing test**

Add to the content test suite (find where schema validation is already tested and put it beside that — do not create a second test file):

```js
test('every concept tag is in the vocabulary', () => {
  const unknown = [];
  for (const file of allContentFiles()) {
    for (const c of challengesIn(file)) {
      if (!CONCEPTS.includes(c.concept)) unknown.push(`${file}: ${c.concept}`);
    }
  }
  expect(unknown).toEqual([]);
});

test('the vocabulary has no near-duplicates', () => {
  // Two tags differing only by a hyphen or a suffix are the drift this
  // vocabulary exists to stop.
  const normalise = (s) => s.replace(/-/g, '');
  const seen = new Map();
  for (const c of CONCEPTS) {
    const k = normalise(c);
    expect(seen.has(k), `${c} collides with ${seen.get(k)}`).toBe(false);
    seen.set(k, c);
  }
});
```

- [ ] **Step 4: Run and watch it fail**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm test -- concept`
Expected: the first test fails, listing the drifted tags. That list should match Step 1's evidence — if it does not, the test is not reading all the content.

- [ ] **Step 5: Add the enum to both schemas and normalise the tags**

Add `"enum": [...]` to the `concept` property in `lesson.schema.json` and `checkpoint.schema.json`, using the canonical list from Step 2.

Then rewrite the drifted tags in `content/section-1/`. **One spelling change per tag — no entry may change which concept it belongs to.**

- [ ] **Step 6: Prove no entry changed concept, only spelling**

This is the load-bearing check. `CheckpointMachine` draws a failed checkpoint's retry set from the concepts the learner missed (PRD §6.4), so **moving** an entry between concepts changes which retry pool it lands in — a behaviour change disguised as a rename.

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  git stash && grep -ho '"concept": "[a-z-]*"' content/section-1/*/*.json | sort | uniq -c > /tmp/before.txt && \
  git stash pop && grep -ho '"concept": "[a-z-]*"' content/section-1/*/*.json | sort | uniq -c > /tmp/after.txt && \
  diff /tmp/before.txt /tmp/after.txt
```

Expected: the only differences are that a merged pair's two counts have become one count equal to their sum. **Any other change is an entry that moved concept** — find it and fix it.

Because merges only ever combine, every retry pool can grow and none can shrink. State that in the commit message with the before/after counts.

- [ ] **Step 7: Run the full content verification**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npm run verify:content && npm test`
Expected: 35 files, 400 challenges OK; all unit tests pass.

- [ ] **Step 8: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add content/schema content/section-1 && \
git commit -m "fix(content): enumerate the concept vocabulary, and merge what drifted

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Section 2 in the curriculum, every unit unbuilt

**Files:**
- Modify: `src/path/curriculum.ts`
- Modify: `src/path/curriculum.test.ts`

- [ ] **Step 1: Read the existing shape**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && sed -n '1,40p' src/path/curriculum.ts`

Expected: `UnitDef` with `id`, `title`, `lessons`, `built`; `SECTION_1` with six units, all `built: true`. The docblock already says "`built: false` means no content yet … The flag stays because Section 2 will arrive one unit at a time." That mechanism is exactly what this plan uses.

- [ ] **Step 2: Write the failing test**

```ts
test('Section 2 has all eight units of Appendix A', () => {
  expect(SECTION_2.units.map((u) => u.id)).toEqual(
    ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'],
  );
});

test('an unbuilt unit is not attemptable', () => {
  for (const u of SECTION_2.units.filter((u) => !u.built)) {
    expect(isAttemptable(u.id)).toBe(false);
  }
});

test('every declared lesson id matches its unit', () => {
  for (const u of SECTION_2.units) {
    for (const l of u.lessons) {
      expect(l.id.startsWith(`${u.id}.`), `${l.id} is not in unit ${u.id}`).toBe(true);
    }
  }
});
```

- [ ] **Step 3: Run and watch it fail**
- [ ] **Step 4: Add `SECTION_2`** with all eight units, every lesson id and title from PRD Appendix A, and **`built: false` on all eight**.
- [ ] **Step 5: Run and watch it pass**

- [ ] **Step 6: Confirm the path screen renders an unbuilt unit without crashing**

Run: `cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && npx vitest run src/path`
Expected: all pass. If a test asserts the **number** of units or sections on the path screen, it is now wrong — update it to the new count rather than loosening the assertion.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add src/path/curriculum.ts src/path/curriculum.test.ts && \
git commit -m "feat(path): Section 2 declared, all eight units unbuilt

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tasks 3–10: The eight units

**Each unit follows the same seven steps.** They are written out once here and
then each task names only what differs — its lessons, its concepts, its habit
string and its particular hazards. Read this section before starting any unit.

### The per-unit procedure

- [ ] **Step 1: Read the reference unit before authoring**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  cat content/section-1/unit-1.2/lesson-1.2.1.json && \
  head -40 content/section-1/unit-1.2/checkpoint.json && \
  cat content/section-1/unit-1.2/guidebook.md
```

Unit 1.2 is the reference for voice, density and structure. Match it: second
person, present tense, short sentences, no jargon before it is taught.

- [ ] **Step 2: Author the lessons**

One `lesson-2.N.M.json` per lesson in Appendix A. Each carries `id`, `unit`,
`title`, `xp`, a `card` with `idea` and `diagrams` (and `habit` where Appendix A
assigns one), an `explain` array of FEN/text/arrows, and a `challenges` array.

Target **6–8 challenges per lesson**, matching Section 1's density (mean 6.7).

**`lesson.schema.json` sets `challenges.maxItems: 10` and `minItems: 5`.** A lesson with 11 challenges fails validation. An earlier draft of this plan said 12–14, which is not authorable.

**Every challenge carries a hint.** Not most.

- [ ] **Step 3: Author the checkpoint and the guidebook**

`checkpoint.json` with `unit`, `title`, `passMark: 0.75`, `sample: 10`, and a
`bank` of **at least 30** entries spread across the unit's concepts —
`checkpoint.schema.json` sets `bank.minItems: 30`, and Section 1's banks run
32–36. (An earlier draft said "at least 20", which fails validation.) A bank
close to the `sample` of 10 makes the sample deterministic and the retry pool
empty.

`guidebook.md` following 1.2's shape: the habit, then the material, in prose a
beginner reads once and refers back to.

- [ ] **Step 4: Verify the unit**

**FIRST, in unit 2.1 only:** `scripts/verify-content.mjs:332` hardcodes
`walk('content/section-1')`. Until that is widened to cover `content/section-2`,
the verifier reports success having examined **none** of the new content — a
silent pass, not an error. Widen it, and prove the widening by running the
verifier against a deliberately broken Section 2 position and confirming it
fails. A verifier that cannot see the content it is meant to gate is worse than
no verifier, because it certifies the opposite.

```bash
cd "<repo>" && npm run verify:content
```

Expected: the file and challenge counts **grow** by this unit's contribution.
If the count is unchanged from 35 files / 400 challenges, the walk is still
only seeing Section 1.

**If a challenge fails uniqueness, fix the position, not the margin.** The usual
cause is a second free capture or a second mate in the same number of moves.
Lowering the 100 cp bar is what makes a puzzle have two answers.

- [ ] **Step 5: Flip `built: true`**

Only now. Edit that unit's entry in `src/path/curriculum.ts`.

- [ ] **Step 6: Play the unit**

Run the lesson in a browser and complete it. The verifier proves positions are
legal and unique; it does not prove a prompt is comprehensible or that a hint
helps. Read every prompt as a beginner would.

- [ ] **Step 7: Commit**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
git add content/section-2/unit-2.N src/path/curriculum.ts && \
git commit -m "content(2.N): <unit title>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Unit 2.1 — Real Chess

**Lessons:** 2.1.1 What does the opponent's last move threaten? · 2.1.2 The threat scan: checks, captures and threats for the opponent · 2.1.3 Hanging pieces on both sides · 2.1.4 Counting on a contested square · 2.1.5 The sanity check before you move

**Habit (Appendix A):** look at the opponent's threats before your own idea.

**Concepts:** `threat-scan`, `opponent-threats`, `hanging-both-sides`, `counting`, `sanity-check`. Note `counting` **already exists** in Section 1 — reuse it rather than minting `counting-squares`. That reuse is the whole point of Task 1's vocabulary.

**The hazard here is the mirror of Section 1.** Section 1 taught the learner to look at their own position; this unit is about the opponent's. A `find_them_all` prompt like "tap every hanging piece" is ambiguous when both sides have them — say whose.

**This unit is additionally the runtime measurement (spec §9).** Record `verify:content`'s wall-clock before this unit and after it, and report the per-challenge cost. Section 2 will roughly double the corpus; if the verifier is heading past a few minutes, say so now rather than at unit 2.8.

---

### Task 4: Unit 2.2 — Forks

**Lessons:** 2.2.1 The knight fork · 2.2.2 The pawn fork · 2.2.3 The queen fork and the family fork · 2.2.4 Setting up a fork with a check

**Habit (Appendix A):** habit level two begins here — see the note below.

**Concepts:** `knight-fork`, `pawn-fork`, `queen-fork`, `family-fork`, `fork-with-check`.

**On "habit level two begins here, basic tactics are now allowed":** this is a statement about the **bot's** error model, not about content. There is no habit system — `habit` is a display-only string on the lesson card. Author the habit string as prose and **do not** add a level field, a score, or a schema change. Carry the finding to the bot-ladder work (PRD §8.5). Spec §3 has the evidence.

**Story game (SG) is deferred** to Phase 2. Do not author one.

**Hazard:** a fork position must have the fork as the *only* good move, or the verifier rejects it. The common failure is a position where a simple capture is just as good.

---

### Task 5: Unit 2.3 — Pins and skewers

**Lessons:** 2.3.1 The absolute pin · 2.3.2 The relative pin · 2.3.3 Spotting a pin on both sides · 2.3.4 The skewer · 2.3.5 Keeping a pin rather than capturing early

**Habit (Appendix A):** keep a pin.

**Concepts:** `absolute-pin`, `relative-pin`, `pin-both-sides`, `skewer`, `keep-the-pin`.

**Hazard, and it is a real one:** 2.3.5 teaches *not* capturing — that keeping the pin beats winning the pinned piece now. That is a positional judgement, and `verify:content` proves a *unique best move by 100 cp*. If Stockfish does not agree the patient move is clearly best, the position is wrong for teaching the idea. Choose positions where the engine agrees emphatically, or express the lesson as `find_them_all` over which pieces are pinned and leave the judgement to the `explain` text.

**If this lesson cannot be expressed in the three types, report it.** Do not invent a fourth.

---

### Task 6: Unit 2.4 — Back-rank and helper mates

**Lessons:** 2.4.1 The back-rank weakness and making an escape square · 2.4.2 Support mate · 2.4.3 Corridor mate · 2.4.4 Smothered mate, the pattern · 2.4.5 Damiano's mate

**Concepts:** `back-rank` (**already exists in Section 1 — reuse**), `escape-square`, `support-mate`, `corridor-mate`, `smothered-mate`, `damiano`.

**Hazard:** mating patterns very often have a second mate in the same number of moves, which fails uniqueness. Prefer positions with a single mate; where two exist, add a defender that refutes one.

---

### Task 7: Unit 2.5 — Discovered attacks

**Lessons:** 2.5.1 Discovered attack · 2.5.2 Discovered check · 2.5.3 Batteries on a line

**Concepts:** `discovered-attack`, `discovered-check`, `battery`.

**Hazard:** the point of a discovery is that the *moving* piece is often irrelevant, so several moves of that piece work equally well and uniqueness fails. Construct positions where only one destination square for the moving piece is safe, which is also what makes the idea concrete.

---

### Task 8: Unit 2.6 — Opening principles and your first opening

**Lessons:** 2.6.1 Centre, development, castle early · 2.6.2 Do not move the same piece twice, do not bring the queen out early · 2.6.3 The Italian Game as White · 2.6.4 Meeting 1.e4 with 1…e5 and 1.d4 with 1…d5 · 2.6.5 The target position

**Habit (Appendix A):** attack a bishop or knight on g4, g5, b4 or b5 with the flank pawn.

**Concepts:** `centre`, `development`, `castle-early`, `piece-twice`, `early-queen`, `italian`, `target-position`.

**This is the unit spec §4 flags as hardest, and the reason is structural:** opening play is judgement, and `verify:content` proves a unique best move. There is no unique best third move in the Italian.

**The approach:** `play_it_out` from the start against the bot, where success is the *target position's properties* — castled, central pawns, minor pieces developed, rooks connected — rather than a move list. Concrete lines that **are** forcing go in `find_the_sequence`.

**If that does not work, stop and report**, naming the lesson and what the type cannot express. Do not invent a `choose_the_best` type in an authoring pass.

---

### Task 9: Unit 2.7 — Endgame rules that decide games

**Lessons:** 2.7.1 What can and cannot mate · 2.7.2 The rule of the square · 2.7.3 King in front of the pawn, and direct opposition · 2.7.4 The rook-pawn draw · 2.7.5 The promotion race · 2.7.6 Activate the king in the endgame

**Habit (Appendix A):** activate the king and attack pawns in the endgame.

**Concepts:** `insufficient-material`, `rule-of-the-square`, `opposition`, `rook-pawn-draw`, `promotion-race`, `king-activity`.

**Drill (D, "king and pawn war") is deferred** to Phase 2. Do not author one.

**Hazard:** endgames are where Stockfish's evaluation is most emphatic, which helps, but 2.7.1 and 2.7.4 teach **draws** — positions where the right answer is that nobody wins. A `find_the_sequence` expecting a winning line is the wrong shape for a drawn position. Use `find_them_all` (which material can mate) and `play_it_out` with a draw as the success condition, and check the play-it-out success condition can actually express "draw" before authoring twelve of them.

---

### Task 10: Unit 2.8 — Notation, the clock and slow games

**Lessons:** 2.8.1 Reading and writing full notation · 2.8.2 Using most of your time, and never playing a bad move fast · 2.8.3 Going over your own game to find the first mistake

**Habit (Appendix A):** manage the clock.

**Concepts:** `notation`, `clock-management`, `first-mistake`.

**Story game (SG) is deferred** to Phase 2.

**This unit is the other one spec §4 flags.** Notation is text, not a board interaction, and clock management is a behaviour rather than a position.

**The approach:** 2.8.1 as `find_the_sequence` where the prompt is the notation and the answer is playing it — that teaches reading directly. Writing is taught in the `explain` text and checked by `find_them_all` over a position. 2.8.3 **links to the review feature**, which already does exactly this; do not reimplement going-over-your-game as challenges.

**If 2.8.2 cannot be expressed at all**, say so. A lesson that is genuinely prose plus a habit string is an acceptable outcome to report — it is not an acceptable outcome to fake with three unrelated tactics puzzles.

---

## Task 11: Verification

**Files:** none. This produces a report.

- [ ] **Step 1: Every challenge has a hint**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  node -e '
    const fs=require("fs"),g=require("path");
    let miss=[];
    for (const d of fs.readdirSync("content/section-2")) {
      for (const f of fs.readdirSync(g.join("content/section-2",d))) {
        if (!f.startsWith("lesson-")) continue;
        const j=JSON.parse(fs.readFileSync(g.join("content/section-2",d,f)));
        for (const c of j.challenges) if (!c.hints) miss.push(c.id);
      }
    }
    console.log(miss.length ? "MISSING HINTS: "+miss.join(", ") : "every challenge has a hint");
    process.exit(miss.length?1:0);
  '
```

Expected: exit 0. **Sweep every unit, not a sample** — the Section 1 defect was found by a sweep that had been run over two units and reported as if it covered twenty-nine.

- [ ] **Step 2: Counts**

Report lessons, challenges, checkpoint bank sizes and guidebooks per unit, against the spec's ~38 and ~520.

- [ ] **Step 3: Both verifiers, from a clean tree**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm run verify:content; echo "EXIT=$?"
```

Expected: `EXIT=0`. Report the file and challenge counts and the wall-clock, against Task 3's measurement.

- [ ] **Step 4: Confirm `ucinewgame` is still sent**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -c "ucinewgame" scripts/verify-content.mjs
```

Expected: non-zero. If it has been removed to speed the doubled corpus up, that is a regression to report, not an optimisation.

- [ ] **Step 5: Size**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  du -sh content/section-2 && npm run build >/dev/null && node scripts/measure-shell-size.mjs
```

Expected: `"withinBudget": true`, and `shellGzKiB` essentially unchanged — content is fetched, not bundled. **If the shell grew, a content file has been imported rather than fetched.**

- [ ] **Step 6: Every unit is built and reachable**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  grep -n "built:" src/path/curriculum.ts
```

Expected: all fourteen units `built: true`. A unit left `false` is content that shipped unreachable.

- [ ] **Step 7: Full suite**

```bash
cd "/Users/stefangravesande/Documents/Projects/Preqal 2027/Apps/Chess/chessapp" && \
  npm test; echo "UNIT_EXIT=$?" && \
  PREVIEW=1 npm run test:e2e > /tmp/e2e-s2.log 2>&1; echo "E2E_EXIT=$?"; tail -20 /tmp/e2e-s2.log
```

Expected: both exit 0. **Do not pipe either suite through `tail` and read the pipeline's status** — that reports the filter's success and has hidden a real failure in this codebase once already.

- [ ] **Step 8: Report**

Lessons, challenges, bank sizes, verifier runtime before and after, content size, shell size, which units report a challenge-type problem, and which Appendix A items were deferred. **An unreported number is indistinguishable from an unmeasured one.**

---

## C. Pre-flight

1. **Irreversible change?** No migration and no deletion. Task 1 rewrites tag spellings in shipped content, which is reversible by git — but it can silently change behaviour, so Task 1 Step 6 diffs tag counts before and after and requires that the only difference is a merged pair's counts summing. Any entry that changed concept is a behaviour change to `CheckpointMachine`'s retry pool and must be found.

2. **Each review stage's reference.** Task 11 reads the **content and the PRD**, not this plan. The per-unit verification's reference is **Stockfish and chess.js**, not the author's intent. Task 3 Step 6 and the per-unit Step 6 use a **human reading the prompt**, which is the only check that catches an incomprehensible but legal challenge.

3. **Spec-coverage map?** §A. Clauses with no entry: none — four are deferred with named destinations (story games, drills, habit level two, a fourth challenge type). Counted.

4. **Does any new test mutate state an existing test depends on?**
   - **Task 1** edits Section 1's content, which existing tests read. Step 7 runs the whole unit suite and `verify:content` over all 400 existing challenges. Any test asserting a **specific concept string** for a Section 1 challenge will break — that is correct and the assertion should be updated to the canonical spelling, not loosened.
   - **Task 2** adds a section to `curriculum.ts`. Step 6 names the failure mode: a test asserting the number of units or sections is now wrong and must be updated to the new count, not relaxed.
   - **Negative assertion at risk:** Task 11 Step 1's hint sweep asserts a list is empty. It is vacuous if the sweep finds no files — so it must report the number of challenges it examined, and that number must match Step 2's count. An empty list over an empty sweep is the exact shape of the Section 1 defect.

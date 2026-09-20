# Section 2 content — design

**Date:** 2026-09-19
**PRD:** Appendix A Section 2, §7 (curriculum architecture), §9 (content strategy), §6.4 (assessment)
**Phase:** 1 Alpha — "Sections 1 and 2"

---

## 0. What this is, and what it is not

This is an **authoring** spec. It produces content files and the verification
that gates them. It contains no new screens and no new engine work.

Two consequences, both deliberate:

- Where Section 2 needs an app capability that does not exist, this spec
  **records the gap and defers it**, naming where it belongs. It does not widen
  into engineering.
- Where the existing content pipeline has a defect, this spec fixes it **only
  where Section 2 would otherwise double it** (see §5, concept tags).

---

## 1. What Section 1 actually is

Measured, not remembered — the plan sizes against these numbers.

| | Section 1 |
|---|---|
| Units | 6 |
| Lessons | 29 |
| Challenges **in lessons** | 193 (6–8 per lesson, mean 6.7) |
| Checkpoints | 6 (one per unit) |
| Checkpoint bank entries | 207 (32–36 per bank) |
| Total challenges | 400 |
| Guidebooks | 6 |
| On disk | 324 KB |
| Challenge types available | **8** (see below) |
| Challenge types Section 1 uses | **7** |

The schemas set hard limits the author cannot exceed:
`lesson.schema.json` caps `challenges` at **`maxItems: 10`** (minimum 5), and
`checkpoint.schema.json` sets **`bank.minItems: 30`**. Every unit carries a
`checkpoint.json` with `sample: 10` and `passMark: 0.75`, plus a `guidebook.md`.

Section 2 has **eight** units in Appendix A. At Section 1's density that is
about **38 lessons**, **~266 lesson challenges** and **~272 bank entries** —
roughly 540 challenges in total, around 35 per cent more than everything
authored to date.

**Correction, recorded because it changes the work.** An earlier draft of this
spec said lessons carry about 13 challenges each and that three challenge types
exist. Both were wrong, and the method was the cause: the count grepped across
every JSON file in a unit, so checkpoint banks were counted as lesson
challenges, and the type list came from the same conflated sample. The real
figures are above. Authoring to 13 per lesson would have failed schema
validation on the first lesson.

---

## 2. Scope

### 2.1 In

All eight units of PRD Appendix A Section 2, each with lessons, a checkpoint
bank and a guidebook, in the existing formats:

| Unit | Title | Lessons (Appendix A) |
|---|---|---|
| 2.1 | Real Chess | Threat scan; hanging pieces both sides; counting on a contested square; the sanity check |
| 2.2 | Forks | Knight fork; pawn fork; queen and family fork; setting up a fork with a check |
| 2.3 | Pins and skewers | Absolute pin; relative pin; spotting a pin on both sides; the skewer; keeping a pin |
| 2.4 | Back-rank and helper mates | Back-rank weakness and escape squares; support mate; corridor mate; smothered mate; Damiano's |
| 2.5 | Discovered attacks | Discovered attack; discovered check; batteries on a line |
| 2.6 | Opening principles | Centre, development, castle early; what not to do; the Italian; meeting 1.e4 and 1.d4; the target position |
| 2.7 | Endgame rules that decide games | What can and cannot mate; rule of the square; opposition; rook-pawn draw; the promotion race; king activity |
| 2.8 | Notation, the clock and slow games | Reading and writing notation; using your time; going over your own game |

### 2.2 Out, with destinations

| Item | Where it goes |
|---|---|
| Story games (Appendix A marks 2.2 and 2.8 with **SG**) | **Phase 2 Beta** — the release plan lists "story games and drills" there. The app has no story-game renderer. |
| Drills (Appendix A marks 2.7 with **D**, "king and pawn war") | **Phase 2 Beta**, same line. |
| "Habit level two begins here, basic tactics are now allowed" (2.2) | **The bot ladder, PRD §8.5.** See §3. |
| A fourth challenge type, if a lesson seems to need one | **Deferred to a decision, not assumed.** See §4. |

Every deferral names its destination. None is "later".

---

## 3. The habit finding

PRD Appendix A says habit level two begins at unit 2.2. **There is no habit
system in the codebase.** Measured:

- `content/schema/lesson.schema.json` allows an optional `habit` string on the
  lesson card.
- `src/lesson/LessonPlayer.tsx:270` renders it as "Habit: …".
- Nothing tracks it, scores it, or has a level. `grep -ril habit src/` returns
  three files, and all three are display or a comment.

So "habit level two begins here, basic tactics are now allowed" is **not a
content property.** It is a statement about what the bot is permitted to play,
which lives in `src/bot/errorModel.ts` and belongs to the bot-ladder work in
PRD §8.5 — a separate Phase 1 item.

**What Section 2 does:** authors the `habit` string on the lessons Appendix A
assigns one to, exactly as Section 1 does. That is the whole of the content
obligation.

**What Section 2 does not do:** invent a habit level, a habit score, or a
schema field to carry one. Authoring against a system that does not exist
produces content that silently means nothing.

This finding should be carried to whoever builds the bot ladder. It is recorded
here because this is where it was discovered, not because it is this spec's to
fix.

---

## 4. Challenge types

**Eight types exist in the schemas**, and Section 1 uses seven of them:

| Type | Uses in Section 1 |
|---|---|
| `find_the_move` | 168 |
| `find_them_all` | 72 |
| `name_the_pattern` | 62 |
| `which_square` | 46 |
| `is_it_safe` | 37 |
| `play_it_out` | 14 |
| `find_the_sequence` | 1 |
| `guess_the_move` | 0 (available, unused) |

Section 2's material is tactical, and tactics map onto `find_the_move` and
`find_the_sequence` naturally.

Two units are the risk:

- **2.6 opening principles** is about judgement over a whole position rather
  than a forcing line. A "which of these developing moves is best" question has
  no unique-best-move guarantee, which is exactly what `verify:content` checks.
- **2.8 notation** is about reading and writing move text, which is not a board
  interaction at all.

**The rule this spec sets: do not invent a challenge type to make a lesson
work.** If a lesson cannot be expressed in the three existing types, that is a
finding to report, with the lesson named and the reason stated — not a schema
change folded into an authoring pass. A new challenge type is a renderer, a
schema change, a verifier case and an accessibility path, and none of those is
authoring.

For 2.6 and 2.8 specifically, the intended approach within the existing types:

- **2.6** — `play_it_out` from the starting position against the bot, with the
  success condition being the target position's *properties* (castled, central
  pawns, minor pieces out), and `find_the_sequence` for the concrete opening
  lines, which are forcing enough to verify. **`name_the_pattern` also fits**
  the "what is wrong with this opening" material directly.
- **2.8** — `find_the_move` where the prompt is the notation and the answer is
  playing it, which teaches reading; `name_the_pattern` for naming what a
  written move did. Going over your own game is what the review feature already
  does, so that lesson links to it rather than reimplementing it.

**These two units are much less constrained than an earlier draft of this spec
claimed.** That draft asserted only three types existed, which made 2.6 and 2.7
look like they needed a new one. `name_the_pattern` covers 2.7.1's "which
material can mate" and most of 2.8 without inventing anything.

If either turns out not to work in practice, report it rather than forcing it.

---

## 5. The concept-tag defect, fixed now because Section 2 would double it

Every challenge carries a `concept` string. The schema does not constrain it,
and the tags have already drifted:

| Tags that coexist today | |
|---|---|
| `check-mate` | `checkmate` |
| `castling` | `castling-rules` |
| `en-passant` | `en-passant-timing` |

These are free-form strings and nothing catches a near-duplicate. This matters
beyond tidiness. `concept` is consumed by `src/checkpoint/CheckpointMachine.ts`:
when a learner fails a checkpoint, line 25 collects the concepts they did not
master and lines 32–36 draw the retry set from the bank entries carrying those
concepts (PRD §6.4, "five to eight challenges drawn from the concepts that were
missed"). Two spellings of one concept therefore split its bank in half: a
learner who misses `checkmate` gets a retry drawn only from entries tagged
`checkmate`, and the ones tagged `check-mate` are invisible to it. Where the
split leaves too few entries, the retry is short or empty.

(It is **not** what the fix-it drill joins on — `src/review/fixIt.ts:55` sets
`concept: e.theme` from the error's own theme and does not consult lesson tags.
That was checked rather than assumed.)

**What this spec does:** enumerate the concept vocabulary in the schema, so an
unknown or misspelled tag fails `verify:content` rather than shipping. Section 1's
existing tags are normalised as part of that change — which is a content edit
across existing files, so it is called out here rather than done quietly.

**What this spec does not do:** change what `concept` means or how it is
consumed. The review feature's `THEME_LESSON` map is untouched.

This is the one place the spec reaches into existing content, and the reason is
that Section 2 would otherwise add eight units' worth of new drift to a
vocabulary that is already inconsistent.

---

## 6. Verification

Content is gated by `scripts/verify-content.mjs`, which already checks: the
lesson JSON against its schema, every FEN legal via chess.js, and every
challenge's solution unique by Stockfish MultiPV 2 at depth 14 with a 100 cp
margin, sending `ucinewgame` between positions.

**Section 2 adds no new verification machinery.** It adds content the existing
verifier must pass, plus the concept-vocabulary check from §5.

Two things the plan must hold to:

1. **`ucinewgame` between positions is non-negotiable.** Without it the verifier
   was stably wrong across four green runs, and reversing file order changed the
   answer. Section 2 roughly doubles the corpus, which increases the number of
   positions sitting near the margin.

2. **A unit is verified before the next is authored.** Authoring all eight and
   then verifying means discovering a systematic error — a bad prompt pattern, a
   mis-set side to move — after it has been made 500 times.

---

## 7. Sequencing

Unit by unit, in Appendix A order, each unit complete and verified before the
next begins:

```
2.1 → verify → 2.2 → verify → … → 2.8 → verify → full suite
```

Appendix A order is also pedagogical order: 2.1's threat scan is what makes
2.2's forks findable, and 2.3's pins assume 2.2's forks. Authoring out of order
would mean lessons referring forward to material the learner has not met.

**Per unit, the deliverable is:** `content/section-2/unit-2.N/` containing
`lesson-2.N.M.json` files, one `checkpoint.json` with a bank of at least 20
questions (sample 10, pass mark 0.75, matching Section 1), and a `guidebook.md`.

---

## 8. Quality bar

PRD §9.4 sets it. Restated as what an authoring pass must satisfy:

- Every position is legal, reachable in a real game, and not absurd — a learner
  should not be shown a position with three queens to teach a fork.
- Every challenge has exactly one answer, proven by the verifier, not by
  inspection.
- Every prompt says what to do in the fewest words that are still unambiguous.
- Every lesson has a hint for **every** challenge. Section 1 shipped with 32 of
  82 challenges having a dead hint control, and it was only caught by a sweep.
- The voice matches Section 1's: second person, present tense, short sentences,
  no jargon before it is taught.

---

## 9. What could go wrong

| Risk | Mitigation |
|---|---|
| A systematic authoring error repeated across 520 challenges | Unit-by-unit verification (§7) catches it after one unit, not after eight |
| The verifier's runtime becomes unbearable as the corpus doubles | It is already ~8 per cent slower from the `ucinewgame` reset. Measure after 2.1 and report before authoring 2.2 |
| A lesson does not fit the three challenge types | §4: report it, do not invent a type |
| Concept tags drift further | §5: enumerate the vocabulary so the verifier catches it |
| Normalising Section 1's tags changes a checkpoint retry pool | The normalisation merges spellings of one concept, so a pool can only grow. A rename that MOVED entries between concepts would be a behaviour change — the plan proves no entry changes concept, only spelling |
| Opening lines in 2.6 have more than one good move | Those lessons use the target position's properties rather than a unique move, and the concrete lines are chosen to be forcing |
| Section 2's content pushes the app over a size budget | Content is fetched per section, not bundled. Measure with `scripts/measure-shell-size.mjs` and confirm `dataRawKiB` grows and `shellGzKiB` does not |

---

## 10. Out of scope, explicitly

Story games, drills, the habit system, any new challenge type, any change to the
lesson renderer, the puzzle themes' link into Section 2 lessons (that is the
puzzles spec's `themeForLesson`, and it reads `curriculum.ts` which this spec
updates with the new unit ids), and Sections 3 and 4.

The puzzles feature is a **separate spec and plan**. The only coupling is that
`src/path/curriculum.ts` gains Section 2's unit and lesson ids, which both specs
touch — so whichever lands second rebases rather than both editing it at once.

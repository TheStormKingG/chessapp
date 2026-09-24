# Section 3 content — design

| | |
|---|---|
| **Date** | 24 September 2026 |
| **Scope** | The twelve units of PRD Appendix A, Section 3, "Fluency and planning (800 to 1200)" |
| **Basis** | PRD v1.1 Appendix A §Section 3, §2 (curriculum order), §7.3, §6.4; the shipped Sections 1 and 2 |
| **Numbers** | Every figure below is counted from the repository, not recalled. The Section 2 spec carried four factual errors of exactly that kind and a reviewer caught all four. |

---

## 1. Size, from the two sections that exist

| | Units | Lessons | Lesson challenges | Mean per lesson | Bank items |
|---|---|---|---|---|---|
| Section 1 | 6 | 29 | 193 | 6.7 | 207 |
| Section 2 | 8 | 36 | 255 | 7.1 | 279 |
| **Section 3 (projected)** | **12** | **~45** | **~320** | 7.1 | **~420** |

Section 3 is roughly **half again the size of Section 2**, which took several
working sessions with parallel authoring. Anyone planning this as a single
sitting is planning the wrong thing.

The schema binds both ends: `lesson.challenges` is `minItems: 5, maxItems: 10`,
and a checkpoint `bank` is `minItems: 30`. Twelve checkpoints is therefore a
floor of 360 bank items before a single lesson is written.

## 2. What Section 3 needs that the app does not have

These are build items, not authoring, and each one blocks the units that use it.

### 2.1 About twenty-five new concept tags

`content/schema/lesson.schema.json` enumerates **78** concept tags today. Of the
motifs Section 3 introduces, only `opposition`, `promotion` and
`promotion-race` already exist. Everything else — overloading, x-ray,
double-check, deflection, trapped-piece, under-promotion, the named mates
(Anastasia's, Arabian, Greco's, Opera, Morphy's, Pillsbury's, Boden's, Lolli's,
Épaulette, Dovetail, Hook), blind swine, perpetual check, stalemate-as-defence,
the four elements, piece activity, open files, the seventh rank, passed pawns,
weak pawns, king safety, distant opposition, candidate moves, blunder check —
needs a tag.

This is not bookkeeping. `CheckpointMachine` draws a failed checkpoint's retry
set from these tags (PRD 6.4), so **a near-duplicate spelling silently splits a
bank**, and a learner retries a concept that holds half its questions. The
schema's own note says to add a tag in the same commit that first uses it; with
twenty-five arriving at once the risk is a typo, not an omission, so the tag
list is written **once, up front, as one commit**, and authoring draws from it.

### 2.2 `guess_the_move` has never been authored — RESOLVED 2026-09-24

Unit 3.12 is four annotated story games in the Logical Chess style, and
`guess_the_move` is the type for them. **No content file in the repository uses
it** — it appears only in the two schemas. The renderer exists and Phase 0's
plan lists its answer shape, but it has never rendered a real lesson, never
been through `verify-content.mjs` with real data, and has no accessibility path
that anyone has walked.

Treat 3.12 as **a feature with content attached**, not as authoring. It needs
its renderer exercised, a verifier case, and a keyboard path, before its four
games are written. Scheduling it like the other eleven units is the mistake
this section is most likely to make.

**Built 2026-09-24, and the diagnosis above was wrong in the way that
mattered.** The type was not un-rendered. `ChallengeView` has always handled it
— in the same `case` as `find_the_move`, which is why it looked fine. What no
component read was `commentary`, the one field that makes it a story game
rather than a puzzle. A 3.12 authored against the old code would have accepted
the move, said "correct", and discarded the paragraph, and every test would
have passed. "Has never been authored" is a weaker claim than the truth: it had
never been authored, so nobody had noticed it was already broken.

What shipped:

  - `src/lesson/Annotation.tsx` renders the commentary once the move is settled
    (`correct` or `revealed`; withheld while attempting, since the paragraph is
    the answer). It is a second voice beside the coach, not the coach's line —
    PRD F-PL-3 caps the coach at one line per move, and the two make different
    claims: the coach reacts to what the learner did, the annotation says what
    the move meant in the game. Sharing one component would cost a learner who
    guessed wrong their own feedback.
  - Both schemas now **require** `commentary` on this type. Absent, it was
    valid.
  - The verifier rejects a whitespace-only commentary (which satisfies the
    schema's `minLength: 1` and renders as nothing — the state the type was
    already in) and rejects more than one answer move. A story game replays a
    game somebody played; a second accepted move means "correct" followed by a
    paragraph about a different move. The schema cannot express that.
  - Fixed in passing: the verifier played the answer moves onto ONE board in
    turn, so a second was reported "illegal" when it was only White's move on
    Black's turn.

**Accessibility**: `role="note"` labelled "From the game", the same contract
`CoachBubble` uses. Deliberately NOT a live region — it enters at the same
instant as the coach's line, and two polite regions firing together queue and
read in sequence, which buries the feedback the learner asked for behind a
paragraph. The header counter remains the screen's one announcement.

**No engine gate applies to this type**, which changes 3.12's cost: the
verifier runs Stockfish only for a single-answer `find_the_move`. A story game's
answer is the move that was played, not the move the engine prefers, so 3.12
authors without the engine ambiguity margins that pace every other unit.

### 2.3 The explorer at your band (3.10) — RESOLVED, dropped

"What players at your level do here" implies opening statistics per rating
band. `public/data/openings.txt` is a 300 KiB name lookup, fetched at runtime
for game review — it is not a move-frequency database and cannot answer this.
**Decided 2026-09-24: the line is dropped.** 3.10 ships four lessons — what a
repertoire is, the Italian in depth as White, the Caro-Kann against 1.e4, the
Queen's Gambit Declined against 1.d4 — and says nothing about what players at a
band actually play. Taken now rather than left for whoever reached the lesson,
because it changes what gets written.

## 3. What Section 2 taught, applied here

### 3.1 The defect class no gate catches

Section 2 shipped with **28 claims the board does not support, nine of them
severe**, found by reading every challenge against its own position. Stockfish
verifies that the answer is right; nothing verifies that the sentence around it
is true.

The worst of them lived in `wrong{}` — the feedback shown to a learner who
picks a losing move, which is the moment they are likeliest to believe it. One
told a learner their bishop was safe when the retreat hung it to a queen.

**Three automated sweeps for this class produced 17, 7 and 21 hits and zero
real defects between them.** Prose legitimately describes the position after
the answer, the position before a distractor, the move the learner should have
played, and multi-ply lines that alternate sides, so a phrase check cannot tell
a false claim from a true one. This step cannot be cheapened into a gate. Budget
a contextual read of every challenge, and run it over **every** field:
`scripts/dump-challenges.mjs` exists for this and now emits by deny-list,
because its allow-list once hid 45.6% of the prose.

### 3.2 A template clause is the defect's usual shape

Most of the severe Section 2 defects came from one clause — "…and Black mates
you on ⟨square⟩" — copied onto distractors whose own move destroyed the state
the clause depended on. When authoring reuses a sentence across challenges,
that sentence is the thing to re-check per position, not the thing to trust.

### 3.3 Flipping a unit live is a step, not a formality

`built: false` until the unit's content passes `verify:content` AND has been
played in a browser. That play-through is what found six wrong positions in
2.3. Each flip historically moves 7–10 assertions across `curriculum.test.ts`,
`progress.test.ts`, `TodayScreen.test.tsx` and `PathScreen.test.tsx`; they are
**scoped, never deleted**, and each keeps a non-empty control.

One consequence is already visible: `coming` now has no real instance anywhere
on the path, so the rule that unauthored content is un-attemptable is held by a
synthetic fixture. Declaring Section 3 is what re-arms it with real data, and is
the first thing that will break if the fixture was wrong.

## 3.4 Declaring the section re-arms `coming`

Done 2026-09-24, ahead of any authoring, and it behaved as predicted: six tests
moved, every one of them **scoped rather than deleted**, and the two that had
been holding the rule with a **synthetic fixture since 2.8 shipped now run
against real unbuilt units again**. That is the fixture paying for itself — the
rule survived the period when no data exercised it.

One lesson for the next section: `PathScreen.test.tsx` and
`ProgressScreen.test.tsx` both carried **hardcoded totals** (`14` checkpoints,
two meters) that a declaration turns into failures saying nothing useful. Both
now derive from `SECTIONS`. Section 4 should cost fewer moved assertions.

## 4. Order

Authoring order follows the PRD's own dependency order rather than unit number:

1. **3.1, 3.2, 3.3** — the motifs. They extend Section 2's tactics directly and
   need nothing new but tags.
2. **3.4** — named mates. Large, self-contained, pattern-heavy.
3. **3.5, 3.6, 3.7, 3.8** — drawing weapons, the four elements, files and pawns,
   king safety. These are the first *judgement* lessons in the product and the
   first where "correct" is not a single move; expect `is_it_safe` and
   `name_the_pattern` to carry more of the load than `find_the_move`.
4. **3.9** — endgames. Exactly checkable, and therefore the unit where a wrong
   claim is most damaging: the rule-of-the-square and opposition errors in 2.7
   were all caught by arithmetic, and the same arithmetic must be run here.
5. **3.11** — candidate moves and the blunder check. Teaches the thinking
   process the rest of the section assumes.
6. **3.10 and 3.12 LAST**, because both carry unresolved build questions (§2.2,
   §2.3) and neither should block the ten units that do not.

## 5. Open decisions for the owner

1. ~~**3.10's explorer**~~ — **resolved 2026-09-24: dropped** (§2.3).
2. ~~**3.12's story games**~~ — **resolved 2026-09-24**: the commentary
   renderer, the two schema requirements, the verifier's two new rejections and
   the accessibility contract all shipped (§2.2). 3.12 is now ordinary
   authoring, and cheaper than its siblings because no engine gate applies.
3. **Habit levels.** PRD §2 puts level two "from unit 2.2 through Section 3" and
   level three at Section 4. Section 3's habits are authored as level two; the
   transition is Section 4's problem, but the grader must not penalise a rule
   the current unit has not taught.

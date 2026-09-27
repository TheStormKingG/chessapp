# Unit 4.12 — Practical skills

## The habit

**Count the board. Not the clock, not the rating, not the last move you regret.**

This is the last unit of the path and the one with the least chess in it. Three of
its four lessons are about things that happen next to the board: how the clock
gets spent, what to do when there are eight seconds left, and what a rating does
to your judgement. The fourth is about a feature of this app.

That is the difficulty, and it is worth stating plainly rather than hiding: a
board question can only test something the board carries. So this unit's rule was
the one unit 3.11 arrived at for the same problem — **an honest lesson with five
challenges plus a guidebook section beats six challenges where one is invented.**
Every challenge in these four lessons is answerable from the position in front of
you. The judgement that is not on the board is here.

## 4.12.1 — Critical moments

A moment is critical when the position **can change character on this move**, and
there are three signals that can all be counted before any calculation:

1. **More than one sensible recapture.** Three ways to take on d5 is three
   different games, and the choice cannot be taken back. One way to take is not a
   decision at all.
2. **Loose men.** A piece nothing defends is where tactics come from. Two or three
   loose men on a board is the commonest warning there is, and it costs one sweep
   of the position to find.
3. **A pawn move that fixes the structure.** After it, the shape of the game is
   settled for fifty moves.

And the negative signal, which matters just as much: on a board where **nothing
can be captured** and pawns face each other on two files, no reasonable move
changes anything. Fifteen seconds. Lesson 4.12.1's locked board is that case, and
the same board also carries a bishop sacrifice on h7 that loses a piece for a
pawn — because the urge to make something happen in a quiet position is where
quiet positions actually get lost.

The cheapest case of all is a **forced move**. One legal move on the board costs
nothing whatever the clock says, and the habit of checking is worth about four
seconds.

## 4.12.2 — Time trouble

The rule from the PRD: **never move with under ten seconds unless the move is
forced.** Forced has exactly three meanings, and all three are countable:

- **one legal move on the board** — free, always;
- **one legal recapture** — free, and the count is one query;
- **a mate you have already seen.**

Everything else waits. Two things in particular:

**Premoves are a counting problem, not a pattern.** Lesson 4.12.2 puts the same
premove on two boards one pawn apart. On one nothing recaptures and the premove
wins a rook; on the other a pawn on d4 recaptures and the knight has gone for a
pawn. Nothing about the shape of the two positions distinguishes them. Only
counting the men that reach the square does, and 3.11.5 found the same thing
independently, on different boards, for the same reason.

**Do not take pawns.** Every pawn grab in a scramble is a move played without the
blunder check, and the pawn will still be there in three moves. The bank item on
this is deliberately about a pawn that really is loose: the rule is not about that
pawn, it is about the moves you play instead of checking.

### What the app cannot help with

The clock is not in the content. `GameState.clockMs` is never persisted (design
spec §7.3), so the error log's clock field is `null` for every game in this
release, including a blitz one. That means the app cannot tell you that your
mistakes cluster under thirty seconds, which is the single most useful thing an
error log could say about time trouble. Until the clock is stored, that
correlation has to be noticed by hand.

## 4.12.3 — Playing the board, not the rating

Two errors, mirror images, both from answering the name instead of counting:

- **Over-respecting.** A sacrifice from a stronger player is still a sacrifice.
  The bank puts the same bishop-takes-h7 on two boards that differ in one thing:
  whether a white knight can reach g5 next move. On one it is a sound sacrifice
  and on the other it is a bishop for a pawn. The rating tells you nothing about
  which board you are on, and neither does the shape of the position.
- **Under-respecting.** A mate threat from a weaker player is still mate. The
  bank's example has a queen on h5 and a rook behind it on h1, and twenty-four of
  Black's twenty-eight legal moves lose on the spot.

### Recovering after a blunder, and the cool-down

This is where the honest gap is, and it is worth being exact about it.

**What is on the board:** that a piece down in a *locked* position with symmetrical
pawns is not resignable, and that the practical answer is to swap nothing and make
the opponent find a plan. Lesson 4.12.3 and bank item k16 both site that
judgement on a real board following the precedent set by 3.11.5, where the one
item that was pure judgement was put on a real position rather than invented as a
board question.

**What is not on the board, and is not a challenge anywhere:**

- **Tilt.** The state of mind after a blunder is not a property of any position,
  and it is the same board whether you are calm or not. There is no honest board
  question here. What the app does instead is structural: PRD F-HM-6 gives a
  cool-down after two losses, which is the feature this paragraph exists to
  explain. Take it.
- **Whether to play the next game at all.** Same reason.
- **The habit score and estimated band** that the PRD shows at the end of this
  unit are guidance, not a test, and nothing in a challenge can or should assert
  what they mean about you.

Three items were considered for this lesson and dropped for being fake: a
`name_the_pattern` on "how do you feel", a clock-reading item where the position
was decoration, and a `play_it_out` framed as "recover from the blunder" where the
recovery was in fact just a defensive technique exercise. The first two are not
board questions at all. The third is a real exercise and belongs to 4.9, not here.

## 4.12.4 — The error log, as the app actually builds it

This lesson teaches the feature in `src/review/errorLog.ts`, not a generic idea
of an error log, so the details are worth having in one place.

**What gets an entry.** A move by the learner labelled `Mistake`, `Blunder` or
`Miss`. Nothing else.

**What the entry stores.** The position *before* the move, the move played, the
engine's move, the label, the phase, a clock time (always `null` in this release),
a theme, the lesson that theme maps to, and a `typical` flag.

**The four themes, and the order they are decided in.** The order matters, because
the first one that fires wins:

1. `missed_capture` — the engine's move takes a man that nothing defends.
   → lesson **1.2.3**, take free pieces.
2. `missed_mate` — there was a mate in one and the move played was not it.
   → lesson **1.3.3**, mate in one.
3. `hung_piece` — the move left one of your own men free that was *not* free
   before it. → lesson **1.2.4**, do not leave pieces free.
4. `ignored_threat` — the opponent had a capture before your move and still has
   it afterwards. → lesson **1.6.2**, all the checks and captures.
5. Anything else is `unclassified`, with no lesson.

Two details in that list are the ones worth teaching, and both are in the
challenges:

- **`hung_piece` names a man that was safe a move ago.** The comparison is between
  the position before the move and the position after it, so a piece that was
  already loose does not get reported. Bank item k36 is exactly this: two white
  men are undefended after the move and the log names only the one that changed.
- **`unclassified` is a deliberate answer, not a gap.** PRD F-CO-4 forbids the
  app stating what it has not verified, and a wrong theme sends the learner to the
  wrong lesson, which is worse than no theme. The tagger implements four of the
  sixteen motifs PRD §10.3 lists; the other twelve come back unclassified rather
  than guessed.

**The `typical` flag is narrower than the PRD asks for.** F-RV-6 wants "is this
error typical at the learner's level", sourced from the puzzle ladder. The ladder
is a placeholder screen, so what the flag actually says is "the theme is one of
the four the app can name". It is a statement about the curriculum, never about
other learners, and the lesson does not claim otherwise.

**How to read the log.** By theme and by count, not by game. One hung piece is bad
luck; five is a habit with a lesson number attached to it. That is the whole
method, and it is why the themes exist at all.

## Where the challenges came from

Every position in this unit was built square by square with `chess.js` and checked
for the things a hand-built board gets wrong: both kings present and not adjacent,
no pawns on the first or eighth rank, no impossible material, and — the one that
caught real mistakes — the side *not* to move never left in check. Five positions
were rejected by that last check alone during authoring, and two more were
rejected for being unreachable in a subtler way: a mate that turned out not to be
mate because a defender could block, and a "free" rook that was defended by a
knight nobody had counted.


# Unit 4.5 — Combinations and calculation

## The habit

**Find the last link first. Then ask what move makes it legal.**

Section 3 taught you the process: build a short list, scan their replies,
calculate three ply, run the blunder check. That process still stands. This
unit is what changes when the positions get sharper — when the list has three
real moves in it instead of one, when the line runs five ply instead of three,
and when you have to decide whether this position is worth a think at all.

Four things, and they happen in this order:

1. **Recognise the chain.** A combination is two or three motifs linked.
2. **Compare the candidates.** Price each one. Do not stop at the first.
3. **Calculate to five ply.** Count their legal replies at *both* of their turns.
4. **Judge whether it matters.** Most positions do not repay any of the above.

## Combinations are chains, not tricks

At 1200 you learn motifs one at a time: the fork, the pin, the skewer, the
back rank, removing the defender. At 1600 you meet them two and three at a
time, and the thing that changes is not the motifs. It is the linking.

A combination has a **last link** — the move that actually wins something —
and everything before it exists to make that move legal. So you do not find
combinations by scanning for combinations. You find them like this:

- Notice a square where something good would happen if only one thing changed.
- Name the one thing. A defender, a blocker, a king on the wrong square.
- Ask which of your checks and captures changes it.

In the first lesson's position White is six points down and the black queen
is one move from mating on b1. The last link is a knight check from d7 that
also hits the queen. The one thing in the way is that the black king is on g8
and not f8. Rxf8 is check, Kxf8 is forced, and the link is now legal. Two
moves, two motifs, and the second one was found first.

**The order is not a detail.** Play the knight to d7 immediately — same fork,
same square, same safe knight — and Black answers Qb1, you have only Re1, and
Qxe1 is mate. The fork was real the whole time and it was worth nothing,
because a fork only forks when the opponent has to stand still. That is what
the first link buys: a position in which they have no free move.

## Comparing candidates

Unit 3.11 taught you to build the list: every check, every capture, anything
that makes a threat big enough to answer. Building it is not the problem any
more. The problem is what happens next.

The common failure is not missing a move. It is **finding one that works and
then spending the rest of your time proving it works**. You have already
decided; the calculation is decoration. And the deeper you go on candidate A,
the more it costs to admit that candidate B might be better, so the sunk time
argues for the move rather than against it.

The fix is mechanical:

- Calculate each candidate **to the point where you can put a number on it**,
  and no further. "Wins a rook." "Wins a pawn and opens my king." "Nothing."
- Write the numbers down in your head, side by side.
- *Then* choose, and only then go deeper on the one you chose.

Two shallow lines you can compare beat one deep line you cannot. A depth-three
comparison of three candidates is worth more than a depth-eight look at one.

Some things that make this concrete:

- **A check is not a candidate, it is a candidate's costume.** Re8 in lesson
  two is check, is completely safe, forces Black's only legal move, and
  achieves nothing at all. Rxb6, which is not check, wins a rook.
- **Two captures of the same piece are two candidates.** Taking on e5 with
  the rook wins a rook; taking with the knight wins the same rook and loses
  one, because the knight was the piece blocking a bishop's diagonal.
- **When two candidates win the same amount, the tie-break is what they leave
  behind.** Two pawns can take the same bishop on g3. One keeps the shelter in
  front of your king and opens a file for your rook; the other does neither.

## Forcing lines to five ply

Three ply is your move, their answer, your move. Five ply is two more. The
extra length is not the expensive part — the extra **opponent move** is.

A three-ply line contains one claim that something is forced. A five-ply line
contains two, and the second one is the one nobody checks. So:

> At every opponent turn in the line, count their legal answers out loud.

One answer each time and the line is as cheap as a three-ply line was. Three
answers at their first turn and two at their second and you have six positions
to look at, not one — and the honest thing to do is either look at all six or
admit that you have not calculated the line.

What makes a reply count come down to one:

- **Double check.** The king must move, and if he has one square you are done.
  In the smothered mate, five of White's six knight checks let Black block
  with Rf7. Nh6 is the only one that is a double check, and that single
  difference is the whole combination.
- **A king boxed in by his own pawns.** f7, g7 and h7 are the reason Kh8 is
  forced rather than one of four.
- **A capture that only one piece can make.**

And when the count is *not* one, that is information, not a disaster. In the
queen-check position of lesson three, Black has three answers: two of them are
taken at once and it is mate, and only the third makes you play the full five
ply. The real work there is one branch long — but you only know that after
checking all three.

## Knowing when a position is critical

All of the above is expensive, and most positions do not repay it. The skill
that saves you more time than any other is telling the two apart.

**A position is critical when the evaluation can move a long way this move.**
Not when it looks complicated. Not when there are a lot of pieces. The signs
are concrete and you can check them in seconds, and you check them **on both
sides of the board**:

- A check exists, for either side.
- Something is hanging, or can be taken, for either side.
- A pawn is on the sixth or seventh rank.
- A piece is short of squares and could be trapped.
- A king has no escape square on the back rank.

If none of those is true for either side, the position is quiet: nothing can
change by force, so calculation has nothing to hold on to. In the blocked-pawn
position in lesson four there is not one check and not one capture on the
entire board for either player. There is no line to calculate because a line
has to start with a forcing move. Make a plan, spend thirty seconds, move on.

The trap is the position in between: **you have no forcing move and the
opponent does.** That is not quiet. A position is quiet when *neither* side
has one, and running out of ideas yourself is not evidence about them.

The clearest case in the unit is the position where White to move plays Rb8
and it is mate, and Black to move plays axb1=Q and it is mate. Material means
nothing there. The entire game is contained in one ply, and that is what the
word critical is for.

## The piece-value rules

These three come up constantly once you start pricing candidates, and all
three are close calls, which is exactly why you need a rule instead of a
feeling:

| Trade | Count | Prefer |
|---|---|---|
| **Three minor pieces vs a queen** | about 9½ vs 9 | the three pieces |
| **Two rooks vs a queen** | 10 vs 9 | the two rooks |
| **Two pieces vs a rook** | about 6½ vs 5 | the two pieces |

Each margin is well under a pawn in practice. You will not feel it. You can
count it, and the count is right often enough to be worth trusting when
nothing else in the position argues the other way.

Three riders:

- **The rules describe the material, not the position.** Three loose minor
  pieces scattered on the queenside are worth less than the table says. Three
  pieces defending each other near a king are worth more.
- **Two rooks need an open file** to be worth ten. On a closed board a queen
  is the better piece, whatever the count says.
- **Count before you trade, not after.** The value of these rules is that
  they tell you which side of a trade to be on while you can still choose.

## Common mistakes in this unit

**Playing the check because it is a check.** Forcing and good are different
properties. A check with three legal answers, none of which costs anything,
is a wasted move with a plus sign after it.

**Calculating the branch you wanted and calling the line forced.** A line is
forced when you have looked at the answers you did *not* want them to have.

**Stopping the comparison at the first move that works.** It works. So might
the next one, by more.

**Assuming a fork or a pin is worth something on its own.** It is worth
something when they have no free move. Check whether they have one.

**Reading "no forcing moves for me" as "quiet position".** Look at their half
of the board before you relax.

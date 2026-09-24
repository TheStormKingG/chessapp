# Unit 3.11 — Candidate moves and the blunder check

## The habit

**List two or three moves, then calculate. Never calculate first.**

Everything in this unit is one process, and the process has four steps and a
budget. Steps one to four are on the board. The budget is on the clock, and it
is the reason the other four are short.

1. **List.** Two or three moves, built from the checks and the captures.
2. **Scan.** For each one, what do they get in reply?
3. **Calculate.** Three ply, on the forcing ones.
4. **Check.** One last look before your hand moves.

## Why a list at all

The most common way to lose a game at this level is not to miss a hard move. It
is to see one move, like it, and play it. The move was usually fine. The problem
is that you never found out whether it was the best of the three you had,
because you never knew you had three.

Building the list is mechanical and it takes about four seconds:

- **Every check you can give.** Write them down even when they look silly.
- **Every capture you can make.** Including the ones that look like losses.
- **Anything that makes a threat big enough that they have to answer it.**

That is the list. It is usually two or three moves long, and in a sharp position
it might be five. If it is longer than five, you are in a quiet position where
there is nothing forcing at all, and then the question is a different one: which
piece of mine is worst, and where does it want to go?

The part that feels wrong is putting bad-looking moves on the list. Do it
anyway. Collecting and judging are two separate jobs, and the moment you start
judging while you collect, you stop collecting. A move you dismissed before you
looked at it is a move you never considered.

## Running their list, not just yours

In Section 2 you learned to look at the board in front of you and ask what they
have: their checks, their captures, their threats. That scan is still the right
scan. What changes here is *which board you run it on*.

The board in front of you is not the board you are going to play into. Your own
move moves a piece, and that piece was standing somewhere, blocking something,
guarding something. So the scan belongs **after** the candidate move, once per
candidate, on the position as it will be.

This is not a technicality. Roughly half the threats you will ever walk into are
threats you created yourself:

- A knight steps forward and uncovers a diagonal that runs into your king.
- A rook leaves the back rank and the back rank becomes mate.
- A pawn takes towards the centre and the file it left opens onto your queen.

None of these exist in the position you are looking at. All of them exist in the
position you are about to make. A scan run one move too early finds nothing and
tells you nothing, and it feels exactly like a scan that found nothing because
there was nothing there.

Run it in the same order every time, because the order is a ranking:

1. **Their checks.** A check cannot be ignored, so it comes first.
2. **Their captures.** What can they take, and can you take back.
3. **Their threats.** What are they setting up for the move after.

The third list is the one people skip, and it is the one that decides games. A
capture that ignores a mate threat is not a candidate move at all.

## Three ply

A ply is one move by one side. Three ply is: your move, their answer, your move
again.

Three ply sounds shallow and it is enough for most of what you will meet between
800 and 1200, for one reason: **you only calculate the forcing moves**. A
forcing move is one where your opponent has one or two legal answers instead of
thirty. Depth is cheap when they have one answer and expensive when they have
thirty, which is why the list is built from checks and captures in the first
place. The two halves of the process fit together.

So the procedure is:

- Play the first move in your head.
- Find *their* answers. If there is exactly one, say it out loud in your head
  and play it.
- Play your second move.
- **Stop, and look at the position you have arrived at.**

That last step is the one to insist on. A line does not have to end in mate. It
ends where the forcing moves run out, and then you count. If you are a piece up
in the position at the end of the line, that is an answer. If you are a rook down
with nothing to show, that is also an answer, and you have just saved yourself
the game.

The mistake in the other direction is calculating a long, beautiful line that
ends in mate, and never noticing that on move two your opponent had a different
reply. If their answer is not forced, you have not calculated a line. You have
calculated a hope.

## The blunder check

You have chosen. Your hand is on the piece. One step left, and it is two
questions.

**Can it be taken where it is going?** Look at the destination square and count
what attacks it. Knights get forgotten because they do not attack in straight
lines. Bishops in the far corner get forgotten because they are far away. Pawns
get forgotten because they capture on a different line from the one they move
on.

**What has it stopped defending?** This is the half that gets skipped, and the
reason is worth knowing: you have just spent two minutes thinking about where
the piece is going, so the destination is vivid and the departure is invisible.
Every move is two moves — a piece arrives somewhere, and a piece leaves
somewhere else. The arriving half is the half you have already checked, simply
by having thought about it at all.

A useful trick for the second question: before you move a piece, name what it is
currently defending. If the answer is "nothing", the second question is already
answered and the check costs you nothing. If the answer is a list, look at
whether anything else defends those squares.

Two things people believe that are not true:

- **"It is check, so it must be safe."** A check can be answered by taking the
  checking piece. That is one of the three legal answers to a check and it is
  often the best one.
- **"It cannot be taken, so the move is fine."** Half a blunder check passed is
  not a blunder check passed.

The check is worth running even when the answer comes back clean. A piece that
looks like it covers a square may be pinned and unable to move; a diagonal that
looks like it reaches your square may stop one square short. You cannot know
either of those without looking, and looking is about three seconds.

## Where the clock goes

The other four steps cost time, and you do not have time for all of them on
every move. So spend by phase.

**The opening is cheap.** You are following a plan you have already studied, so
the list is short and mostly known. Aim to be out of your preparation having
spent very little. If you find yourself thinking hard on move six, either
something unusual has happened — in which case spend the time, that is what it
is for — or you are re-deriving something you should have looked up after the
game.

**The early middlegame is where the money goes.** The expensive part of a game
is the stretch that starts when your preparation runs out and the position stops
resembling anything you have seen. That is where the list is longest, where the
threats are real and where a single move decides the rest. If you finish a slow
game with a third of your clock unused, this is where it should have gone.

**The endgame is cheaper than it looks**, because there are fewer pieces and
therefore fewer candidates, but do not let it go to nothing: endgames are
decided by exact moves and there is no complexity to hide a mistake in.

Three rules that convert into actual seconds:

- **Count your legal moves first.** When the answer is one, you are finished.
  A forced move costs nothing, and knowing that instantly is a skill.
- **A recapture is usually a short think, not a long one.** If there is one way
  to take back and nothing covering the square, take back.
- **Never play a bad move fast in order to save time.** The seconds are worth
  less than the piece. This sounds obvious and it is the most commonly broken
  rule on this page.

### Premoves

A premove is a move you set up in advance, which plays itself the instant your
opponent moves. It is a move made without looking, so the rule is narrow:

**Premove only when you are recapturing, or when you are under ten seconds.**

And recapturing only counts when there is exactly **one** way to take back. If a
pawn, a knight and a rook can all take on the same square, a premove picks one of
the three for you before you know what happened, and those are three different
games. Check the square before you set the premove: what covers it, and how many
ways do you have of taking there. If the answer to the second question is more
than one, take back by hand.

Under ten seconds the arithmetic changes and premoving is simply correct, because
losing on time is losing and a premove that turns out badly is only probably
losing.

## Putting it together

On a normal move, in a normal position, the whole thing is about fifteen seconds:

> Checks and captures — three of them. The first one hangs a rook, gone. The
> second one, what does he have after it — one check, and it does nothing. Play
> the second one three ply: I take, he takes back, I take. A pawn up. Where is
> the piece going, can it be taken there, no. What was it defending, the b-pawn,
> is anything else defending it, yes, the king. Play it.

You will not do this on every move and you should not try. Do it on the moves
that matter: when a capture is available, when your opponent has just moved a
piece to a new square, when something of yours is attacked, and when the position
is about to change in a way that cannot be changed back. The rest of the time,
run the short version — checks, captures, is it safe — and keep the clock for
the moves that deserve it.

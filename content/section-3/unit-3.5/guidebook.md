# Unit 3.5 — Saving lost positions: perpetual check, stalemate and the half point

## The habit

**When you are losing, count checks, not pieces.**

Every other unit in this section asks the same question: what is the winning move?
This one asks the opposite question, and it is the harder of the two, because it
starts with an admission. You are lost. The extra rook is not coming back. The
pawns are going to queen.

The moment you accept that, a different search begins — and it is a much smaller
search, which is why players who are honest about a bad position often save it
while players who are still hoping do not. You are no longer looking for the best
move. You are looking for the only move, and it will be a forcing one.

Two ideas do almost all of the work:

1. **Perpetual check.** Find a check the king must answer, then a second check
   from a different square, and shuttle between them.
2. **Stalemate.** Notice that your own king already has nowhere to go, and give
   away whatever is still keeping the game alive.

The fourth lesson is the judgement that has to come first: deciding that a draw
is the right result, before you go looking for one.

## Perpetual check

A perpetual is not one clever move. It is **two squares**.

The king in a corner usually has one flight square, because his own pieces have
taken the rest. Your job is to find a checking square that covers his current
square, and a second checking square that covers the flight square, so that
whichever one he stands on you have a check waiting. Then it is: check, he moves,
check, he moves back, and the position is where it started.

Three things have to be true, and all three are worth checking by hand:

- **Every check must be forced.** Play it out and count his legal answers. If he
  has two, one of them is probably the one that escapes.
- **The checking piece must be untouchable on both squares.** This is where most
  attempts die. A queen dropped next to the king with check forces exactly one
  reply — and that reply is the king taking her.
- **He must never get a free move.** A perpetual is a race you win by not letting
  the race start. One quiet move from you and his pawn queens.

The tell that you have found it: the engine says 0.00. That number looks like
nothing, and it is not nothing. Read it against the alternatives. If every other
move in the position is minus four, then 0.00 is the best move on the board by a
country mile.

## Stalemate as a resource

Stalemate is the other half point, and it comes from a stranger place: your own
lack of moves.

Start by counting your own legal moves. If the answer is "eleven, and all of them
are rook moves", stop and look again — that means your **king** has no legal move
at all, and the only thing standing between you and a draw is the rook.

So give the rook away. The rule that makes it work is simple:

> **The sacrifice must be check**, or the opponent will decline it.

A rook hanging on an empty square is a gift he can refuse, and he will. A rook
landing with check is a gift he has to take, because taking is the only legal
answer to the check. That is the whole technique.

Two things to watch:

- **Do not eat the bars of your own cage.** The piece covering g1, the pawn
  covering g2 — those are the reason the position is a draw. Capture one of them
  and you have handed your king a square, and a king with somewhere to go can
  never be stalemated.
- **Check the recaptures.** Sometimes a pawn can take your offered rook as well as
  the king. That is usually fine, and worth knowing, because a pawn capture can
  stalemate you immediately rather than in two moves.

## Not stalemating him when you are winning

Everything above works against you, and it costs a whole point instead of saving
half of one. It happens at the end of the game, when the win is obvious and you
have stopped concentrating.

One question, before every move in a winning position:

> **After this move, does he still have a legal move? If not, is my move check?**

That is the entire discipline. Mate and stalemate are the same position with one
difference — whether the king is attacked — and the difference is worth nine
points.

Where it bites:

- **Promotion.** A new queen covers more squares than a new rook, and sometimes
  that is exactly the problem. If queening seals the last flight square without
  check, promote to a rook instead and leave him a move.
- **Capturing his last mobile man.** If his king is frozen and one pawn is all he
  has left, that pawn is doing you a favour. Do not take it, and do not block it.
- **Liquidating.** Taking with check is not automatically safe. Check whether the
  recapture leaves king against king, which is a draw by insufficient material and
  looks exactly like winning right up until the game ends.

A useful habit is to keep the enemy king's flight square in mind as a thing you
are deliberately leaving him, rather than something you forgot to take.

## When a draw is the right result

The judgement comes before the technique, and it is the part nobody practises.

Look at three things, in this order:

1. **Material.** Not "am I behind" but "is this recoverable". Two rooks and four
   pawns against a lone queen is not recoverable.
2. **Your king.** A bare king on h1 with the enemy queen nearby is worth more to
   you as a target for perpetual check than as a liability.
3. **Their passed pawns.** If something is queening in three moves, you have three
   moves, and they all have to be forcing.

Then decide, and play the decision. The specific failure to avoid is the half
measure: grabbing a free pawn "just in case" while you think about it. A free pawn
costs you a tempo, and a tempo is the only currency a losing position has. If the
plan is the perpetual, start the perpetual.

And the mirror of it: when you are the one a rook up and the checks will not stop,
take the draw. Playing on from a position you cannot win is how a half point
becomes nothing at all.

## Using this both ways

The three questions that cover the whole unit, whichever side of it you are on:

- **Is this position actually lost?** If it is, stop looking for the best move and
  start looking for the only move.
- **Which of my pieces has no moves?** If it is the king, your last piece is not an
  asset, it is the thing keeping you from a draw.
- **After my move, can he move?** Ask it every single time in a won game, and the
  stalemate that ruins somebody's tournament will not be yours.

Half a point saved from a lost game counts exactly as much as half a point thrown
away from a won one. The scoreboard does not know the difference.

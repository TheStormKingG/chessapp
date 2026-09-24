# Unit 3.7 — Files, ranks and pawns

## The habit

**Count the pawns before you judge the square.**

Unit 3.6 gave you four elements and told you to walk the list. This unit takes
the slowest of the four — pawn structure — and shows you what to *do* about it.

Everything here follows from one fact you already know and probably do not use:
**a pawn cannot move backwards, and cannot move sideways at all.** That is why a
file with no pawns on it stays open. That is why a rook on the seventh rank hits
men that cannot dodge. That is why a pawn with nothing in front of it keeps going.
And that is why an isolated pawn stays isolated for the rest of the game.

So the four lessons are four consequences of the same rule.

## Open files and half-open files

A file is **open** when neither side has a pawn on it. A file is **half-open for
you** when you have no pawn on it and the opponent does.

They are not the same thing and they are not used the same way:

- An **open** file is a road. Put a rook on it and the rook is going somewhere —
  usually to the seventh or the eighth rank.
- A **half-open** file is a target. The enemy pawn at the end of it cannot step
  aside, so it has to be defended by a piece, and a piece defending a pawn is a
  piece not doing anything else.

Two things to hold on to.

**The file belongs to whoever gets there first.** If both sides can put a rook on
it, the side that does it first is usually the side that keeps it, because the
second rook to arrive is offering a trade the first one does not have to accept.

**Two rooks on a file beat one, and the arithmetic is worth doing once.** If your
opponent's rook stands on the file with one defender, and you have two rooks on
it, then there are three captures on that square: you take, he takes back, you
take again. You make the first and the last. He makes the one in the middle. You
end up a rook ahead.

The second rook is not covering extra squares — the rook in front of it is in
the way. It is there to take last.

## The seventh rank

The seventh rank is where the enemy pawns started and where the lazy ones still
are. A rook that gets there is attacking pawns that have never moved, and a pawn
that has never moved cannot retreat out of the way. It has to be defended, or
given up.

Now the part that almost everybody overstates, and it is worth being exact about
because a wrong picture here leads to wrong moves:

**A rook on the seventh does not attack the whole rank.** It attacks the *first*
man on each side of it and nothing beyond. A rook on d7 facing pawns on c7 and
f7 attacks two pawns. The pawn on b7 sitting behind c7, and the one on g7 behind
f7, are not attacked at all — the rook cannot see through a man.

So when you get there, count what you actually hit. Sometimes it is two pawns.
Sometimes, when the rank between you and the king is clear, it is something much
better: the king itself has nowhere to go. A black king on g8 with a white rook
raking the seventh has f7 taken away from it, and if f8 and h8 are its own men
or covered, it has one legal move or none. A king like that is not defending
anything and is not coming to help.

That is why getting to the seventh is worth a tempo even when it wins no
material at all — and it is also why the engine will often tell you it is worth
only a third of a pawn. Both are true. The rook is not winning something today;
it is making sure the other side cannot organise.

Before you go there, ask one question: **does anything cover the square?** A
bishop on c8 covering d7 turns the whole plan into a free rook for the opponent.

## Passed pawns

A pawn has got through when **no enemy pawn stands in front of it on its own
file or on either file beside it.** Three files. Check all three, every time —
the mistake that costs games is checking only the pawn's own file and missing
the pawn one file over that covers the square it has to cross.

Once it is through, only a piece or a king can stop it, and that is the whole
value of the thing. The pawn may never queen. It does not have to. Whatever gets
parked in front of it has stopped playing chess, and you are effectively a piece
up everywhere else on the board — exactly the arithmetic from lesson 3.6.2,
arriving from the other direction.

**Making one out of nothing.** Two pawns against two on the same wing is usually
nothing at all, until you find the break. The pattern is: push the pawn that has
a friend able to recapture on the same square. Your opponent takes, you take
back, and the pawn that is left has an empty road. If he refuses to take, the
pawn walks in anyway.

The break that works and the break that does not look identical from a distance.
Play both of them out in your head to the end. In the position in lesson 3.7.3,
one of the two pushes queens by force and the other leaves you with a pawn
standing nose to nose with his, and nothing at all.

**Then count the race.** A pawn two squares from home and a king four moves away
is a win. A pawn two squares from home and a king two moves away is not. Count
king moves diagonally — a king crosses the board as fast sideways as it does
diagonally, which is why the count is the bigger of the two distances, not the
sum.

## Weak pawns, and the squares in front of them

Three faults, one cause. In each case **the pawn cannot be defended by another
pawn**, so a piece has to do it.

- **Isolated** — no friendly pawn on either next-door file. Nothing can ever
  come to help it, because pawns do not move sideways.
- **Doubled** — two of yours on one file. The back one can never get past the
  front one, and between them they cover the same two files a single pawn would.
- **Backward** — its neighbours have advanced past it and it has been left
  behind. This is the nastiest of the three, because it comes with a second
  weakness attached.

That second weakness is the square **directly in front of the backward pawn**.
Look at why: the only pawns that could ever cover that square are the ones on
the files either side, and those are exactly the two pawns that have gone past
it. They cannot come back. So the square is yours permanently — not for a few
moves, permanently — and a knight sitting on it can never be asked to move.

That changes how you attack. You do not always have to win the weak pawn. Often
it is better to use the square: park a piece there, where it cannot be driven
off, and it will find something. In lesson 3.7.4 the knight lands in the hole in
front of a backward pawn, gives check, and forks a rook in the same move. The
pawn was never captured at all. It was the reason the square existed.

**How to attack a weak pawn when you do want it.** Add attackers until there are
more of them than there are defenders, and remember that the pawn's defenders
must all be pieces. Each one you force him to commit is one fewer piece doing
anything useful, and that is often the real profit even if the pawn never falls.

## Using this both ways

Turn every one of these round and it becomes a checklist for your own position.

- **Which of my files is open, and who is going to own it?** If your opponent can
  double on it and you cannot, consider blocking it with a pawn while you still
  can, or contesting it now rather than later.
- **Can a rook get to my seventh — my second rank?** Count what it would hit, and
  count whether my king would have a square. A pawn move that gives the king air
  is often worth more than it looks.
- **Are any of my pawns undefendable by a pawn?** Then count the pieces I am
  going to have to spend on them, and ask whether a trade or a push now is
  cheaper than that.
- **Where are my holes?** Every pawn you push creates two squares behind it that
  that pawn will never cover again. That is not a reason never to push. It is a
  reason to know which square you are giving away.

Pawn faults are the only faults on a chessboard that cannot be undone. Everything
else you can repair in a move or two — a bad piece gets rerouted, an exposed king
castles, a loose piece gets defended. A doubled pawn is doubled in fifty moves'
time. That is why the section on judging a position put structure last on the
list to *check* and why this unit treats it first when it comes to making plans:
it is the element that is still there at the end.

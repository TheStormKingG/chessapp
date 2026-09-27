# Unit 4.4 — Zugzwang, the Greek gift and named mates, second wave

## The habit

**Count his legal moves before you look for a check.**

Unit 3.4 taught twelve named mates and one question: which piece is guarding the
checker? This unit asks a second question that sits underneath the first —
*how many moves does my opponent actually have, and what does each one cost
him?* Sometimes the answer is that every move costs him the game, and then the
strongest move on the board is the one that changes nothing.

## Zugzwang is not a trick, it is an audit

Zugzwang is the position where a player would be fine if he could pass, and is
lost because he cannot. Two things follow from that, and both of them are
practical.

**First, no evaluation will tell you it is there.** An engine gives you a number
for the position *with a side to move*. The same board with the other side to
move can be a completely different game. In the trébuchet of lesson one — two
blocked pawns, two kings each attacking the enemy pawn and defending their own —
Black to move loses and White to move loses. Nothing about the pieces decides it.

**Second, the way you find it is by listing.** Write out every legal move your
opponent has. If the list is short and every entry on it gives something up,
you do not need a threat, you need a move that hands the turn back. In the
knight position of lesson one Black has exactly six legal moves, every one of
them by the same knight, and every one of them allows mate in one. White to move
has no mate at all. The whole win is a king step.

That listing habit is the transferable part. Zugzwang is the hardest motif in
this app by the puzzle ladder, and it is hard for one reason: it is the only one
you cannot see by looking at what is attacked.

## Lesson two: the Greek gift, and the four things it needs

The sequence is **Bxh7+, Kxh7, Ng5+, Qh5**, and it is older than every opening
you know. Learn it as a checklist, not a calculation:

1. **A bishop bearing on h7** along the b1–h7 diagonal.
2. **A knight that can reach g5** in one move, usually from f3.
3. **A queen with a clear road to h5.** Nearly always the road is
   d1–e2–f3–g4–h5, and it opens *because* the knight leaves f3. The two moves
   fit together; that is why the order is what it is.
4. **Nothing of Black's guarding h7 but the king, and nothing covering g5.**

Item four is where club games are decided, and it fails in three ordinary ways.
A **knight on f6** guards h7 as well as the king does, so Bxh7 is met by Nxh7
and the king never moves. A **bishop on e7** covers g5, so Ng5+ is answered by
Bxg5 — a check can always be met by taking the checking piece. A **queen on d8**
covers g5 too, down the d8–h4 diagonal, whenever e7 and f6 are empty. And if the
h-pawn has already gone to h6 there is nothing to take on h7 at all, and that
same pawn covers g5 into the bargain.

Check all four before the bishop moves. After it moves you are a piece down and
the checklist is no longer a question.

The king's four answers to Ng5+ are worth knowing by name. **Kh8** and **Kg8**
both walk into Qh5 and mate. **Kh6** runs onto an open h-file, which is what a
rook lift is for. **Kg6** is the only one that keeps him alive, and it does not
save the game.

## Lesson three: five named mates, sorted by who guards the checker

**Légal's mate** is the odd one out and the only one in this unit that begins
with a sacrifice of the queen. White offers her, and if Black takes, a bishop
check drags the king to a square he did not choose and a second minor piece
mates. Three developed minor pieces beat a queen when the king is stuck in the
middle. The point is not the trap, it is the count: pieces that are out beat
pieces that are not.

The next three are the same idea wearing different hats. In each of them a
**bishop on a long diagonal** does the work from the far side of the board, and
in each of them the mating piece would be perfectly takeable if it were not
there.

- **Blackburne's mate** is two bishops and a knight against a castled king. The
  bishop lands on h7, the knight on g5 guards it, and the second bishop on b2
  covers g7 and h8. It is the Greek gift's next of kin: the same bishop, the same
  knight on g5, and a second bishop instead of the queen.
- **Mayet's mate** is a rook on the h-file with a bishop on b2 behind it. The
  rook goes all the way to h8, the bishop guards it there through the empty g7,
  and the same bishop covers g7 as well. **The mated king sits on g8, never on
  h8** — a bishop on b2 that can reach h8 is already attacking h8, so a king
  standing there would be in check before the rook arrived. The geometry of the
  pattern fixes where the king must be.
- **Anderssen's mate** puts the rook or queen on g8 instead, with the king in the
  corner on h8 and his own pawn on h7. The guarding bishop has to be on **d5** —
  the only square that is both on the a8–h1 long diagonal and looking at g8.

**Réti's mate** is the interesting one, because it breaks the rule the other
four obey. The rook comes to the eighth rank and **nothing defends it at all**.
It does not need a defender, because it is not standing next to the king: the
king is walled in by his own men on d7, e7, f7 and f8, the rook covers the one
empty square beside him, and the single black piece that could capture the rook
— the bishop on d7 — is pinned against its own king. A pin does the job a
defender normally does. When you cannot find a guard for the square you want,
look for a pin instead.

## Lesson four: the two mates a queen and a rook can give on their own

These two need no pawns, no help and no sacrifice, and between them they finish
an enormous number of club games.

In both of them **the queen delivers the mate and the rook does exactly one
job**: it guards her from a distance so that the king may not take her. Nothing
else. If you take the rook off the board in either picture, the king simply
captures the queen and the game goes on.

- **The triangle mate**: the queen stands beside the king **along a rank or a
  file**, and the rook is two or more squares away on the queen's own file or
  rank. She covers the five squares around the king herself. King, queen and
  rook are not in one line, which is where the name comes from.
- **The kill box**: the queen stands beside the king **on a diagonal**, and the
  rook is exactly three squares away along a rank or file, guarding her. The
  nine squares of the three-by-three box are then sealed.

The difference is one square of queen placement, and getting it wrong is a
blunder rather than a near miss. With a black king on a7 and a white rook on d6,
**Qb6 is mate and Qb7 loses the queen** — because d6 and b6 are on the same rank
and b7 is not.

Both of them want the defending king near an edge. In the middle of the board
the box has a fourth wall that a single rook cannot hold, and you will usually
find that the last square is covered by one of the defender's own pieces.

## Using this both ways

- **Count your own legal moves in a quiet position.** If you have three and they
  all make something worse, you are the one in trouble, and the move to look for
  is the one that keeps a spare tempo in reserve.
- **Before you castle into a Greek gift, ask what is guarding h7.** If the answer
  is "only the king", either keep a knight able to return to f6 or accept that
  h6 will have to be played at some point.
- **When the square beside the enemy king has no white piece looking at it,**
  do not give up on the mate. Ask whether the black piece defending it can
  legally move — Réti's mate is an entire named pattern built on that question.

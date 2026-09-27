# Unit 4.10 — Pawn endings and the wrong bishop

## The habit

**Move the king, and know which square you are moving it to.**

Unit 3.9 gave you the rules of these endings: the three key squares two ranks in
front of the pawn, the standoff test, the rook pawn that draws. This unit is the
technique that turns those rules into moves. It is almost entirely about the
king. Of the eighteen single-move challenges across the five lessons, four have a
pawn move as the answer, and in most of the other fourteen a pawn push is among
the losing moves.

The second half of the habit is that these endings are *finite*. King and pawn
against king has 331,352 legal positions and every one of them is already
decided. So the arithmetic in this unit is not a heuristic. When a lesson says a
move is the only one that wins, that is a count, not an opinion.

## Key squares, past the rule

3.9's rule is exact as far as it goes: for a pawn on the second, third or fourth
rank, the key squares are the three squares two ranks in front of it, and your
king on any of them queens the pawn whoever is to move. Pawn on d4, key squares
c6, d6 and e6.

Three things it does not tell you, all of them measured against the solved
ending rather than remembered:

- **On the fifth rank the set doubles.** A pawn on d5 has six key squares: c6,
  c7, d6, d7, e6 and e7. A pawn on d6 has c7, c8, d7, d8, e7 and e8 — the two
  ranks in front of it, entire. So pushing to the fifth before the king is in
  place is not always the blunder it is made out to be; it enlarges the target.
- **A rook pawn on the fifth has exactly one key square, and at home it has
  none.** a5 has b7 and nothing else. a2 has no key square whatsoever, because
  the squares two ranks in front of it are off the board. That is the whole
  reason a rook pawn is different, stated as a count rather than as a proverb.
- **A key square only wins if the pawn survives the journey.** With a pawn on d5
  and your king on b7, both c6 and c7 are key squares and one step away, and
  Kc7 is still a draw: c7 does not touch d5, so Kxd5 answers it. c6 touches the
  pawn and wins.

The practical test at the board is a subtraction. Count your king's steps to
each key square. Count his steps to the same squares. If one of the three is
yours, walk to it and do not touch the pawn.

There is one exception to 3.9's "it does not matter where the defending king
stands", and it is worth knowing because it is the only one. Sweeping all 9,314
key-square positions turns up exactly two that are not wins, both the same
thing: a knight pawn on the sixth, the defending king in the corner and no legal
move — stalemate. `k1K5/8/1P6/8/8/8/8/8` with Black to move is drawn, and so is
its mirror image. Two positions in nine thousand, and both of them are the
board running out rather than the rule failing.

## Buying a move, and spending it

3.9 taught the standoff test: a shared file, rank or diagonal, an odd number of
squares between the kings, and the *other* player to move. This unit is about
what to do with the answer.

When the answer is no, you buy a move. The clearest way to see what that buys is
a pair of positions that differ only in whose turn it is. Kings on d3 and d5 with
a white pawn on e2 is a win for White when Black is to move and a draw when White
is to move — the same picture, the same men, opposite results. So from d2, Kd3 is
the only winning move of the nine available: it does not attack anything, it
delivers the obligation to move.

That is what triangulation is for. A word of warning about the name, though. In
this ending the tempo is nearly always bought with a single waiting move rather
than with the three-square circuit the word suggests. Of the 124,960 won
positions with White to move, the king returns to the square it started on in
only 70 under best play, and in none of the 2,610 where the pawn is blocked and
the king has nothing else to do. So learn the purpose — hand him the move — and
do not go looking for a triangle that mostly is not there.

When the answer is yes, you spend the move by walking round him.

- His king can only cover part of the key-square set. With a pawn on f3 the key
  squares are e5, f5 and g5; if his king stands on c5 it covers the left-hand
  one, so Ke3 — away from him — is the only winning move of the nine, and Kc3,
  the move that walks at him, draws.
- With a pawn on b2 and his king on d6 coming for c4, Ka2 is the only win of six.
  Walking to the edge looks absurd and is the point: the side of the board he
  cannot reach in time is the side to be on.

The pattern the king actually makes is a zigzag between two squares. From
`8/8/8/5k2/8/6K1/5P2/8`, best play runs Kf3 Ke5 Kg4 Kf6 Kf4 Ke6 Kg5 — on to the
file to hand over the move, aside to gain a rank, back on to the file. Seven
moves and the pawn has not moved once.

## The breakthrough

Three pawns against three with nothing passed and the kings out of reach is
usually won, and it is won by one move rather than by a plan. Give a pawn away so
the two behind it cannot both be stopped.

The part worth practising is not spotting the sacrifice, it is choosing it. In a
three-against-three every one of your three pawns can normally be offered, so
there are three candidate moves and you cannot tell them apart by looking.
Measured on the positions in this lesson:

- **a5, b5, c5 against a7, b7, c7.** b6 is worth about six and a half pawns and
  every other move in the position, both other offers included, is level or
  worse. After axb6 White plays c6; after cxb6, a6.
- **b5, c5, d5 against a7, b7, c7** — the same pawns, shifted one file. Now d6 is
  best, b6 is about a pawn worse and c6 worse again. The proverb about breaking
  in the middle has already stopped being true.
- **c5, d5, e5 against b7, c7, d7 with the black king on b5.** c6 is worth about
  seven pawns, e6 is level and d6 — the middle pawn — loses by about seven.

The count that decides it is the same every time: **after the capture, how many
black pawns are left beside your surviving pawn?** You want none. Everything else
in the position is noise.

Two riders.

- **Declining is not cautious.** In the two-against-two `8/4pp2/8/5PP1/3k4/8/K7/8`
  the break is worth about five pawns and the second-best move is about five
  pawns in the other direction, so the gap between them is over ten. There is no
  safe third option; his king is coming.
- **Sometimes one pawn is not enough.** From `1k6/5ppp/8/5PPP/8/2K5/8/8` the whole
  thing is g6 hxg6 f6 gxf6 h6 — two pawns given so the third cannot be touched.
  Eleven legal moves and g6 is the only one that wins. The order matters: push
  the f-pawn first and the g-pawn takes it, and nothing has been opened.

## The wrong-coloured bishop

A bishop and a rook pawn against a lone king is a draw when the bishop is the
wrong colour and the defending king reaches the corner. The reason is worth
having exactly rather than approximately, because it is one of the few facts in
chess you can prove rather than measure.

**A bishop can never change the colour of the square it stands on.** Not
"usually" — never. Taking all 64 squares in turn and generating every bishop move
from each gives 553 moves, and not one of them ends on a square of the other
colour. So a bishop's reach is half the board, fixed for the game.

Now the colours. **h8 is a dark square and a8 is a light one.** So:

- For an h-pawn, the wrong bishop is the **light**-squared one. It can stand on
  any of its 32 squares and never covers h8.
- For an a-pawn, the wrong bishop is the **dark**-squared one, by the same
  argument on the other corner.

And the pawn cannot help. A pawn covers the two squares diagonally in front of
it, so a white pawn on h7 covers g8 and nothing else; with no black man to
capture it can never leave the h-file either. That leaves the king as the only
white man that can reach the promotion square, and a king next to the corner
cannot take the square its own opponent is standing on.

So the position is not "probably drawn". Once the defending king is on h8, the
promotion square is beyond the reach of every white man but the king, for the
rest of the game.

What that leaves for both players is a race for one square:

- **Defending:** go to the corner. Not towards your own pieces, not away from the
  pawn — to the corner the pawn is heading for. It is usually one specific move
  and every other move loses.
- **Attacking:** keep him out of it. A bishop of the wrong colour is still a
  fence, and cutting the king off two files away is worth more than any check.

## Opposite-coloured bishops

The colour argument again, with a second bishop on the board, and it cuts the
other way: **neither bishop can ever attack the other.** They live on different
halves of the board and the halves do not meet.

A defender with a bishop the attacker cannot touch has a permanent resource: put
it on the diagonal that crosses in front of the pawns and it cannot be driven
off, only blocked. That is why an extra pawn, and often two, is not enough to win
with bishops of opposite colours — the material count is the wrong count. The
right one is:

- **Can the defending bishop see a square in front of each pawn?** One diagonal
  covering two pawns' paths holds both.
- **Can the defending king blockade on the colour the attacking bishop cannot
  reach?** If it can, it cannot be moved by anything except a pawn.
- **Are the attacker's pawns on the colour of his own bishop?** If they are, his
  bishop cannot defend their advance squares, which are all the other colour.

A caution on how you check this. An engine reports a held position as 0.00, which
is the same number it reports for a position it has not understood, and it never
says "drawn" — so a defensive move's evidence is that it scores level while
every alternative is a large minus. Where this unit claims a draw holds, the
claim is carried by a rules argument, as above, or by an exhaustive search over
every move for both sides to a stated depth, with the depth stated. Neither of
those is the engine's opinion, and only the first is unlimited.

## Using this both ways

The checklist, from either side of a pawn ending:

- **Where are the key squares, and how many steps away is each one?** Three
  squares for a pawn up to the fourth, six from the fifth, one for a rook pawn on
  the fifth, none for a rook pawn at home.
- **Who has the standoff?** Shared line, odd number of squares between, other
  player to move. If it is not you, find the waiting move. If it is you, walk
  round rather than at him.
- **Is there a break?** Count your offers, then count what is left beside your
  surviving pawn after each capture.
- **Which corner is the pawn heading for, and what colour is it?** If your bishop
  cannot reach that colour, the game is a draw the moment his king arrives — and
  a race to that square before that.
- **Are the bishops opposite?** Then count diagonals and blockade squares, not
  pawns.

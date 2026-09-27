# Unit 4.11 — Opening plans through model games

## The habit

**Name the plan from the pawns before you choose a move.**

Section 3 gave you openings as move orders: the first six moves of the Italian,
the Caro-Kann, the Queen's Gambit Declined. This unit is about what happens on
move nine, when the book runs out and nothing is attacked. The answer is never
"find the best move". It is "finish the plan this pawn structure belongs to",
and the pawn structure is visible on the board before you have read a single
move of theory.

Five games, five structures. In each of them the winning side makes between six
and eight moves in a row that threaten nothing at all.

## Why these are `guess_the_move` and not `find_the_move`

The engine gate the rest of Section 4 lives under asks that the authored move
beat the second-best by a hundred centipawns. Measured on the plan moves in
these five games, at the gate's own depth and settings:

| Move in the game | engine's best | the plan move | gap |
|---|---|---|---|
| 8.Bb3 (game 1) | Bb3 | Bb3 | best, 1cp clear of Re1 |
| 9.Re1 (game 1) | Nbd2 | Re1 | 2cp behind |
| 11.Nf1 (game 1) | d4 | Nf1 | 5cp behind |
| 13.Be3 (game 1) | d4 | Be3 | 19cp behind |
| 12.Rab1 (game 2) | h3 | Rab1 | ~9cp behind |
| 13.b4 (game 2) | h3 | b4 | 4cp behind |
| 14.b5 (game 2) | b5 | b5 | 16cp clear |
| 15.bxc6 (game 2) | bxc6 | bxc6 | 6cp clear |
| 16.Rfc1 (game 2) | Na4 | Rfc1 | 21cp behind |
| 17.Na4 (game 2) | Na4 | Na4 | 42cp clear |
| 9.e5 (game 3) | exd5 | e5 | ~6cp behind |
| 12.Bf4 (game 3) | a4 | Bf4 | 12cp behind |
| 14.Ng4 (game 3) | a3 | Ng4 | level |

Not one of them is a hundred centipawns clear of the alternatives, and most of
them are *behind* the engine's choice by a few centipawns. That is not a fault
in the moves. It is what a plan is: a sequence in which no single move is
forced, and the value is in the order rather than in any one link. Unit 3.10
measured the Italian's own main break at 5cp and unit 4.6 measured taking a
completely undefended pawn at 43cp, so the bar was never going to be met here.

`guess_the_move` has no engine gate for exactly this reason, and the move it
asks for is *the move that was played*, not the move a search prefers. Two
moves in this unit's checkpoint do clear the bar, and both of them are
punishments of a specific error rather than plan moves: taking a knight that
walked to h5 undefended (271cp) and answering a pawn that ran past e5 by
capturing in passing (307cp).

## Game 1 — the slow Italian, in order

The queue, and it is a queue:

1. **c3 and d3**, holding e4 with pawns so that no piece has to.
2. **h3**, taking g4 from the black bishop before it arrives.
3. **Bb3**, off the square a knight on a5 or a bishop on e6 would trade it on.
4. **Re1**, behind the pawn that is going to move.
5. **Nbd2–f1–g3**, three moves for one knight, because c3 is a pawn and g3
   covers f5 and h5 while blocking nothing.
6. **Be3**, meeting the bishop on a7 head-on so d4 is not answered from the
   corner.
7. **d4**.

Break when the queue is empty. In the game Black played the correct freeing
move, `d5`, one move before his own centre could take the pressure, and the
pawn on e5 was left defended once and attacked twice.

## Game 2 — the Carlsbad, and what the target is for

Unit 4.6 taught the mechanics on stripped-down boards: two pawns at three, then
take, and the pawn Black is left with on c6 can never be defended by a pawn.
This game is the same idea with all the pieces still on, and it adds the part
4.6 could not show:

- **which rook goes where, decided before either moves.** The a-rook backs the
  march; the f-rook waits for the c-file the march will open.
- **the knight to a4 is not an attacking move only.** It adds the third
  attacker to c6 *and* covers c5, which is the one square the target could ever
  run to. Both jobs, one move.
- **a piece on the file you own is a blocker too.** When the knight later lands
  on c5 in front of the queen on c2 and the rook on c1, the count of attackers
  on c6 drops to nothing. Checkpoint item k16 is that position.

Black lost the pawn by finally playing `c5` — the move the knight on a4 had
been waiting for since it went there.

## Game 3 — the King's Indian Attack

Eight moves that are the same whatever Black does: d3, Nd2, Nf3, g3, Bg2,
castle, Re1, e5. Then one knight walks f1–h2–g4.

The wedge on e5 is the whole plan in one pawn. It does two things that last for
the rest of the game: it takes f6 from the black knight, and it means no black
pawn can ever defend f6 or h6 again, because a pawn on f7 or g7 does not cover
them. g4 is the only square on the board from which a knight attacks both, which
is why three moves to get there is a bargain.

The other half is the answer to `f5`. Black's natural way of shutting the
position is to push the f-pawn past the wedge, and a pawn that has just run past
may be taken in passing. In the game that capture landed on f6 attacking the
bishop on e7 and the square g7, with a bishop already on h6 and a queen on f4.

## Game 4 — the Caro-Kann c5 break, from Black's side

A pawn chain is attacked at its base, and here the base is d4. The move order
matters more than the move:

- **the bishop comes out to f5 first.** After `c5` and `e6` it would be shut in
  behind its own pawns for the rest of the game.
- **`c5`, then a piece to the same square.** A break that is met by a support
  pawn on c3 has not failed; it has told you where your knights belong.
- **take on d4 while the recapture is `cxd4`.** That turns the propping pawn
  into the target itself, and from then on every defender of d4 has to be a
  piece — and pieces can be traded off.
- **e7 before f6 for the knight**, because a knight on f6 meets a pawn on e5,
  and e7 is on the road to f5 where it hits d4 *and* the bishop defending it.

Black got the pawn because White offered to trade the bishop on e3 of his own
accord. Three defenders became one while two knights were waiting. Checkpoint
items k25 and k26 are the two halves of that count on one board.

## Game 5, and the method

### The four steps

1. **Read the pawns and name the plan, before any moves.** In game 5 the pawns
   on c3, d4, e3 and f4 with a bishop on d3 say: knight to e5, rook to the third
   rank, attack on the king. e5 is the only square both the d4 and f4 pawns
   defend, which is a count rather than an opinion.
2. **Guess every move of the side with the plan.** Not "find the best move" —
   guess the move the plan needs. In game 5 that is Ne5, Rf3, Rh3, Qh5, and not
   one of them threatens anything when it is played.
3. **Find the move it was all for.** Qxh7 mate, held on h7 by the rook that
   walked there on move ten.
4. **Put the game away and replay it from memory a week later.**

### What the challenges can and cannot test

Steps one, two and three are on the board, and lesson 4.11.5 tests all three:
naming the plan from the structure (`name_the_pattern`), finding the plan's key
square (`which_square`), playing the plan's moves (`guess_the_move`), and naming
the men the finish actually needs (`find_them_all`).

**Step four cannot be a challenge, and neither can two things that belong with
it.** They are carried here instead of being faked on a board:

- **Playing the game through once, fast, without stopping.** A challenge stops
  you at every branch, which is the opposite of this step. Do it first, from the
  move list, with no board questions at all.
- **Writing the plan in one sentence in your own words.** The value is in the
  sentence being yours. A three-option question can check that you recognise a
  plan; it cannot check that you can state one.
- **Replaying the game from memory a week later.** There is nothing in the app
  that can know whether you did, and a board question a week later would be
  testing recall of a position rather than recall of a plan.

This is also why game 5 is thirteen moves long. A game you cannot replay from
memory is a game you have read.

### The thing worth measuring in game 5

After 12.Qh5, Black has thirty-two legal moves and **six** of them stop the mate:
the knight back to f6, the rook to f7 or f6, the bishop to h4, the pawn to h6,
or the knight taking on e5. Twenty-six lose to the same move. The one Black
chose, `g6`, attacked the queen — which is why it was chosen, and why it is the
commonest kind of losing move at this level: a reply to the piece rather than to
the threat.

And the mate needs only two white men. Take the queen off and it is not mate;
take the rook on h3 off and the king takes the queen. Take away anything else —
the knight on e5, either bishop, any pawn — and it is still mate. The knight on
e5 looks like part of the mating net and is not: the queen on h7 covers f7 and
g7 along the seventh rank by herself.

## The games

All five are composed for these lessons and are not attributed to anybody. Each
one replays legally from the starting position under `chess.js`, and the full
move lists are in the lesson files.


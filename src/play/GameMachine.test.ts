import {
  applyBotMove,
  applyLearnerMove,
  coachEventFor,
  hintCue,
  initGame,
  preMoveEvent,
  resign,
  resultFor,
  showThreats,
  threatsCue,
  takeBack,
  tickClock,
  applyHint,
  type GameState,
} from './GameMachine';
import { crowns, crownsNote } from './crowns';
import { START_FEN, applyMove } from '@/rules';
import { threatsAgainst } from '@/tagger';

function game(over: Partial<GameState> = {}): GameState {
  return { ...initGame({ learner: 'w', persona: 'rosa', timeControl: 'untimed', coach: true }), ...over };
}

/** White to move, after 1.e4 e5. No captures, nothing hanging for either side. */
const AFTER_1E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
/** The same with White's knight on f3 and White still to move; Nxe5 is free, Ng5 hangs the knight. */
const KNIGHT_ON_F3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 3';
/** White to move with the knight already hanging on g5 to Qxg5. */
const KNIGHT_HANGING_ON_G5 = 'rnbqkbnr/pppp1ppp/8/4p1N1/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
/** Four Knights-ish; White may castle, e4 is defended by Nc3, and no capture wins material. */
const CAN_CASTLE = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';

test('learner move then bot move alternate and record SAN', () => {
  let g = game();
  g = applyLearnerMove(g, 'e2e4');
  expect(g.sans).toEqual(['e4']);
  expect(g.turn).toBe('b');
  g = applyBotMove(g, 'e7e5');
  expect(g.sans).toEqual(['e4', 'e5']);
  expect(g.turn).toBe('w');
});

test('take-back removes the last full move pair and counts it', () => {
  let g = game();
  g = applyBotMove(applyLearnerMove(g, 'e2e4'), 'e7e5');
  g = takeBack(g);
  expect(g.fen).toBe(START_FEN);
  expect(g.takebacks).toBe(1);
  expect(g.sans).toEqual([]);
  expect(g.turn).toBe('w');
});

test('take-back undoes a lost game back to the learner blunder', () => {
  let g = game();
  // Fool's mate: the learner (White) is mated, so the last ply is the bot's and the
  // learner's own blunder is the one before it. Both come off.
  g = applyBotMove(applyLearnerMove(g, 'f2f3'), 'e7e5');
  g = applyBotMove(applyLearnerMove(g, 'g2g4'), 'd8h4');
  expect(g.over).toEqual({ over: true, result: 'checkmate', winner: 'b' });
  g = takeBack(g);
  expect(g.over.over).toBe(false);
  expect(g.turn).toBe('w');
  expect(g.sans).toEqual(['f3', 'e5']);
});

test('take-back rewinds one ply when the game ended on the learner own move', () => {
  const mate = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  let g = game({ fen: mate, turn: 'w', history: [mate], sans: [] });
  g = applyLearnerMove(g, 'f3f7');
  expect(g.sans).toEqual(['Qxf7#']);
  expect(g.over).toEqual({ over: true, result: 'checkmate', winner: 'w' });
  g = takeBack(g);
  expect(g.fen).toBe(mate);
  expect(g.sans).toEqual([]);
  expect(g.takebacks).toBe(1);
});

test('take-back at the start is a no-op and does not count', () => {
  const g = game();
  expect(takeBack(g)).toBe(g);
});

test('take-backs are unlimited', () => {
  let g = game();
  for (let i = 0; i < 5; i++) {
    g = applyBotMove(applyLearnerMove(g, 'g1f3'), 'g8f6');
    g = applyBotMove(applyLearnerMove(g, 'f3g1'), 'f6g8');
  }
  for (let i = 0; i < 10; i++) g = takeBack(g);
  expect(g.fen).toBe(START_FEN);
  expect(g.takebacks).toBe(10);
});

test('hints are two-stage and counted once per move', () => {
  let g = game();
  g = applyHint(g, { piece: 'e2', square: 'e4' });
  expect(g.hintLevel).toBe(1);
  expect(g.hints).toBe(1);
  g = applyHint(g, { piece: 'e2', square: 'e4' });
  expect(g.hintLevel).toBe(2);
  expect(g.hints).toBe(1);
  g = applyHint(g, { piece: 'e2', square: 'e4' });
  expect(g.hintLevel).toBe(2);
  expect(g.hints).toBe(1);
  g = applyLearnerMove(g, 'e2e4');
  expect(g.hintLevel).toBe(0);
});

test('hint facts name the real piece on the board, never a placeholder', () => {
  const g = game();
  expect(hintCue(g, { piece: 'g1', square: 'f3' }, 1)).toEqual({
    event: 'hintPiece',
    facts: { pieceName: 'knight', square: 'g1' },
    tone: 'neutral',
  });
  expect(hintCue(g, { piece: 'g1', square: 'f3' }, 2)).toEqual({
    event: 'hintSquare',
    facts: { pieceName: 'knight', square: 'f3' },
    tone: 'neutral',
  });
  expect(hintCue(g, { piece: 'e4', square: 'e5' }, 1)).toBeNull();
});

test('crowns follow F-PL-4: three, two and one are each reachable', () => {
  expect(crowns({ hints: 0, takebacks: 0 })).toBe(3);
  expect(crowns({ hints: 1, takebacks: 0 })).toBe(2);
  expect(crowns({ hints: 2, takebacks: 1 })).toBe(2);
  expect(crowns({ hints: 0, takebacks: 3 })).toBe(2);
  expect(crowns({ hints: 4, takebacks: 0 })).toBe(1);
  expect(crowns({ hints: 2, takebacks: 2 })).toBe(1);
});

test('coachEventFor stays silent on a safe developing move', () => {
  const g = game({ fen: AFTER_1E4_E5, turn: 'w' });
  const after = applyMove(AFTER_1E4_E5, 'g1f3').fen;
  expect(coachEventFor(g, 'g1f3', after)).toBeNull();
});

test('coachEventFor reports a piece newly left hanging', () => {
  const g = game({ fen: KNIGHT_ON_F3, turn: 'w' });
  const after = applyMove(KNIGHT_ON_F3, 'f3g5').fen;
  expect(coachEventFor(g, 'f3g5', after)).toMatchObject({
    event: 'hang',
    facts: { pieceName: 'knight', square: 'g5' },
    tone: 'bad',
  });
});

test('coachEventFor reports a free capture that was missed', () => {
  const g = game({ fen: KNIGHT_ON_F3, turn: 'w' });
  const after = applyMove(KNIGHT_ON_F3, 'd2d3').fen;
  expect(coachEventFor(g, 'd2d3', after)).toMatchObject({
    event: 'missedCapture',
    facts: { pieceName: 'pawn', square: 'e5' },
    tone: 'bad',
  });
});

test('coachEventFor praises a free capture that was taken', () => {
  const g = game({ fen: KNIGHT_ON_F3, turn: 'w' });
  const after = applyMove(KNIGHT_ON_F3, 'f3e5').fen;
  expect(coachEventFor(g, 'f3e5', after)).toMatchObject({
    event: 'goodCapture',
    facts: { pieceName: 'pawn' },
    tone: 'good',
  });
});

test('coachEventFor reports an opponent threat the move ignored', () => {
  const g = game({ fen: KNIGHT_HANGING_ON_G5, turn: 'w' });
  const after = applyMove(KNIGHT_HANGING_ON_G5, 'a2a3').fen;
  expect(coachEventFor(g, 'a2a3', after)).toMatchObject({
    event: 'threatIgnored',
    facts: { threatSan: 'Qxg5' },
    tone: 'bad',
  });
});

test('coachEventFor stays silent when the move answers the threat', () => {
  // d3 opens the c1 bishop onto g5, so Qxg5 is no longer free and there is nothing to say.
  const g = game({ fen: KNIGHT_HANGING_ON_G5, turn: 'w' });
  const after = applyMove(KNIGHT_HANGING_ON_G5, 'd2d3').fen;
  expect(coachEventFor(g, 'd2d3', after)).toBeNull();
});

test('coachEventFor praises castling', () => {
  const g = game({ fen: CAN_CASTLE, turn: 'w' });
  const after = applyMove(CAN_CASTLE, 'e1g1').fen;
  expect(coachEventFor(g, 'e1g1', after)).toMatchObject({ event: 'castled', tone: 'good' });
});

test('preMoveEvent offers a mate and a check, and nothing otherwise', () => {
  // Scholar's mate is on the board for White: Qxf7#.
  const mate = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  expect(preMoveEvent(game({ fen: mate, turn: 'w' }))).toMatchObject({ event: 'mateAvailable' });
  // Black to move and in check, with no mate for Black.
  const check = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
  const inCheck = applyMove(check, 'd8h4').fen;
  expect(preMoveEvent(game({ learner: 'w', fen: inCheck, turn: 'w' }))).toMatchObject({ event: 'check' });
  expect(preMoveEvent(game({ fen: START_FEN, turn: 'w' }))).toBeNull();
});

test('showThreats draws the opponent capture as a danger arrow', () => {
  const g = showThreats(game({ fen: KNIGHT_HANGING_ON_G5, turn: 'w' }));
  expect(g.arrows).toEqual([{ from: 'd8', to: 'g5', color: 'danger' }]);
});

test('resign ends the game as a loss for the learner', () => {
  const g = resign(game());
  expect(g.over).toEqual({ over: true, result: 'resignation', winner: 'b' });
  expect(resultFor(g)).toBe('loss');
  expect(resign(g)).toBe(g);
});

test('the 10+0 clock decrements the side to move and flags on zero', () => {
  let g = initGame({ learner: 'w', persona: 'rosa', timeControl: '10+0', coach: true });
  expect(g.clockMs).toEqual({ w: 600_000, b: 600_000 });
  g = tickClock(g, 1000);
  expect(g.clockMs).toEqual({ w: 599_000, b: 600_000 });
  g = applyLearnerMove(g, 'e2e4');
  g = tickClock(g, 1000);
  expect(g.clockMs).toEqual({ w: 599_000, b: 599_000 });
  g = tickClock(g, 600_000);
  expect(g.clockMs).toEqual({ w: 599_000, b: 0 });
  expect(g.over).toEqual({ over: true, result: 'timeout', winner: 'w' });
  expect(resultFor(g)).toBe('win');
  // Once over, the clock stops.
  expect(tickClock(g, 1000)).toBe(g);
});

test('an untimed game has no clock to tick', () => {
  const g = game();
  expect(g.clockMs).toBeNull();
  expect(tickClock(g, 1000)).toBe(g);
});

test('resultFor is null while the game is running and a draw on stalemate', () => {
  expect(resultFor(game())).toBeNull();
  const stalemate = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
  expect(resultFor(game({ fen: stalemate, turn: 'b', over: { over: true, result: 'stalemate', winner: null } }))).toBe(
    'draw',
  );
});

test('crowns do not depend on the result: help used is all that grades them (F-PL-4)', () => {
  const played = { hints: 0, takebacks: 0 };
  for (const result of ['win', 'loss', 'draw'] as const) {
    expect(crowns(played)).toBe(3);
    expect(crownsNote(result, crowns(played))).toMatch(/crown/);
  }
});

test('a loss reports the crowns as help not used, never as a celebration', () => {
  expect(crownsNote('loss', 3)).toMatch(/without help/i);
  expect(crownsNote('loss', 3)).not.toMatch(/well played|nice|great/i);
  expect(crownsNote('draw', 1)).toMatch(/help/i);
  expect(crownsNote('win', 3)).toMatch(/no hints/i);
});

/*
 * ── WHAT THE THREATS BUTTON SAYS ─────────────────────────────────────────────
 *
 * `showThreats` drew arrows for `captures` and read nothing else, so three cases
 * came out as a control that does nothing at all. The cue is what closes them,
 * and the point of these tests is the three silences rather than the happy path:
 * each one below asserts the old behaviour is gone, and the first test in the
 * group is the control proving the position really is the case being described.
 */

/**
 * White (the learner) to move and NOT in check, but if Black had the move, Ra1
 * is mate: the white king on g1 is walled in by its own pawns on f2, g2 and h2.
 * Black has no capture at all here, so the OLD code drew zero arrows and said
 * nothing -- for a forced mate against the learner.
 */
const BLACK_MATES_NEXT = 'r6k/8/8/8/8/8/5PPP/6K1 w - - 0 1';

/** White to move and in check from the rook on e8. */
const WHITE_IN_CHECK = '4r2k/8/8/8/8/8/8/4K3 w - - 0 1';

test('the mate fixture is what it claims: a mate in one that is not a capture', () => {
  // The control. Without it the two assertions below could both pass on a
  // position where nothing was threatened at all.
  const t = threatsAgainst(BLACK_MATES_NEXT);
  expect(t.mate).not.toBeNull();
  expect(t.captures).toHaveLength(0);
});

test('a mate in one against the learner is reported, not silently dropped', () => {
  const cue = threatsCue(game({ fen: BLACK_MATES_NEXT, turn: 'w' }));
  expect(cue.event).toBe('threatsMate');
  expect(cue.facts.threatSan).toBe(threatsAgainst(BLACK_MATES_NEXT).mate);
  expect(cue.tone).toBe('bad');
  // And the old code's output on this position, for the record: no arrows.
  expect(showThreats(game({ fen: BLACK_MATES_NEXT, turn: 'w' })).arrows).toEqual([]);
});

test('in check, the empty result is reported as unanswerable, never as safety', () => {
  // `threatsAgainst` returns nothing here for a reason about the COMPUTATION,
  // not about the position -- its own comment says a caller must not render that
  // as reassurance (F-CO-4). So the cue must not be the same one a quiet board
  // gets.
  const cue = threatsCue(game({ fen: WHITE_IN_CHECK, turn: 'w' }));
  expect(cue.event).toBe('threatsUnknown');
  expect(cue.event).not.toBe('threatsNone');
});

test('a quiet board gets a line that stops short of calling it safe', () => {
  const cue = threatsCue(game({ fen: AFTER_1E4_E5, turn: 'w' }));
  expect(cue.event).toBe('threatsNone');
  // The arrows really are empty, so this IS the case the button used to answer
  // with nothing.
  expect(showThreats(game({ fen: AFTER_1E4_E5, turn: 'w' })).arrows).toEqual([]);
});

test('a capture to draw still gets the arrows-explaining line', () => {
  const g = game({ fen: KNIGHT_HANGING_ON_G5, turn: 'w' });
  expect(showThreats(g).arrows.length).toBeGreaterThan(0);
  expect(threatsCue(g).event).toBe('threatsShown');
});

test('the words and the arrows are read off the same position', () => {
  // Two functions, one `g`. This is the invariant that lets them stay separate:
  // a cue that says "arrows" must not be produced for a state whose arrows are
  // empty, and vice versa.
  for (const fen of [AFTER_1E4_E5, BLACK_MATES_NEXT, WHITE_IN_CHECK, KNIGHT_HANGING_ON_G5]) {
    const g = game({ fen, turn: 'w' });
    const drew = showThreats(g).arrows.length > 0;
    expect(threatsCue(g).event === 'threatsShown').toBe(drew);
  }
});

/*
 * ── THE WORST OF THE THREE, WHICH WAS NOT A SILENCE ──────────────────────────
 *
 * `threatsAgainst(fen)` answers for the side NOT to move. On the learner's turn
 * that is the opponent, which is the question the button asks. On the OPPONENT'S
 * turn it is the learner -- so the button drew the learner's own winning captures
 * in danger red and the coach called them threats against them. The button had no
 * turn guard, unlike Hint, and `thinking` did not disable it either.
 */
/**
 * Black (the bot) to move. White's rook on d1 can take the black queen on d4 for
 * nothing -- a winning capture FOR THE LEARNER. Black's own Qxd1 is not winning,
 * because the white king on e1 defends the rook. So the two directions give
 * different answers here, which is what makes the fixture able to show the
 * inversion rather than merely be consistent with it.
 */
const BOT_TO_MOVE_LEARNER_HAS_A_CAPTURE = '4k3/8/8/8/3q4/8/8/3RK3 b - - 0 1';

test('the inversion was real: on the bot’s turn the tagger reports the learner’s captures', () => {
  // The control, and the whole reason the guard exists. `threatsAgainst` reports
  // for the side that is NOT moving, so on the bot's turn it reports the
  // LEARNER's capture -- which the button would have drawn in danger red and the
  // coach would have called a threat against them.
  const asked = threatsAgainst(BOT_TO_MOVE_LEARNER_HAS_A_CAPTURE);
  expect(asked.captures.length).toBeGreaterThan(0);
  // It really is the learner's own move that comes back: a white piece moving.
  expect(asked.captures[0]!.uci.startsWith('d1')).toBe(true);
  // ...and the honest direction on the same position reports something else.
  const learnersTurn = BOT_TO_MOVE_LEARNER_HAS_A_CAPTURE.replace(' b ', ' w ');
  expect(threatsAgainst(learnersTurn).captures).not.toEqual(asked.captures);
});

test('on the opponent’s move the button refuses rather than inverting', () => {
  const g = game({ fen: BOT_TO_MOVE_LEARNER_HAS_A_CAPTURE, turn: 'b', learner: 'w' });
  expect(threatsCue(g).event).toBe('threatsNotYourTurn');
  // And no arrows, so nothing is drawn in danger red that is not a danger.
  expect(showThreats(g).arrows).toEqual([]);
});

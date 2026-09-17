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
  takeBack,
  tickClock,
  applyHint,
  type GameState,
} from './GameMachine';
import { crowns, crownsNote } from './crowns';
import { START_FEN, applyMove } from '@/rules';

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

import { goalMet, hasPromoted, type PlayItOut } from './goal';
import type { Challenge } from '../types';

const base = { id: 'g1', prompt: 'Hold it', concept: 'endgame' } satisfies Partial<Challenge>;

function drill(fen: string, goal: PlayItOut['goal']): PlayItOut {
  return { ...base, type: 'play_it_out', fen, goal };
}

// Knight versus pawns: the learner must survive, and a pawn getting through
// ends the drill as a failure even though nobody has been mated.
const KNIGHT_VS_PAWNS = '7k/8/8/8/8/8/3p4/4K1N1 w - - 0 1';

test('hold is still running before the move count is reached', () => {
  const c = drill(KNIGHT_VS_PAWNS, { kind: 'hold', moves: 6 });
  expect(goalMet(c, KNIGHT_VS_PAWNS, 'w', 2)).toBe(null);
});

test('hold is met once the learner survives the required moves', () => {
  const c = drill(KNIGHT_VS_PAWNS, { kind: 'hold', moves: 6 });
  expect(goalMet(c, KNIGHT_VS_PAWNS, 'w', 6)).toBe(true);
});

test('hold fails when the enemy promotes, even under-promoting and before the count', () => {
  const c = drill(KNIGHT_VS_PAWNS, { kind: 'hold', moves: 6 });
  const promoted = '7k/8/8/8/8/8/8/3nK1N1 w - - 0 2';
  expect(hasPromoted(KNIGHT_VS_PAWNS, promoted, 'b')).toBe(true);
  expect(goalMet(c, promoted, 'w', 2)).toBe(false);
  // and it still fails on the move the count would otherwise have passed
  expect(goalMet(c, promoted, 'w', 6)).toBe(false);
});

test('hold fails when the learner is mated', () => {
  const c = drill('8/8/8/8/8/7k/5q2/7K w - - 0 1', { kind: 'hold', moves: 6 });
  expect(goalMet(c, '8/8/8/8/8/7k/6q1/7K w - - 0 1', 'w', 1)).toBe(false);
});

test('mate_in is met by mating and failed by running out of moves', () => {
  const start = '7k/8/6K1/8/8/8/8/6R1 w - - 0 1';
  const c = drill(start, { kind: 'mate_in', moves: 2 });
  expect(goalMet(c, start, 'w', 0)).toBe(null);
  expect(goalMet(c, start, 'w', 2)).toBe(false);
  expect(goalMet(c, 'R6k/8/6K1/8/8/8/8/8 b - - 1 1', 'w', 1)).toBe(true);
});

test('promote counts a new piece, so an under-promotion that has moved still counts', () => {
  const start = '7k/4P3/8/8/8/8/8/7K w - - 0 1';
  const c = drill(start, { kind: 'promote', moves: 3 });
  expect(goalMet(c, start, 'w', 1)).toBe(null);
  expect(goalMet(c, '7k/8/5N2/8/8/8/8/7K b - - 0 2', 'w', 2)).toBe(true);
});

test('capture_all is met when only the enemy king is left', () => {
  const start = '7k/6p1/8/8/8/8/8/6RK w - - 0 1';
  const c = drill(start, { kind: 'capture_all', moves: 5 });
  expect(goalMet(c, start, 'w', 1)).toBe(null);
  expect(goalMet(c, '7k/6R1/8/8/8/8/8/7K b - - 0 2', 'w', 2)).toBe(true);
});

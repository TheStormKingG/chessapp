import { selectKeyMoments, MAX_MOMENTS } from './keyMoments';
import type { ReviewedMove } from './types';

function mv(o: Partial<ReviewedMove> & { ply: number }): ReviewedMove {
  return {
    san: 'e4',
    uci: 'e2e4',
    fenBefore: 'x',
    fenAfter: 'y',
    mover: 'w',
    best: { uci: 'e2e4', san: 'e4' },
    winBefore: 50,
    winAfterPlayed: 50,
    drop: 0,
    accuracy: 100,
    label: 'Good',
    book: false,
    phase: 'middlegame',
    ...o,
  };
}

test('only the learner’s own moves can be key moments', () => {
  const moves = [
    mv({ ply: 0, mover: 'w', drop: 40, winBefore: 60, winAfterPlayed: 20, label: 'Blunder' }),
    mv({ ply: 1, mover: 'b', drop: 50, winBefore: 60, winAfterPlayed: 10, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.every((m) => moves[m.ply]!.mover === 'w')).toBe(true);
});

test('the mistake that decided the game is the biggest drop that crossed 50', () => {
  const moves = [
    mv({ ply: 0, drop: 30, winBefore: 45, winAfterPlayed: 15, label: 'Blunder' }), // never above 50
    mv({ ply: 2, drop: 28, winBefore: 62, winAfterPlayed: 34, label: 'Blunder' }), // crossed
    mv({ ply: 4, drop: 35, winBefore: 40, winAfterPlayed: 5, label: 'Blunder' }), // bigger, never above 50
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'decided')?.ply).toBe(2);
});

test('a chance missed is the biggest drop from a winning position', () => {
  const moves = [
    mv({ ply: 0, drop: 5, winBefore: 50, winAfterPlayed: 45, label: 'Good' }),
    mv({ ply: 2, drop: 30, winBefore: 88, winAfterPlayed: 58, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'missed')?.ply).toBe(2);
});

test('a Miss label takes priority for the missed slot', () => {
  const moves = [
    mv({ ply: 0, drop: 18, winBefore: 60, winAfterPlayed: 42, label: 'Miss' }),
    mv({ ply: 2, drop: 30, winBefore: 88, winAfterPlayed: 58, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'missed')?.ply).toBe(0);
});

test('a good move the learner found is the biggest gain that was Best or Excellent', () => {
  const moves = [
    mv({ ply: 0, drop: 0, winBefore: 40, winAfterPlayed: 58, label: 'Best' }),
    mv({ ply: 2, drop: 0, winBefore: 50, winAfterPlayed: 52, label: 'Best' }),
    mv({ ply: 4, drop: 30, winBefore: 60, winAfterPlayed: 30, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'found')?.ply).toBe(0);
});

test('a book move is never a key moment, however large the swing', () => {
  const moves = [
    mv({ ply: 0, drop: 40, winBefore: 70, winAfterPlayed: 30, label: 'Book', book: true }),
    mv({ ply: 2, drop: 12, winBefore: 55, winAfterPlayed: 43, label: 'Mistake' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.some((m) => m.ply === 0)).toBe(false);
});

test('at most five moments, filled by descending swing', () => {
  const moves = Array.from({ length: 20 }, (_, i) =>
    mv({ ply: i * 2, drop: 30 - i, winBefore: 60, winAfterPlayed: 60 - (30 - i), label: 'Blunder' }),
  );
  const k = selectKeyMoments(moves, 'w');
  expect(k).toHaveLength(MAX_MOMENTS);
  // The five biggest swings, in ply order.
  expect(k.map((m) => m.ply)).toEqual([0, 2, 4, 6, 8]);
});

test('moments come back in ply order, not selection order', () => {
  const moves = [
    mv({ ply: 0, drop: 2, winBefore: 40, winAfterPlayed: 55, label: 'Best' }),
    mv({ ply: 2, drop: 30, winBefore: 62, winAfterPlayed: 32, label: 'Blunder' }),
    mv({ ply: 4, drop: 25, winBefore: 88, winAfterPlayed: 63, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.map((m) => m.ply)).toEqual([...k.map((m) => m.ply)].sort((a, b) => a - b));
});

test('no moment is selected twice under two kinds', () => {
  const moves = [mv({ ply: 0, drop: 40, winBefore: 90, winAfterPlayed: 50, label: 'Blunder' })];
  const k = selectKeyMoments(moves, 'w');
  expect(new Set(k.map((m) => m.ply)).size).toBe(k.length);
});

test('a clean short game yields fewer than three rather than padding', () => {
  // F-RV-4 asks for UP TO five moments, not three to five. There is no floor:
  // three is named here as a literal because it is the number the old floor
  // used, not because any constant still holds it.
  const moves = [mv({ ply: 0, drop: 0, label: 'Best' }), mv({ ply: 2, drop: 0.5, label: 'Excellent' })];
  const k = selectKeyMoments(moves, 'w');
  expect(k.length).toBeLessThan(3);
  // And nothing with a zero swing is presented as a "moment".
  expect(k.every((m) => m.kind === 'found')).toBe(true);
});

test('a game with no learner moves at all yields nothing', () => {
  expect(selectKeyMoments([mv({ ply: 1, mover: 'b', drop: 40 })], 'w')).toEqual([]);
});

test('a move that qualifies for two kinds does not cost the other kind its slot', () => {
  // Ply 0 is both a Miss and a drop that crossed 50, so it can serve either
  // kind but only appear once. Ply 2 is a plain decider. F-RV-4 b asks for one
  // of each kind WHERE PRESENT, and both kinds are present here.
  const moves = [
    mv({ ply: 0, drop: 30, winBefore: 60, winAfterPlayed: 30, label: 'Miss' }),
    mv({ ply: 2, drop: 25, winBefore: 70, winAfterPlayed: 45, label: 'Blunder' }),
  ];
  const k = selectKeyMoments(moves, 'w');
  expect(k.find((m) => m.kind === 'missed')?.ply).toBe(0);
  expect(k.find((m) => m.kind === 'decided')?.ply).toBe(2);
});

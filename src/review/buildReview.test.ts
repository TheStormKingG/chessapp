import { buildReview, judgeMoves } from './buildReview';
import type { AnalysedPosition } from './types';
import { positionsOf } from './gameSource';

const SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'];

function analysed(wins: number[]): AnalysedPosition[] {
  const { fens } = positionsOf(SANS);
  return wins.map((win, i) => ({ index: i, fen: fens[i], win, bestUci: 'a2a3', pv: ['a2a3'], depth: 14 }));
}

test('the mover’s win per cent after a move is 100 minus the next position’s', () => {
  // Position 0: white to move, 60. Position 1: black to move, 55, so white sits
  // at 45 after the move — a 15-point drop for white.
  const moves = judgeMoves({
    positions: analysed([60, 55, 50, 50, 50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  expect(moves[0].winBefore).toBe(60);
  expect(moves[0].winAfterPlayed).toBe(45);
  expect(moves[0].drop).toBe(15);
  expect(moves[0].mover).toBe('w');
  expect(moves[0].label).toBe('Mistake');
});

test('a move that improves the position has a drop of zero, never a negative one', () => {
  const moves = judgeMoves({
    positions: analysed([40, 30, 50, 50, 50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  // White was at 40; after the move black sits at 30, so white is at 70.
  expect(moves[0].winAfterPlayed).toBe(70);
  expect(moves[0].drop).toBe(0);
  expect(moves[0].label).toBe('Best');
});

test('a partial analysis judges only the moves it has both ends of', () => {
  // Five positions cover four moves, not eight.
  const moves = judgeMoves({
    positions: analysed([50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  expect(moves).toHaveLength(4);
});

test('accuracy is the mean over non-book moves, per side', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([60, 55, 55, 55, 55, 55, 55, 55, 55]),
    band: 1,
    book: { name: 'Italian Game', leftBookAtPly: 4, bookPlies: [true, true, true, true, false, false, false, false] },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.opening).toEqual({ name: 'Italian Game', leftBookAtPly: 4 });
  // Plies 0-3 are book and excluded from both sides' accuracy.
  expect(r.moves.filter((m) => m.book)).toHaveLength(4);
  expect(r.accuracy.w).not.toBeNull();
  expect(r.accuracy.b).not.toBeNull();
});

test('a side with no non-book moves has null accuracy, not 100', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: ['e4'], result: 'draw', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([50, 50]).slice(0, 2),
    band: 1,
    book: { name: "King's Pawn Game", leftBookAtPly: null, bookPlies: [true] },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.accuracy.w).toBeNull();
  expect(r.accuracy.b).toBeNull();
});

test('counts are per label and omit labels that did not occur', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([60, 55, 55, 55, 55, 55, 55, 55, 55]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  expect(total).toBe(r.moves.length);
  expect(r.counts.Brilliant).toBeUndefined();
});

test('the turning phase is where the learner’s biggest crossing of 50 happened', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'loss', timeControl: 'untimed', startedAt: 'x' },
    // White at 70; after ply 4 the position is lost.
    positions: analysed([70, 30, 70, 30, 70, 80, 20, 50, 50]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.turningPhase).toBe('opening'); // all within the first ten moves
});

test('a game that never turned reports null rather than guessing a phase', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'draw', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([52, 48, 52, 48, 52, 48, 52, 48, 52]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.turningPhase).toBeNull();
});

test('the review carries its depth and its partial flag through', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([50, 50, 50]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 10,
    partial: true,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.depth).toBe(10);
  expect(r.partial).toBe(true);
});

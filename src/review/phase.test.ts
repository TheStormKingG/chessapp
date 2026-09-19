import { phaseOf, nonKingMaterial } from './phase';
import { START_FEN } from '@/rules';

test('material counts both sides and excludes kings', () => {
  // 8 pawns + 2 rooks + 2 knights + 2 bishops + 1 queen = 8 + 10 + 6 + 6 + 9 = 39 a side.
  expect(nonKingMaterial(START_FEN)).toBe(78);
});

test('the opening is the first ten moves, or while still in book', () => {
  expect(phaseOf({ ply: 0, fen: START_FEN, inBook: true })).toBe('opening');
  expect(phaseOf({ ply: 19, fen: START_FEN, inBook: false })).toBe('opening');
  // Out of the opening by ply count, but still theory: still the opening.
  expect(phaseOf({ ply: 24, fen: START_FEN, inBook: true })).toBe('opening');
});

test('the endgame is thin material, whatever the ply', () => {
  // Kings and a rook each.
  const thin = '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1';
  expect(phaseOf({ ply: 25, fen: thin, inBook: false })).toBe('endgame');
  // Two rooks a side plus pawns is still a middlegame by this rule.
});

test('everything else is the middlegame', () => {
  const mid = 'r1bq1rk1/pp2ppbp/2np1np1/8/2BNP3/2N1B3/PPP2PPP/R2Q1RK1 w - - 0 10';
  expect(phaseOf({ ply: 20, fen: mid, inBook: false })).toBe('middlegame');
});

test('a thin position inside the first ten moves is still the opening', () => {
  // The opening rule wins: a ten-move game that reached a bare-kings ending was
  // still in its opening, and calling it an endgame would put the error log's
  // phase counts somewhere nobody would look for them.
  const thin = '4k3/8/8/8/8/8/8/4K3 w - - 0 5';
  expect(phaseOf({ ply: 8, fen: thin, inBook: false })).toBe('opening');
});

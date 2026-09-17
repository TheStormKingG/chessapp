import { START_FEN, legalMoves, applyMove, isCheck, isCheckmate, isStalemate, pieceAt, piecesOf, attackersOf, gameStatus, toSan } from './rules';

const scholars = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

test('start position has 20 legal moves', () => {
  expect(legalMoves(START_FEN)).toHaveLength(20);
});

test('applyMove accepts SAN and UCI and returns the new FEN', () => {
  const a = applyMove(START_FEN, 'e4');
  const b = applyMove(START_FEN, 'e2e4');
  expect(a.fen).toBe(b.fen);
  expect(a.san).toBe('e4');
  expect(a.uci).toBe('e2e4');
  expect(a.capture).toBe(false);
});

test('applyMove rejects illegal moves', () => {
  expect(() => applyMove(START_FEN, 'e5')).toThrow(/illegal/i);
});

test('Qxf7# is checkmate', () => {
  const { fen } = applyMove(scholars, 'Qxf7#');
  expect(isCheck(fen)).toBe(true);
  expect(isCheckmate(fen)).toBe(true);
  expect(gameStatus(fen)).toEqual({ over: true, result: 'checkmate', winner: 'w' });
});

test('stalemate is detected', () => {
  const fen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
  expect(isStalemate(fen)).toBe(true);
  expect(gameStatus(fen)).toEqual({ over: true, result: 'stalemate', winner: null });
});

test('pieceAt and attackersOf', () => {
  expect(pieceAt(START_FEN, 'e1')).toEqual({ type: 'k', color: 'w' });
  expect(pieceAt(START_FEN, 'e4')).toBeNull();
  expect(attackersOf(scholars, 'f7', 'w').sort()).toEqual(['c4', 'h5']);
});

test('toSan converts uci in context', () => {
  expect(toSan(scholars, 'h5f7')).toBe('Qxf7#');
});

// Teaching boards for the board-vision lessons legitimately have no kings
// (the content verifier allows kingless FENs for those challenge types), so
// the read-only accessors must work on them. The move functions must not.
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
const KINGLESS_FEN = '8/8/3n4/8/8/8/4R3/8 w - - 0 1';

test('pieceAt reads an empty kingless board without throwing', () => {
  expect(pieceAt(EMPTY_FEN, 'e4')).toBeNull();
});

test('pieceAt names pieces on a kingless board', () => {
  expect(pieceAt(KINGLESS_FEN, 'd6')).toEqual({ type: 'n', color: 'b' });
  expect(pieceAt(KINGLESS_FEN, 'e2')).toEqual({ type: 'r', color: 'w' });
  expect(pieceAt(KINGLESS_FEN, 'a1')).toBeNull();
});

test('piecesOf enumerates a kingless board', () => {
  expect(piecesOf(KINGLESS_FEN, 'w')).toEqual([{ square: 'e2', piece: { type: 'r', color: 'w' } }]);
  expect(piecesOf(KINGLESS_FEN, 'b')).toEqual([{ square: 'd6', piece: { type: 'n', color: 'b' } }]);
  expect(piecesOf(EMPTY_FEN, 'w')).toEqual([]);
});

test('move functions still reject a kingless position rather than pretend', () => {
  expect(() => legalMoves(KINGLESS_FEN)).toThrow(/fen/i);
  expect(() => applyMove(KINGLESS_FEN, 'e2e4')).toThrow();
  expect(() => gameStatus(KINGLESS_FEN)).toThrow(/fen/i);
});

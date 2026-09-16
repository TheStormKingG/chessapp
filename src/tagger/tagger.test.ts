import { facts, hangingPieces, justCastled, mateInOne, threatsAgainst, winningCaptures } from './tagger';

// Black knight on e5 attacked by white pawn on d4, undefended. The knight
// does not attack d4 (knight squares from e5: c4, c6, d3, d7, f3, f7, g4, g6),
// so white has nothing hanging. Verified with chess.js `attackers`.
const hang = '4k3/8/8/4n3/3P4/8/8/4K3 w - - 0 1';

// White queen on d1 takes the black pawn on d3 for free. The pawn is not
// defended by anything (the king on e8 is far away) and Qxd3 is not check.
//
// The plan's original FEN ('rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w
// KQkq - 0 3', expecting 'Qxf7+') was wrong: chess.js counts the king on e8 as
// a defender of f7, so a queen taking a king-defended pawn loses material and
// is correctly NOT a winning capture. The plan's suggested replacement
// ('4k3/8/8/8/8/8/3p4/4K1Q1 w - - 0 1') was also wrong: the pawn on d2 gives
// check to the king on e1, so the only legal capture is Kxd2, not a queen
// capture. This FEN was verified with `legalMoves`: the only capture is
// 'Qxd3', and `attackersOf(after, 'd3', 'b')` is empty.
const freePawn = '4k3/8/8/8/8/3p4/8/3QK3 w - - 0 1';

// Scholar's mate: Qxf7# is the only mating move (verified with chess.js).
const scholars = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

test('hangingPieces finds an attacked undefended piece', () => {
  expect(hangingPieces(hang, 'b')).toEqual([{ square: 'e5', piece: 'n', value: 3 }]);
  expect(hangingPieces(hang, 'w')).toEqual([]);
});

test('hangingPieces reports a defended piece attacked by something cheaper', () => {
  // Black queen on e5 defended by the pawn on d6, attacked by the white pawn on d4.
  const cheap = '4k3/8/3p4/4q3/3P4/8/8/K7 w - - 0 1';
  expect(hangingPieces(cheap, 'b')).toEqual([{ square: 'e5', piece: 'q', value: 9 }]);
});

test('winningCaptures lists captures that win material', () => {
  const c = winningCaptures(freePawn);
  expect(c.map((x) => x.san)).toContain('Qxd3');
  expect(c).toEqual([{ san: 'Qxd3', uci: 'd1d3', gain: 1, target: 'd3' }]);
});

test('winningCaptures excludes a capture of a king-defended pawn', () => {
  const kingDefended = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3';
  expect(winningCaptures(kingDefended).map((x) => x.san)).not.toContain('Qxf7+');
});

test('mateInOne finds Qxf7#', () => {
  expect(mateInOne(scholars)).toBe('Qxf7#');
  expect(mateInOne(hang)).toBeNull();
});

test('justCastled detects castling from the SAN', () => {
  expect(justCastled('O-O')).toBe(true);
  expect(justCastled('O-O-O')).toBe(true);
  expect(justCastled('O-O+')).toBe(true);
  expect(justCastled('Nf3')).toBe(false);
});

test('threatsAgainst asks what the opponent could do if it were their move', () => {
  // Black to move in the Scholar's position: white threatens Qxf7#.
  const blackToMove = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 4 4';
  const t = threatsAgainst(blackToMove);
  expect(t.mate).toBe('Qxf7#');
});

test('threatsAgainst returns no threats when flipping the turn would be illegal', () => {
  // White to move and in check from the pawn on d2; giving black the move here
  // would leave white in check on black's turn, which is not a legal position.
  const inCheck = '4k3/8/8/8/8/8/3p4/4K1Q1 w - - 0 1';
  expect(threatsAgainst(inCheck)).toEqual({ captures: [], mate: null });
});

test('facts summarises a position for the side to move', () => {
  // The plan used the Scholar's FEN here, but in that position none of white's
  // captures win material (f7, h7 and e5 are all defended), so `captures` is
  // empty. This variant drops black's c6 knight: Qxf7# still mates and Qxe5+
  // now takes an undefended pawn. Verified with chess.js `attackers`/`moves`.
  const scholarsNoNc6 = 'r1bqkb1r/pppp1ppp/5n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const f = facts(scholarsNoNc6);
  expect(f.mateInOne).toBe('Qxf7#');
  expect(f.inCheck).toBe(false);
  expect(f.captures.length).toBeGreaterThan(0);
  expect(f.captures.map((x) => x.san)).toContain('Qxe5+');
  expect(f.theirHanging.map((h) => h.square)).toContain('e5');
});

import { describeSquare } from './describeSquare';
import { START_FEN } from '@/rules';

const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
const KINGLESS_FEN = '8/8/3n4/8/8/8/4R3/8 w - - 0 1';

test('describes a square on a normal position', () => {
  expect(describeSquare(START_FEN, 'e1')).toBe('e1, white king');
  expect(describeSquare(START_FEN, 'e4')).toBe('e4, empty');
});

// F-AX-1: unit 1.1 teaches board vision on an empty board; describeSquare
// feeds the live status region there and must not throw on a kingless FEN.
test('describes squares on an empty kingless teaching board', () => {
  expect(describeSquare(EMPTY_FEN, 'e4')).toBe('e4, empty');
  expect(describeSquare(EMPTY_FEN, 'h8')).toBe('h8, empty');
});

test('names pieces on a kingless teaching board', () => {
  expect(describeSquare(KINGLESS_FEN, 'd6')).toBe('d6, black knight');
  expect(describeSquare(KINGLESS_FEN, 'e2')).toBe('e2, white rook');
});

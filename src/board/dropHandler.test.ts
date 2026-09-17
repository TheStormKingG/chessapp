import { handleDrop } from './dropHandler';
import { START_FEN } from '@/rules';

test('legal drop returns the move', () => {
  expect(handleDrop(START_FEN, 'play', false, 'e2', 'e4')).toEqual({ from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' });
});

test('null target (dropped off board) returns null', () => {
  expect(handleDrop(START_FEN, 'play', false, 'e2', null)).toBeNull();
});

test('illegal target returns null', () => {
  expect(handleDrop(START_FEN, 'play', false, 'e2', 'e5')).toBeNull();
});

test('disabled board returns null', () => {
  expect(handleDrop(START_FEN, 'play', true, 'e2', 'e4')).toBeNull();
});

test('non-play modes return null', () => {
  expect(handleDrop(START_FEN, 'select', false, 'e2', 'e4')).toBeNull();
  expect(handleDrop(START_FEN, 'static', false, 'e2', 'e4')).toBeNull();
});

test('promotion defaults to queen', () => {
  const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
  expect(handleDrop(fen, 'play', false, 'a7', 'a8')).toMatchObject({ uci: 'a7a8q', san: 'a8=Q+' });
});

import { checkAnswer } from './answers';
import type { Challenge } from './types';

const ftm: Challenge = {
  id: 'x',
  type: 'find_the_move',
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  prompt: '',
  concept: 'mate',
  answer: { moves: ['Qxf7#'] },
  wrong: { 'Bxf7+': 'Check, but the king escapes.' },
};

test('find_the_move accepts SAN or UCI form of a solution', () => {
  expect(checkAnswer(ftm, { kind: 'move', uci: 'h5f7' })).toEqual({ correct: true });
  expect(checkAnswer(ftm, { kind: 'move', uci: 'c4f7' })).toEqual({
    correct: false,
    authored: 'Check, but the king escapes.',
  });
  expect(checkAnswer(ftm, { kind: 'move', uci: 'g1f3' })).toEqual({ correct: false });
});

test('find_them_all requires the exact set', () => {
  const c: Challenge = {
    id: 'y',
    type: 'find_them_all',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    prompt: '',
    concept: 'f',
    answer: { squares: ['d1', 'd2'] },
  };
  expect(checkAnswer(c, { kind: 'squares', squares: ['d2', 'd1'] })).toEqual({ correct: true });
  expect(checkAnswer(c, { kind: 'squares', squares: ['d1'] })).toEqual({
    correct: false,
    missing: ['d2'],
    extra: [],
  });
});

test('which_square, name_the_pattern, is_it_safe', () => {
  expect(
    checkAnswer(
      { id: 'a', type: 'which_square', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: '', concept: 'c', answer: { square: 'e4' } },
      { kind: 'square', square: 'e4' },
    ),
  ).toEqual({ correct: true });
  expect(
    checkAnswer(
      {
        id: 'b',
        type: 'name_the_pattern',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        prompt: '',
        concept: 'c',
        options: ['Fork', 'Pin', 'Skewer'],
        answer: { option: 1 },
      },
      { kind: 'option', option: 0 },
    ),
  ).toEqual({ correct: false });
  expect(
    checkAnswer(
      {
        id: 'c',
        type: 'is_it_safe',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        prompt: '',
        concept: 'c',
        move: 'e4',
        reasons: ['a', 'b', 'c'],
        answer: { safe: true, reason: 0 },
      },
      { kind: 'safe', safe: true, reason: 0 },
    ),
  ).toEqual({ correct: true });
});

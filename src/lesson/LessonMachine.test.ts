import { initLesson, reduce, type LessonState } from './LessonMachine';
import type { Lesson } from './types';

const lesson: Lesson = {
  id: '9.9.1',
  unit: '9.9',
  title: 't',
  xp: 10,
  card: { idea: 'i', diagrams: [] },
  explain: [{ fen: '8/8/8/8/8/8/8/8 w - - 0 1', text: 'e' }],
  challenges: [
    {
      id: 'c1',
      type: 'which_square',
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      prompt: 'p',
      concept: 'x',
      answer: { square: 'e4' },
      hints: { square: 'e4' },
      reason: 'because',
    },
    {
      id: 'c2',
      type: 'find_the_move',
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      prompt: 'p',
      concept: 'y',
      answer: { moves: ['Qxf7#'] },
      hints: { piece: 'h5', square: 'f7' },
    },
  ],
  takeaway: 'tk',
};

function run(...actions: Parameters<typeof reduce>[1][]): LessonState {
  return actions.reduce((s, a) => reduce(s, a), initLesson(lesson));
}

test('walks card → explain → challenges → close', () => {
  let s = initLesson(lesson);
  expect(s.phase).toEqual({ kind: 'card' });
  s = reduce(s, { type: 'next' });
  expect(s.phase).toEqual({ kind: 'explain', index: 0 });
  s = reduce(s, { type: 'next' });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 0, status: 'attempting' });
});

test('correct first try records credit and moves on with next', () => {
  const s = run({ type: 'next' }, { type: 'next' }, { type: 'attempt', attempt: { kind: 'square', square: 'e4' } });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 0, status: 'correct' });
  expect(s.results['c1']).toEqual({ correct: true, hints: 0, misses: 0, mastery: true });
  expect(s.feedback).toBe('because');
});

test('first miss → retry; second miss → reveal; hint removes mastery credit', () => {
  let s = run({ type: 'next' }, { type: 'next' }, { type: 'attempt', attempt: { kind: 'square', square: 'a1' } });
  expect(s.phase).toMatchObject({ kind: 'challenge', status: 'retry' });
  s = reduce(s, { type: 'hint' });
  expect(s.hintLevel).toBe(1);
  expect(s.highlights).toEqual({ e4: 'accent' });
  s = reduce(s, { type: 'attempt', attempt: { kind: 'square', square: 'b2' } });
  expect(s.phase).toMatchObject({ kind: 'challenge', status: 'revealed' });
  expect(s.results['c1']).toEqual({ correct: false, hints: 1, misses: 2, mastery: false });
});

test('an externally detected miss applies the same retry logic as a wrong attempt', () => {
  let s = run(
    { type: 'next' },
    { type: 'next' },
    { type: 'attempt', attempt: { kind: 'square', square: 'e4' } },
    { type: 'next' },
    { type: 'miss', san: 'Bxf7+' },
  );
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 1, status: 'retry' });
  expect(s.results['c2']).toEqual({ correct: false, hints: 0, misses: 1, mastery: false });
  expect(s.totalMisses).toBe(1);
  s = reduce(s, { type: 'miss', san: 'Nf3' });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 1, status: 'revealed' });
  expect(s.results['c2']).toEqual({ correct: false, hints: 0, misses: 2, mastery: false });
});

test('a miss carries the authored feedback for that specific wrong move', () => {
  const withAuthored: Lesson = {
    ...lesson,
    challenges: [
      {
        id: 'c2',
        type: 'find_the_move',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        prompt: 'p',
        concept: 'y',
        answer: { moves: ['Qxf7#'] },
        hints: { piece: 'h5', square: 'f7' },
        wrong: { 'Bxf7+': 'Check, but the king escapes.' },
      },
    ],
  };
  let s = initLesson(withAuthored);
  s = reduce(reduce(s, { type: 'next' }), { type: 'next' });
  s = reduce(s, { type: 'miss', san: 'Bxf7+' });
  expect(s.feedback).toBe('Check, but the king escapes.');
  expect(s.feedbackTone).toBe('bad');
});

test('correct after a hint: progress credit, no mastery', () => {
  const s = run(
    { type: 'next' },
    { type: 'next' },
    { type: 'hint' },
    { type: 'attempt', attempt: { kind: 'square', square: 'e4' } },
  );
  expect(s.results['c1']).toEqual({ correct: true, hints: 1, misses: 0, mastery: false });
});

test('close computes stars and xp', () => {
  let s = run(
    { type: 'next' },
    { type: 'next' },
    { type: 'attempt', attempt: { kind: 'square', square: 'e4' } },
    { type: 'next' },
  );
  s = reduce(s, { type: 'attempt', attempt: { kind: 'move', uci: 'h5f7' } });
  s = reduce(s, { type: 'next' });
  expect(s.phase).toEqual({ kind: 'close', stars: 3, xp: 10 });
});

test('hints disabled flag blocks hints (checkpoints)', () => {
  const s0 = { ...initLesson(lesson), hintsAllowed: false };
  const s = reduce(reduce(reduce(s0, { type: 'next' }), { type: 'next' }), { type: 'hint' });
  expect(s.hintLevel).toBe(0);
});

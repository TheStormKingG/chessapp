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

test('reveal clears a pending engine refutation', () => {
  let s = run({ type: 'next' }, { type: 'next' }, { type: 'attempt', attempt: { kind: 'square', square: 'a1' } });
  s = reduce(s, { type: 'engineRefutation', from: 'a1', to: 'a2', text: 'Then this.' });
  expect(s.refutation).toEqual({ from: 'a1', to: 'a2' });
  s = reduce(s, { type: 'reveal' });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 0, status: 'revealed' });
  expect(s.refutation).toBeNull();
  expect(s.highlights).toEqual({ e4: 'accent' });
});

// ---- Defect 1: mastery must mean a clean answer (PRD 6.4 / 7.3 / F-PZ-4). ----

test('a correct answer after a miss earns progress but no mastery credit', () => {
  const s = run(
    { type: 'next' },
    { type: 'next' },
    { type: 'attempt', attempt: { kind: 'square', square: 'a1' } },
    { type: 'attempt', attempt: { kind: 'square', square: 'e4' } },
  );
  expect(s.results['c1']).toEqual({ correct: true, hints: 0, misses: 1, mastery: false });
});

// ---- Defect 2: the machine says whether a hint is available. ----

test('hintAvailable is false on a challenge that declares no hints', () => {
  const hintless: Lesson = {
    ...lesson,
    challenges: [{ ...lesson.challenges[0]!, hints: undefined }],
  };
  let s = initLesson(hintless);
  s = reduce(reduce(s, { type: 'next' }), { type: 'next' });
  expect(s.hintAvailable).toBe(false);
  expect(reduce(s, { type: 'hint' })).toBe(s);
});

test('hintAvailable tracks the stages left, and is false once they are spent', () => {
  let s = run({ type: 'next' }, { type: 'next' });
  // c1 authors one hint square only: one stage, then nothing.
  expect(s.hintAvailable).toBe(true);
  s = reduce(s, { type: 'hint' });
  expect(s.hintLevel).toBe(1);
  expect(s.hintAvailable).toBe(false);
});

test('hintAvailable is false when hints are disallowed', () => {
  const s = reduce(reduce(initLesson(lesson, false), { type: 'next' }), { type: 'next' });
  expect(s.hintAvailable).toBe(false);
});

// ---- Defect 3: the second hint must say something new. ----

test('a second hint is not offered when it would repeat the first', () => {
  const onlyPiece: Lesson = {
    ...lesson,
    challenges: [{ ...lesson.challenges[1]!, hints: { piece: 'h5' } }],
  };
  let s = reduce(reduce(initLesson(onlyPiece), { type: 'next' }), { type: 'next' });
  s = reduce(s, { type: 'hint' });
  expect(s.highlights).toEqual({ h5: 'accent' });
  expect(s.hintAvailable, 'nothing new is left to show').toBe(false);
  const after = reduce(s, { type: 'hint' });
  expect(after.hintLevel, 'and the repeat is not charged').toBe(1);
  expect(after.totalHints).toBe(1);
});

test('an authored text hint is a hint stage of its own', () => {
  const texty: Lesson = {
    ...lesson,
    challenges: [
      { ...lesson.challenges[0]!, hints: { text: 'It is on the e-file.', text2: 'It is on the fourth rank.' } },
    ],
  };
  let s = reduce(reduce(initLesson(texty), { type: 'next' }), { type: 'next' });
  s = reduce(s, { type: 'hint' });
  expect(s.feedback).toBe('It is on the e-file.');
  expect(s.highlights).toEqual({});
  expect(s.hintAvailable).toBe(true);
  s = reduce(s, { type: 'hint' });
  expect(s.feedback).toBe('It is on the fourth rank.');
  expect(s.totalHints).toBe(2);
  expect(s.hintAvailable).toBe(false);
});

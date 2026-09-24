import { expect, test } from 'vitest';
import { applyMove } from '@/rules';
import { initLesson, reduce, type LessonState } from './LessonMachine';
import type { Lesson } from './types';

/**
 * The board must show the move the learner just played.
 *
 * Reported from the live app on lesson 1.1.3: "I followed the instruction and
 * took the knight but the board pieces did not change." The cause is that
 * `ChallengeView` renders `<Board fen={c.fen}>` — the challenge's STARTING
 * position, always — so an accepted move is graded and then the piece snaps
 * back to where it began. The learner is told they are right while being shown
 * the opposite.
 *
 * The position belongs to the machine rather than the view, because the machine
 * is what knows WHICH move was accepted: a challenge may allow several, and
 * showing a different correct move than the one played would be its own bug.
 */
const FEN = '4k3/1p3p2/8/3n4/8/1B6/5PP1/6K1 w - - 0 1'; // the reported position

const lesson: Lesson = {
  id: '9.9.1',
  unit: '9.9',
  title: 't',
  xp: 10,
  card: { idea: 'i', diagrams: [] },
  explain: [],
  challenges: [
    {
      id: 'c1',
      type: 'find_the_move',
      fen: FEN,
      prompt: 'Take the knight.',
      concept: 'bishop-moves',
      answer: { moves: ['Bxd5'] },
      hints: { piece: 'b3', square: 'd5' },
      reason: 'on your diagonal',
    },
    {
      id: 'c2',
      type: 'which_square',
      fen: FEN,
      prompt: 'Tap d5.',
      concept: 'bishop-moves',
      answer: { square: 'd5' },
      hints: { square: 'd5' },
    },
  ],
  takeaway: 'tk',
};

const atFirstChallenge = (): LessonState => reduce(initLesson(lesson), { type: 'next' });

/** The reported 2.3 shape: a pawn push judged before it is played. */
const SAFE_FEN = '4k3/pp5p/2n5/8/B7/3P4/6PP/6K1 w - - 0 1';
const safeLesson: Lesson = {
  ...lesson,
  challenges: [
    {
      id: 's1',
      type: 'is_it_safe',
      fen: SAFE_FEN,
      move: 'd4',
      prompt: 'White pushes the pawn to d4. Is the pawn safe there?',
      concept: 'absolute-pin',
      reasons: ['Yes, the knight is pinned.', 'No, the knight takes it.', 'No, the king collects it.'],
      answer: { safe: true, reason: 0 },
    },
  ],
};

test('a correct move leaves the position AFTER that move on the state', () => {
  const s = reduce(atFirstChallenge(), {
    type: 'attempt',
    attempt: { kind: 'move', uci: 'b3d5' },
  });
  expect(s.phase).toMatchObject({ status: 'correct' });
  expect(s.answeredFen, 'the machine graded the move but kept no position').toBe(
    applyMove(FEN, 'b3d5').fen,
  );
  // The whole point: it is NOT the position the challenge started from.
  expect(s.answeredFen).not.toBe(FEN);
});

test('a wrong move leaves no position, so nothing is shown as played', () => {
  const s = reduce(atFirstChallenge(), {
    type: 'attempt',
    attempt: { kind: 'move', uci: 'b3c4' },
  });
  expect(s.phase).toMatchObject({ status: 'retry' });
  expect(s.answeredFen).toBeNull();
});

test('revealing shows the answer played out, not the starting position', () => {
  // "Show me" that does not show the move is the same defect wearing a hat.
  const s = reduce(atFirstChallenge(), { type: 'reveal' });
  expect(s.phase).toMatchObject({ status: 'revealed' });
  expect(s.answeredFen).toBe(applyMove(FEN, 'Bxd5').fen);
});

test('moving on clears it, so the next challenge starts from its own position', () => {
  const answered = reduce(atFirstChallenge(), {
    type: 'attempt',
    attempt: { kind: 'move', uci: 'b3d5' },
  });
  expect(answered.answeredFen).not.toBeNull();
  expect(reduce(answered, { type: 'next' }).answeredFen).toBeNull();
});

test('a second miss auto-reveals, and shows the answer played out', () => {
  // There is no `retry` ACTION -- 'retry' is a status, and a learner retries by
  // attempting again. The second miss reveals, and a reveal that does not show
  // the move is the defect this whole file is about.
  let s = reduce(atFirstChallenge(), { type: 'attempt', attempt: { kind: 'move', uci: 'b3c4' } });
  expect(s.phase).toMatchObject({ status: 'retry' });
  expect(s.answeredFen, 'a retry must sit on the real position').toBeNull();

  s = reduce(s, { type: 'attempt', attempt: { kind: 'move', uci: 'g1f1' } });
  expect(s.phase).toMatchObject({ status: 'revealed' });
  expect(s.answeredFen).toBe(applyMove(FEN, 'Bxd5').fen);
});

test('an is_it_safe shows its proposed move ONCE ANSWERED, never before', () => {
  /*
   * The exercise is judging a move you have not played -- "you want to play the
   * queen to d4, is that safe?" -- which is the sanity-check-before-you-move
   * skill. Showing the move up front would delete the exercise, so the board
   * stays on the real position while the question is open.
   *
   * But once the verdict and the reason are in, the answer was only ever
   * DESCRIBED. Playing the move then demonstrates it, which is the payoff the
   * challenge never had.
   */
  let s = reduce(initLesson(safeLesson), { type: 'next' });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 0 });
  expect(s.answeredFen, 'the move must not be shown while the question is open').toBeNull();

  s = reduce(s, { type: 'attempt', attempt: { kind: 'safe', safe: true, reason: 0 } });
  expect(s.phase).toMatchObject({ status: 'correct' });
  expect(s.answeredFen).toBe(applyMove(SAFE_FEN, 'd4').fen);
});

test('a wrong is_it_safe verdict still leaves the question open on the real board', () => {
  let s = reduce(initLesson(safeLesson), { type: 'next' });
  s = reduce(s, { type: 'attempt', attempt: { kind: 'safe', safe: false, reason: 1 } });
  expect(s.phase).toMatchObject({ status: 'retry' });
  expect(s.answeredFen).toBeNull();
});

test('a square-pick challenge never produces a position', () => {
  // `which_square` moves nothing. Applying an "answer" there would be inventing
  // a move the learner never made.
  let s = reduce(atFirstChallenge(), { type: 'attempt', attempt: { kind: 'move', uci: 'b3d5' } });
  s = reduce(s, { type: 'next' });
  expect(s.phase).toMatchObject({ kind: 'challenge', index: 1 });
  const picked = reduce(s, { type: 'attempt', attempt: { kind: 'square', square: 'd5' } });
  expect(picked.phase).toMatchObject({ status: 'correct' });
  expect(picked.answeredFen).toBeNull();
});

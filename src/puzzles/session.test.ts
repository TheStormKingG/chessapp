import { describe, expect, test } from 'vitest';
import { initial, reduce, result } from './session';
import type { Puzzle } from './types';

const PZ: Puzzle = {
  id: 'p1',
  rating: 1000,
  themes: ['fork'],
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  solution: ['a1a2', 'h1h2'], // opponent a1a2, learner answers h1h2
};

const start = () => initial(PZ, 'rated');

describe('session', () => {
  test('the learner plays the move after the opponent move, not the first move', () => {
    const s = start();
    expect(s.expected).toBe('h1h2');
  });

  test('correct with no hint: full credit, rating counts, mastered', () => {
    const s = reduce(start(), { type: 'move', uci: 'h1h2' });
    const r = result(s);
    expect(r.solved).toBe(true);
    expect(r.ratingCounts).toBe(true);
    expect(r.mastered).toBe(true);
  });

  test('correct after a hint: progress credit, rating does NOT count, not mastered', () => {
    let s = reduce(start(), { type: 'hint' });
    s = reduce(s, { type: 'move', uci: 'h1h2' });
    const r = result(s);
    expect(r.solved).toBe(true);
    expect(r.ratingCounts).toBe(false);
    expect(r.mastered).toBe(false);
  });

  test('failed after a hint: counts as failed for mastery, and the rating still moves', () => {
    let s = reduce(start(), { type: 'hint' });
    s = reduce(s, { type: 'move', uci: 'a1a2' });
    s = reduce(s, { type: 'giveUp' });
    const r = result(s);
    expect(r.solved).toBe(false);
    expect(r.mastered).toBe(false);
    expect(r.ratingCounts).toBe(true);
  });

  test('one miss loses mastery even when the next move is right', () => {
    let s = reduce(start(), { type: 'move', uci: 'a1a2' });
    s = reduce(s, { type: 'move', uci: 'h1h2' });
    const r = result(s);
    expect(r.solved).toBe(true);
    expect(r.misses).toBe(1);
    // Not `misses <= 1`. A learner who guesses twice must not be mastered.
    expect(r.mastered).toBe(false);
  });

  test('themed practice never counts for rating whatever happens', () => {
    const s = reduce(initial(PZ, 'themed'), { type: 'move', uci: 'h1h2' });
    expect(result(s).ratingCounts).toBe(false);
  });

  test('a move after the puzzle is finished changes nothing', () => {
    const done = reduce(start(), { type: 'move', uci: 'h1h2' });
    expect(reduce(done, { type: 'move', uci: 'a1a2' })).toEqual(done);
  });

  test('a giving up without a hint still fails and still moves the rating', () => {
    const r = result(reduce(start(), { type: 'giveUp' }));
    expect(r.solved).toBe(false);
    expect(r.mastered).toBe(false);
    expect(r.ratingCounts).toBe(true);
  });

  test('a four-ply puzzle needs both learner moves, and the opponent reply is skipped', () => {
    const long: Puzzle = { ...PZ, solution: ['a1a2', 'h1h2', 'a2a3', 'h2h3'] };
    let s = initial(long, 'rated');
    expect(s.expected).toBe('h1h2');
    s = reduce(s, { type: 'move', uci: 'h1h2' });
    expect(s.done).toBe(false);
    expect(s.expected).toBe('h2h3');
    s = reduce(s, { type: 'move', uci: 'h2h3' });
    expect(s.done).toBe(true);
    expect(result(s).solved).toBe(true);
  });

  test("the learner's own error position starts with the learner to move", () => {
    // F-PZ-3 drills built from the error log have no opponent move to replay:
    // the learner is already to move. Getting this wrong plays the solution
    // FOR them and every position still looks legal, so nothing else catches it.
    const own: Puzzle = { ...PZ, solution: ['a1b2'] };
    const s = initial(own, 'fix', { firstLearnerPly: 0 });
    expect(s.expected).toBe('a1b2');
    expect(result(reduce(s, { type: 'move', uci: 'a1b2' })).solved).toBe(true);
  });

  test('elapsed time is measured from the timestamps the caller supplies', () => {
    const s = reduce(initial(PZ, 'rated', { now: 1000 }), {
      type: 'move',
      uci: 'h1h2',
      at: 4500,
    });
    expect(result(s).ms).toBe(3500);
  });

  test('the result carries everything the event needs', () => {
    const r = result(reduce(start(), { type: 'move', uci: 'h1h2' }));
    expect(r.puzzleId).toBe('p1');
    expect(r.source).toBe('rated');
    expect(r.hinted).toBe(false);
  });
});

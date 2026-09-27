import { describe, expect, it, vi } from 'vitest';
import {
  answer,
  clearVerdict,
  isCorrect,
  isOver,
  remainingMs,
  remainingSeconds,
  startSession,
} from './session';
import { ROUND_MS, type VisionAnswer } from './types';

/**
 * The whole of F-PR-2's 30-second timer, tested without waiting and without a
 * fake global clock. Every assertion names a clock reading, because the module
 * takes the reading as an argument.
 *
 * `vi.useFakeTimers` appears nowhere in this file on purpose. There is no timer
 * to fake: the arithmetic is the unit, and the only thing that reads a real clock
 * is the screen's animation frame.
 */

const T0 = 1_000_000;

/** The correct answer to a session's current question, whatever kind it is. */
function correctAnswer(s: ReturnType<typeof startSession>): VisionAnswer {
  return s.current.answer;
}

/** An answer guaranteed to be wrong for the session's current question. */
function wrongAnswer(s: ReturnType<typeof startSession>): VisionAnswer {
  const a = s.current.answer;
  if (a.kind === 'count') return { kind: 'count', count: a.count + 1 };
  return { kind: 'square', square: a.square === 'a1' ? 'h8' : 'a1' };
}

describe('the 30-second round', () => {
  it('starts with the full 30 seconds and is not over', () => {
    const s = startSession('find-square', 1, T0);
    expect(remainingMs(s, T0)).toBe(ROUND_MS);
    expect(remainingSeconds(s, T0)).toBe(30);
    expect(isOver(s, T0)).toBe(false);
  });

  it('is 30 seconds long, as F-PR-2 says', () => {
    expect(ROUND_MS).toBe(30_000);
  });

  it('counts down without waiting', () => {
    const s = startSession('find-square', 1, T0);
    expect(remainingSeconds(s, T0 + 1)).toBe(30);
    expect(remainingSeconds(s, T0 + 1_000)).toBe(29);
    expect(remainingSeconds(s, T0 + 15_500)).toBe(15);
    expect(remainingSeconds(s, T0 + 29_500)).toBe(1);
    expect(remainingSeconds(s, T0 + ROUND_MS)).toBe(0);
  });

  it('ends exactly at 30 seconds, not before and not after', () => {
    const s = startSession('find-square', 1, T0);
    expect(isOver(s, T0 + ROUND_MS - 1)).toBe(false);
    expect(isOver(s, T0 + ROUND_MS)).toBe(true);
    expect(isOver(s, T0 + ROUND_MS + 1)).toBe(true);
  });

  it('never reports negative time left', () => {
    const s = startSession('find-square', 1, T0);
    expect(remainingMs(s, T0 + ROUND_MS * 4)).toBe(0);
    expect(remainingSeconds(s, T0 + ROUND_MS * 4)).toBe(0);
  });

  it('measures from the reading it was started with, not from any global clock', () => {
    // Two sessions started at readings a year apart behave identically, which
    // could not be true of a module that read a clock of its own.
    const early = startSession('find-square', 1, 0);
    const late = startSession('find-square', 1, 31_536_000_000);
    expect(remainingMs(early, 5_000)).toBe(remainingMs(late, 31_536_005_000));
  });

  it('does not read the real clock', () => {
    // The positive control for the claim above: spy on Date.now and show the
    // module never calls it. Without the spy, "takes the clock as an argument"
    // is a claim about the source rather than about the behaviour.
    const spy = vi.spyOn(Date, 'now');
    const s = startSession('count-attackers', 5, T0);
    remainingMs(s, T0 + 1_000);
    remainingSeconds(s, T0 + 1_000);
    isOver(s, T0 + 1_000);
    const after = answer(s, correctAnswer(s), T0 + 1_000);
    expect(after.asked).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('scoring', () => {
  it('counts a right answer', () => {
    const s = startSession('find-square', 3, T0);
    const next = answer(s, correctAnswer(s), T0 + 500);
    expect(next.score).toBe(1);
    expect(next.asked).toBe(1);
    expect(next.last?.correct).toBe(true);
  });

  it('counts a wrong answer as asked but not scored', () => {
    const s = startSession('find-square', 3, T0);
    const next = answer(s, wrongAnswer(s), T0 + 500);
    expect(next.score).toBe(0);
    expect(next.asked).toBe(1);
    expect(next.last?.correct).toBe(false);
  });

  it('keeps score and asked apart over a mixed round', () => {
    let s = startSession('find-square', 3, T0);
    s = answer(s, correctAnswer(s), T0 + 1_000);
    s = answer(s, wrongAnswer(s), T0 + 2_000);
    s = answer(s, correctAnswer(s), T0 + 3_000);
    s = answer(s, wrongAnswer(s), T0 + 4_000);
    expect(s.asked).toBe(4);
    expect(s.score).toBe(2);
  });

  it('moves to a new question after each answer', () => {
    const s = startSession('find-square', 3, T0);
    const next = answer(s, correctAnswer(s), T0 + 500);
    expect(next.current).not.toEqual(s.current);
    // And the question just answered is retained in `last`, so the screen can
    // show the reason against the position it was asked on.
    expect(next.last?.question).toEqual(s.current);
  });

  it('serves a reproducible sequence from the seed', () => {
    const run = (): number[] => {
      let s = startSession('count-attackers', 99, T0);
      const seen: number[] = [];
      for (let i = 0; i < 5; i++) {
        seen.push(s.current.answer.kind === 'count' ? s.current.answer.count : -1);
        s = answer(s, correctAnswer(s), T0 + 1_000 * (i + 1));
      }
      return seen;
    };
    expect(run()).toEqual(run());
    // Positive control: a different seed gives a different sequence, so the
    // equality above is not the trivial truth about a constant generator.
    let other = startSession('count-attackers', 1234, T0);
    const otherFirst = other.current.prompt;
    other = answer(other, correctAnswer(other), T0 + 1);
    expect(otherFirst).not.toBe(startSession('count-attackers', 99, T0).current.prompt);
  });
});

describe('an answer that arrives after time is up', () => {
  it('is ignored, so a score cannot grow after the clock reads zero', () => {
    const s = startSession('find-square', 3, T0);
    const late = answer(s, correctAnswer(s), T0 + ROUND_MS);
    expect(late).toBe(s);
    expect(late.score).toBe(0);
    expect(late.asked).toBe(0);
  });

  it('counts an answer given at the last possible millisecond', () => {
    const s = startSession('find-square', 3, T0);
    const just = answer(s, correctAnswer(s), T0 + ROUND_MS - 1);
    expect(just.score).toBe(1);
  });
});

describe('isCorrect', () => {
  it('compares squares by square and counts by count', () => {
    expect(isCorrect({ answer: { kind: 'square', square: 'd4' } } as never, { kind: 'square', square: 'd4' })).toBe(
      true,
    );
    expect(isCorrect({ answer: { kind: 'square', square: 'd4' } } as never, { kind: 'square', square: 'd5' })).toBe(
      false,
    );
    expect(isCorrect({ answer: { kind: 'count', count: 2 } } as never, { kind: 'count', count: 2 })).toBe(true);
    expect(isCorrect({ answer: { kind: 'count', count: 2 } } as never, { kind: 'count', count: 3 })).toBe(false);
  });

  it('is false when the kinds do not match', () => {
    expect(isCorrect({ answer: { kind: 'count', count: 2 } } as never, { kind: 'square', square: 'd4' })).toBe(false);
  });
});

describe('clearVerdict', () => {
  it('clears the verdict and returns the same object when there is none', () => {
    const s = startSession('find-square', 3, T0);
    expect(clearVerdict(s)).toBe(s);
    const answered = answer(s, correctAnswer(s), T0 + 1);
    expect(answered.last).not.toBeNull();
    expect(clearVerdict(answered).last).toBeNull();
    // Clearing the verdict must not touch the score or the question.
    expect(clearVerdict(answered).score).toBe(answered.score);
    expect(clearVerdict(answered).current).toEqual(answered.current);
  });
});

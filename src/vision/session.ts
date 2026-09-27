import { visionQuestion } from './questions';
import { ROUND_MS, type VisionAnswer, type VisionMode, type VisionQuestion } from './types';

/**
 * F-PR-2's 30-second round, as a state machine that takes the clock as an
 * argument and never reads it.
 *
 * ── WHY THE CLOCK IS A PARAMETER ─────────────────────────────────────────────
 *
 * Because a 30-second timer whose logic calls `Date.now()` can only be tested by
 * waiting 30 seconds, or by mocking the global clock — and a mocked global clock
 * tests the mock's arithmetic as much as the code's. Here every function takes
 * `now` in milliseconds, so "the round ends at 30 s", "an answer at 29.999 s
 * counts" and "an answer at 30.001 s does not" are three ordinary assertions
 * with no timers and no waiting. The only thing that reads a real clock is the
 * screen's `requestAnimationFrame` loop, which does nothing but pass the reading
 * in.
 *
 * ── THE SCORE IS NOT THE NUMBER OF QUESTIONS SEEN ───────────────────────────
 *
 * `score` counts CORRECT answers. `asked` counts answers given. Keeping them
 * apart is what makes the personal best mean something: a learner who taps
 * randomly answers more questions than one who reads the board, and a best built
 * on `asked` would reward the first.
 */

export interface VisionSession {
  mode: VisionMode;
  /** The round's seed. Question n is generated from `seed + n`. */
  seed: number;
  /** Clock reading at which the round started. */
  startedAt: number;
  /** How many answers have been given, right or wrong. */
  asked: number;
  /** How many were right. This is the score, and the number a best is kept of. */
  score: number;
  /** The question on screen. */
  current: VisionQuestion;
  /**
   * The verdict on the last answer, for the screen to show. Null at the start of
   * the round and after the learner moves on.
   */
  last: { correct: boolean; question: VisionQuestion; given: VisionAnswer } | null;
}

export function startSession(mode: VisionMode, seed: number, now: number): VisionSession {
  return {
    mode,
    seed,
    startedAt: now,
    asked: 0,
    score: 0,
    current: visionQuestion(mode, seed),
    last: null,
  };
}

/** Milliseconds left in the round, floored at zero. */
export function remainingMs(s: VisionSession, now: number): number {
  return Math.max(0, s.startedAt + ROUND_MS - now);
}

/** Whole seconds left, as the screen shows them. 30 at the start, 0 at the end. */
export function remainingSeconds(s: VisionSession, now: number): number {
  return Math.ceil(remainingMs(s, now) / 1000);
}

/**
 * Is the round over?
 *
 * The boundary is inclusive of the full 30 seconds: at exactly `ROUND_MS` the
 * round is over. Stated because an off-by-one here is invisible in play and
 * would make a best set at 30.000 s unreachable by anyone else.
 */
export function isOver(s: VisionSession, now: number): boolean {
  return remainingMs(s, now) <= 0;
}

/** Whether an answer matches the question it was given for. */
export function isCorrect(q: VisionQuestion, given: VisionAnswer): boolean {
  if (q.answer.kind === 'square' && given.kind === 'square') return q.answer.square === given.square;
  if (q.answer.kind === 'count' && given.kind === 'count') return q.answer.count === given.count;
  // A count offered for a square question is not a wrong answer, it is a wrong
  // KIND, and the screen cannot produce one. Scoring it false rather than
  // throwing keeps a bug in the screen from taking the round down, and the
  // mismatch is unreachable from the UI by construction.
  return false;
}

/**
 * Answer the current question.
 *
 * An answer arriving after the round has ended is IGNORED — the session comes
 * back unchanged. That is the race the screen would otherwise lose: the learner
 * taps, and between the tap and the handler the clock crosses 30 s. Dropping it
 * is the honest resolution, because the alternative is a score that can grow
 * after the timer reads zero.
 */
export function answer(s: VisionSession, given: VisionAnswer, now: number): VisionSession {
  if (isOver(s, now)) return s;
  const correct = isCorrect(s.current, given);
  const asked = s.asked + 1;
  return {
    ...s,
    asked,
    score: s.score + (correct ? 1 : 0),
    last: { correct, question: s.current, given },
    // The next question is generated from the seed plus the number asked, so a
    // round is a reproducible sequence and two learners given the same seed meet
    // the same questions in the same order.
    current: visionQuestion(s.mode, s.seed + asked),
  };
}

/** Clear the verdict, so the board shows the next question cleanly. */
export function clearVerdict(s: VisionSession): VisionSession {
  return s.last === null ? s : { ...s, last: null };
}

import type { Color, Square } from '@/rules';

/**
 * The vision trainer (PRD §8.7, F-PR-2), verbatim:
 *
 * > "The vision trainer has three modes, find the square, find the destination
 * > of a written move, and count the attackers of a square, with a 30-second
 * > timer, board orientation choice and a personal best per mode."
 *
 * Three modes, one timer, one score. Everything in this module is a pure
 * function of a seed and a clock reading, which is what lets the 30-second timer
 * be tested without waiting 30 seconds.
 */
export const VISION_MODES = ['find-square', 'find-destination', 'count-attackers'] as const;
export type VisionMode = (typeof VISION_MODES)[number];

export const MODE_TITLE: Record<VisionMode, string> = {
  'find-square': 'Find the square',
  'find-destination': 'Find the destination',
  'count-attackers': 'Count the attackers',
};

export const MODE_BRIEF: Record<VisionMode, string> = {
  'find-square': 'A square is named. Tap it.',
  'find-destination': 'A move is written. Tap where the piece lands.',
  'count-attackers': 'Count how many men attack the marked square.',
};

/**
 * How a question is answered, which is what the screen switches its input on.
 *
 * `square` covers two of the three modes, and that is not a coincidence worth
 * collapsing: both ask the learner to point at the board, so both use the
 * board's own `select` mode and neither needs a second input widget.
 */
export type VisionAnswer = { kind: 'square'; square: Square } | { kind: 'count'; count: number };

/** One question, with its own answer attached. Nothing else knows how to score. */
export interface VisionQuestion {
  mode: VisionMode;
  /** What the learner is asked, as a sentence the screen prints and a reader reads. */
  prompt: string;
  /** The position to show. An empty board for `find-square`; see questions.ts. */
  fen: string;
  /** The square the question is ABOUT, marked on the board for `count-attackers`. */
  subject: Square | null;
  answer: VisionAnswer;
  /**
   * Why the answer is the answer, shown after a miss.
   *
   * For `count-attackers` this names the attacking squares, so a learner who
   * answered 1 where the answer is 2 is shown the man they did not see rather
   * than being told a number. That is the whole teaching value of the mode.
   */
  because: string;
}

/** F-PR-2's "board orientation choice". */
export type Orientation = Color;

/** F-PR-2's "30-second timer". */
export const ROUND_MS = 30_000;

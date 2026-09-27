import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { ALL_SQUARES, BARE_BOARD, MAX_COUNT_ANSWER, askableMoves, playedPosition, visionQuestion } from './questions';
import { attackerCensus } from './census';
import { rng } from './rng';
import { VISION_MODES, type VisionMode, type VisionQuestion } from './types';
import { attackersOf, legalMoves, pieceAt, type Square } from '@/rules';

/**
 * Every assertion here is about a question's ANSWER, not its shape. A generator
 * that produced well-formed questions with wrong answers would satisfy a
 * shape-only suite completely, and a wrong answer is the only defect in this
 * module that reaches a learner.
 *
 * The answers are re-derived independently where that is possible — the move's
 * destination from chess.js's own move object, the count from the census — so a
 * test is comparing two routes to the same fact rather than the generator with
 * itself.
 */

/** Seeds used wherever a block needs many independent questions. */
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

/**
 * Generating a question plays a game out and, for `count-attackers`, censuses all
 * 64 squares. Nineteen tests over sixty seeds is nineteen regenerations of the
 * same pure function, and the cost scales with the seed count — so a suite that
 * grew its coverage would eventually cross the runner's per-test budget and
 * report it as a flake that passes in isolation.
 *
 * The generators are pure functions of (mode, seed), so memoising is free and
 * changes nothing: `q(mode, seed)` is the same value `visionQuestion` returns.
 * Determinism itself is asserted by calling `visionQuestion` directly, above the
 * memo, so this cache cannot be what makes that test pass.
 */
const QUESTIONS = new Map<string, VisionQuestion>();
function q(mode: VisionMode, seed: number): VisionQuestion {
  const key = `${mode}:${String(seed)}`;
  let cached = QUESTIONS.get(key);
  if (!cached) {
    cached = visionQuestion(mode, seed);
    QUESTIONS.set(key, cached);
  }
  return cached;
}

const POSITIONS = new Map<number, string>();
function position(seed: number): string {
  let cached = POSITIONS.get(seed);
  if (cached === undefined) {
    cached = playedPosition(rng(seed));
    POSITIONS.set(seed, cached);
  }
  return cached;
}

describe('ALL_SQUARES', () => {
  it('is the 64 squares, enumerated from the coordinate system', () => {
    expect(ALL_SQUARES).toHaveLength(64);
    expect(new Set(ALL_SQUARES).size).toBe(64);
    expect(ALL_SQUARES).toContain('a1');
    expect(ALL_SQUARES).toContain('h8');
    expect(ALL_SQUARES.every((s) => /^[a-h][1-8]$/.test(s))).toBe(true);
  });
});

describe('playedPosition', () => {
  it('is a legal position chess.js will load strictly', () => {
    for (const seed of SEEDS) {
      expect(() => new Chess(position(seed))).not.toThrow();
    }
  });

  it('is determined by the seed, and differs between seeds', () => {
    expect(playedPosition(rng(7))).toBe(playedPosition(rng(7)));
    // The positive control for "differs": without it, a generator that returned
    // one constant position would pass the determinism assertion above.
    const many = new Set(SEEDS.map((s) => position(s)));
    expect(many.size).toBeGreaterThan(SEEDS.length / 2);
  });

  it('has left the opening position', () => {
    for (const seed of SEEDS) {
      expect(position(seed)).not.toContain('rnbqkbnr/pppppppp');
    }
  });
});

describe('every mode', () => {
  it('is reproducible from its seed', () => {
    for (const mode of VISION_MODES) {
      expect(visionQuestion(mode, 42)).toEqual(visionQuestion(mode, 42));
    }
  });

  it('asks a question and gives a reason', () => {
    for (const mode of VISION_MODES) {
      for (const seed of SEEDS.slice(0, 20)) {
        const question = q(mode, seed);
        expect(question.mode).toBe(mode);
        expect(question.prompt.length).toBeGreaterThan(5);
        expect(question.because.length).toBeGreaterThan(5);
        expect(() => new Chess(question.fen)).not.toThrow();
      }
    }
  });

  it('varies its question across seeds', () => {
    // A generator ignoring its seed would pass every other test in this file.
    for (const mode of VISION_MODES) {
      const prompts = new Set(SEEDS.map((s) => q(mode, s).prompt));
      expect(prompts.size).toBeGreaterThan(5);
    }
  });
});

describe('find-square', () => {
  it('names a real square and answers with that square', () => {
    for (const seed of SEEDS) {
      const question = q('find-square', seed);
      expect(question.answer.kind).toBe('square');
      const square = question.answer.kind === 'square' ? question.answer.square : null;
      expect(ALL_SQUARES).toContain(square);
      // The prompt and the answer must name the SAME square. A generator that
      // picked two would be asking one question and marking another.
      expect(question.prompt).toContain(square!);
    }
  });

  it('asks on the near-empty board, which is a legal position', () => {
    expect(q('find-square', 1).fen).toBe(BARE_BOARD);
    expect(() => new Chess(BARE_BOARD)).not.toThrow();
    // Near-empty, not empty: the two kings are the only men on it.
    expect(ALL_SQUARES.filter((s) => pieceAt(BARE_BOARD, s) !== null)).toEqual(['e1', 'e8']);
  });

  it('reaches squares on both sides of the board and both colours', () => {
    const squares = SEEDS.map((s) => {
      const a = q('find-square', s).answer;
      return a.kind === 'square' ? a.square : null;
    });
    expect(squares.some((s) => s!.endsWith('1') || s!.endsWith('2'))).toBe(true);
    expect(squares.some((s) => s!.endsWith('7') || s!.endsWith('8'))).toBe(true);
  });
});

describe('find-destination', () => {
  it("answers with the destination chess.js itself gives for the move it wrote", () => {
    for (const seed of SEEDS) {
      const question = q('find-destination', seed);
      const san = question.prompt.split(' —')[0]!;
      const answer = question.answer.kind === 'square' ? question.answer.square : null;
      // Re-derive the destination from the move object rather than from the
      // generator: the SAN in the prompt is played into the position and the
      // resulting `to` must be what the learner is marked against.
      const game = new Chess(question.fen);
      const move = game.move(san);
      expect(move.to).toBe(answer);
    }
  });

  it('only asks about moves that are legal in the position shown', () => {
    for (const seed of SEEDS) {
      const question = q('find-destination', seed);
      const san = question.prompt.split(' —')[0]!;
      expect(legalMoves(question.fen).map((m) => m.san)).toContain(san);
    }
  });

  /**
   * Castling is excluded because "where does the piece land" has two answers for
   * it. The rule is checked on `askableMoves` and NOT through the generator.
   *
   * Sweeping sixty generated questions for "no prompt starts with O-O" does not
   * test this: the generator draws one move out of thirty-odd, so with the filter
   * deleted that sweep still passed, and so did a control asserting castling was
   * available in those positions. Availability is a fact about the population;
   * what needed testing is the filter, and the filter has to be asked directly.
   */
  it('excludes castling from the moves it may ask about', () => {
    // A position where the side to move may castle both ways, so there is
    // something to exclude and the assertions below cannot pass vacuously.
    // Only WHITE's two castling moves are legal here — Black's are not, because
    // it is not Black's turn.
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const all = legalMoves(fen).map((m) => m.san);
    const askable = askableMoves(fen).map((m) => m.san);

    // The positive control, on the same position the rule is checked against:
    // castling is genuinely there to be excluded.
    expect(all).toContain('O-O');
    expect(all).toContain('O-O-O');

    expect(askable).not.toContain('O-O');
    expect(askable).not.toContain('O-O-O');
    // And it excludes ONLY castling: the two the side to move has.
    expect(askable).toHaveLength(all.length - 2);
  });

  it('asks only about moves it considers askable', () => {
    for (const seed of SEEDS) {
      const question = q('find-destination', seed);
      const san = question.prompt.split(' \u2014')[0]!;
      expect(askableMoves(question.fen).map((m) => m.san)).toContain(san);
    }
  });

  it('asks about a piece that is actually on the from-square', () => {
    for (const seed of SEEDS.slice(0, 25)) {
      const question = q('find-destination', seed);
      const from = /from ([a-h][1-8]) to/.exec(question.because)?.[1] as Square | undefined;
      expect(from).toBeDefined();
      expect(pieceAt(question.fen, from!)).not.toBeNull();
    }
  });
});

describe('count-attackers', () => {
  it('answers with the battery-aware census of the square it names', () => {
    for (const seed of SEEDS) {
      const question = q('count-attackers', seed);
      expect(question.subject).not.toBeNull();
      const by = question.prompt.includes('white men') ? 'w' : 'b';
      const census = attackerCensus(question.fen, question.subject!, by);
      expect(question.answer).toEqual({ kind: 'count', count: census.length });
      // The reason must list the very squares the count came from, so a learner
      // who was wrong is shown the men rather than told a number.
      for (const s of census) expect(question.because).toContain(s);
    }
  });

  it('keeps the answer inside the range the buttons offer, and never asks a zero', () => {
    for (const seed of SEEDS) {
      const a = q('count-attackers', seed).answer;
      expect(a.kind).toBe('count');
      const n = a.kind === 'count' ? a.count : -1;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(MAX_COUNT_ANSWER);
    }
  });

  it('asks about both sides across a round', () => {
    const sides = new Set(SEEDS.map((s) => (q('count-attackers', s).prompt.includes('white') ? 'w' : 'b')));
    expect(sides).toEqual(new Set(['w', 'b']));
  });

  /**
   * The assertion this whole feature turns on.
   *
   * If no generated question ever involved a battery, the census could be
   * replaced by the naive `attackersOf` and every other test in this file would
   * still pass — the trainer would ship a wrong number only for the learners who
   * happened to meet a doubled rook, which is the silent failure census.ts
   * exists to prevent. So: over a round's worth of seeds, at least one question's
   * answer must be a number the primitive would have got wrong.
   */
  it('does reach positions where the primitive would answer differently', () => {
    const divergent = SEEDS.filter((seed) => {
      const question = q('count-attackers', seed);
      const by = question.prompt.includes('white men') ? 'w' : 'b';
      return attackerCensus(question.fen, question.subject!, by).length !== attackersOf(question.fen, question.subject!, by).length;
    });
    expect(divergent.length).toBeGreaterThan(0);
  });
});

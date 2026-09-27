import { describe, expect, it, vi } from 'vitest';
import { START_FEN, legalMoves } from '@/rules';
import type { AnalyseRequest, Analysis, AnalysisLine } from '@/engine';
import { MARGIN_CP, VERIFY_DEPTH, judge, passRate, sanOf, scoreCp, verifyPosition } from './verify';

const line = (move: string, score: AnalysisLine['score']): AnalysisLine => ({
  move,
  pv: [move],
  score,
  depth: VERIFY_DEPTH,
});

/** A position with exactly one legal move: white king on h1, black queen g2 + rook. */
const ONE_LEGAL = '7k/8/8/8/8/8/6q1/7K w - - 0 1';
/** Mate in one for white: Qa8#. Several legal moves. */
const MATE_IN_ONE = 'k7/8/1K6/8/8/8/8/1Q6 w - - 0 1';

function fakeEngine(lines: AnalysisLine[], record?: AnalyseRequest[]): { analyse: (r: AnalyseRequest) => Promise<Analysis> } {
  return {
    analyse: (r) => {
      record?.push(r);
      return Promise.resolve({ lines, depth: r.depth });
    },
  };
}

describe('the corpus gate’s score conversion', () => {
  it('collapses a mate to ±10000, exactly as scripts/verify-content.mjs does', () => {
    expect(scoreCp({ cp: 55 })).toBe(55);
    expect(scoreCp({ mate: 3 })).toBe(10_000);
    expect(scoreCp({ mate: -2 })).toBe(-10_000);
  });
});

describe('judge: the single-answer rule', () => {
  it('verifies a position whose runner-up is more than 100cp worse', () => {
    const v = judge({
      expectedUci: 'e2e4',
      legalMoveCount: 20,
      lines: [line('e2e4', { cp: 300 }), line('d2d4', { cp: 100 })],
    });
    expect(v).toEqual({ verified: true, bestUci: 'e2e4', marginCp: 200 });
  });

  it('refuses at exactly the bar minus one, and accepts at the bar', () => {
    const at = (margin: number) =>
      judge({
        expectedUci: 'e2e4',
        legalMoveCount: 20,
        lines: [line('e2e4', { cp: margin }), line('d2d4', { cp: 0 })],
      });
    expect(at(MARGIN_CP - 1)).toMatchObject({ verified: false, reason: 'runner-up-too-close', marginCp: 99 });
    expect(at(MARGIN_CP)).toMatchObject({ verified: true, marginCp: 100 });
  });

  it('refuses when the engine’s best is not the move the challenge would claim', () => {
    const v = judge({
      expectedUci: 'a2a3',
      legalMoveCount: 20,
      lines: [line('e2e4', { cp: 900 }), line('d2d4', { cp: 10 })],
    });
    expect(v).toMatchObject({ verified: false, reason: 'engine-disagrees', engineBest: 'e2e4' });
  });

  it('refuses a forced mate whose runner-up also mates, and says the score saturated', () => {
    // The corpus's known blind spot, kept on purpose: mate in one against mate in
    // six is a clear single answer and still measures a margin of zero.
    const v = judge({
      expectedUci: 'b1a1',
      legalMoveCount: 20,
      lines: [line('b1a1', { mate: 1 }), line('b1b8', { mate: 6 })],
    });
    expect(v).toMatchObject({ verified: false, reason: 'mate-saturated', marginCp: 0 });
  });

  it('still verifies a mate whose runner-up is an ordinary move', () => {
    // The positive control for the saturation case above: without it, "refuses a
    // mate" would also pass for a gate that refuses every mate.
    const v = judge({
      expectedUci: 'b1a1',
      legalMoveCount: 20,
      lines: [line('b1a1', { mate: 1 }), line('b1b2', { cp: 400 })],
    });
    expect(v).toMatchObject({ verified: true, marginCp: 9600 });
  });

  it('verifies a mate for us against a mate against us', () => {
    const v = judge({
      expectedUci: 'b1a1',
      legalMoveCount: 20,
      lines: [line('b1a1', { mate: 1 }), line('b1b2', { mate: -4 })],
    });
    expect(v).toMatchObject({ verified: true, marginCp: 20_000 });
  });

  it('refuses a position with one legal move without consulting the lines', () => {
    expect(judge({ expectedUci: 'h1g1', legalMoveCount: 1, lines: [] })).toMatchObject({
      verified: false,
      reason: 'one-legal-move',
    });
  });

  it('refuses when MultiPV 2 returned only one line', () => {
    expect(judge({ expectedUci: 'e2e4', legalMoveCount: 20, lines: [line('e2e4', { cp: 50 })] })).toMatchObject({
      verified: false,
      reason: 'no-runner-up',
    });
    expect(judge({ expectedUci: 'e2e4', legalMoveCount: 20, lines: [] })).toMatchObject({
      verified: false,
      reason: 'no-runner-up',
    });
  });
});

describe('verifyPosition: the rule, against a real board', () => {
  it('asks for MultiPV 2 at depth 14 on a CLEAN search', async () => {
    const seen: AnalyseRequest[] = [];
    const engine = fakeEngine([line('e2e4', { cp: 400 }), line('d2d4', { cp: 20 })], seen);
    const v = await verifyPosition(engine, { fen: START_FEN, expectedUci: 'e2e4' });
    expect(v.verified).toBe(true);
    expect(seen).toEqual([{ fen: START_FEN, depth: 14, multiPv: 2, fresh: true }]);
  });

  it('counts the legal moves from the position, and skips the engine when there is only one', async () => {
    // The position really does have one legal move — asserted, not assumed.
    expect(legalMoves(ONE_LEGAL)).toHaveLength(1);
    const analyse = vi.fn();
    const v = await verifyPosition({ analyse }, { fen: ONE_LEGAL, expectedUci: 'h1g1' });
    expect(v).toMatchObject({ verified: false, reason: 'one-legal-move' });
    expect(analyse).not.toHaveBeenCalled();
    // Positive control: the same call path DOES reach the engine for a position
    // with a choice, so the assertion above is about the position.
    const analyse2 = vi.fn().mockResolvedValue({ lines: [line('b1a1', { mate: 1 })], depth: 14 });
    await verifyPosition({ analyse: analyse2 }, { fen: MATE_IN_ONE, expectedUci: 'b1a1' });
    expect(analyse2).toHaveBeenCalledTimes(1);
  });

  it('treats an unusable engine as an instrument fault, not as an ambiguous position', async () => {
    const engine = { analyse: () => Promise.reject(new Error('EngineUnavailable: no worker')) };
    const v = await verifyPosition(engine, { fen: START_FEN, expectedUci: 'e2e4' });
    expect(v).toMatchObject({ verified: false, reason: 'engine-unavailable' });
  });
});

describe('sanOf', () => {
  it('names a legal move and returns null for an illegal one', () => {
    expect(sanOf(START_FEN, 'e2e4')).toBe('e4');
    expect(sanOf(START_FEN, 'e2e5')).toBeNull();
  });
});

describe('passRate', () => {
  it('counts verified against checked, and attributes every failure', () => {
    const r = passRate([
      { verified: true, bestUci: 'a', marginCp: 200 },
      { verified: false, reason: 'runner-up-too-close', marginCp: 40, engineBest: 'b' },
      { verified: false, reason: 'runner-up-too-close', marginCp: 10, engineBest: 'c' },
      { verified: false, reason: 'mate-saturated', marginCp: 0, engineBest: 'd' },
    ]);
    expect(r).toEqual({
      checked: 4,
      verified: 1,
      reasons: { 'runner-up-too-close': 2, 'mate-saturated': 1 },
    });
  });

  it('is empty rather than wrong for an empty set', () => {
    expect(passRate([])).toEqual({ checked: 0, verified: 0, reasons: {} });
  });
});

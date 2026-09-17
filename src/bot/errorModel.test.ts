import { errorProbability, pickMove } from './errorModel';
import type { MoveKind } from './types';
import type { AnalysisLine } from '@/engine';
import rosa from '@content/personas/rosa.json';

const line = (move: string, cp: number): AnalysisLine => ({ move, pv: [move], score: { cp }, depth: 8 });

test('error probability rises with complexity and is bounded', () => {
  const quiet = errorProbability(rosa, { captures: 0, checks: 0, phase: 'middlegame' });
  const busy = errorProbability(rosa, { captures: 6, checks: 2, phase: 'middlegame' });
  expect(busy).toBeGreaterThan(quiet);
  expect(busy).toBeLessThanOrEqual(0.9);
  expect(quiet).toBeGreaterThan(0);
});

test('phase factors scale the base rate and the cap holds', () => {
  const c = { captures: 0, checks: 0 } as const;
  expect(errorProbability(rosa, { ...c, phase: 'opening' })).toBeCloseTo(0.28 * 0.9, 10);
  expect(errorProbability(rosa, { ...c, phase: 'endgame' })).toBeCloseTo(0.28 * 1.1, 10);
  expect(errorProbability(rosa, { captures: 40, checks: 40, phase: 'endgame' })).toBe(0.9);
});

test('never errs when the only non-losing move is forced', () => {
  const lines = [line('e1e2', 0), line('e1d1', -9000)];
  expect(
    pickMove(rosa, lines, { captures: 0, checks: 1, phase: 'middlegame' }, () => 0.0, (m) => (m === 'e1d1' ? 'hang' : null)),
  ).toBe('e1e2');
});

test('never plays an instant loss even when it is a nameable error', () => {
  // Three viable moves, so the position is not forced, and the rng always says "err".
  const lines = [line('a', 20), line('b', 0), line('c', -20), line('d', -4000)];
  const choice = pickMove(rosa, lines, { captures: 4, checks: 2, phase: 'middlegame' }, () => 0.0, (m) => (m === 'd' ? 'hang' : null));
  expect(choice).not.toBe('d');
});

test('when erring, prefers a line whose refutation tagger can name', () => {
  const lines = [line('a', 50), line('b', -20), line('c', -150)];
  const choice = pickMove(rosa, lines, { captures: 3, checks: 0, phase: 'middlegame' }, () => 0.0, (m) => (m === 'c' ? 'hang' : null));
  expect(choice).toBe('c');
});

test('when not erring, samples among near-best lines by style', () => {
  const lines = [line('a', 50), line('b', 45), line('c', -300)];
  const choice = pickMove(rosa, lines, { captures: 0, checks: 0, phase: 'middlegame' }, () => 0.99, () => null);
  expect(['a', 'b']).toContain(choice);
});

test('style weights bias the near-best sample toward the persona preference', () => {
  const lines = [line('quiet1', 50), line('trade1', 50)];
  const kinds: Record<string, MoveKind> = { quiet1: 'quiet', trade1: 'trade' };
  const kindOf = (m: string): MoveKind => kinds[m] ?? 'quiet';
  // Weights are quiet 1.0 and trade 1.3, so the quiet bucket ends at 1/2.3 ≈ 0.4348.
  const pick = (r: number): string =>
    pickMove(rosa, lines, { captures: 0, checks: 0, phase: 'middlegame' }, () => r, () => null, kindOf);
  expect(pick(0.99)).toBe('trade1'); // 0.99 is past the quiet bucket → the heavier trade bucket
  expect(pick(0.5)).toBe('trade1'); // 0.5 > 0.4348, still inside the trade bucket
  // Without the classifier every move counts as quiet, so the same draw lands on the first line.
  const flat = pickMove(rosa, lines, { captures: 0, checks: 0, phase: 'middlegame' }, () => 0.4, () => null);
  expect(flat).toBe('quiet1');
});

test('is deterministic for a given rng sequence', () => {
  const lines = [line('a', 50), line('b', -40), line('c', -120)];
  const seq = () => {
    const values = [0.0, 0.7];
    let i = 0;
    return () => values[i++ % values.length]!;
  };
  const args = () =>
    pickMove(rosa, lines, { captures: 5, checks: 1, phase: 'middlegame' }, seq(), (m) => (m === 'c' ? 'hang' : null));
  expect(args()).toBe(args());
});

test('throws when there are no lines', () => {
  expect(() => pickMove(rosa, [], { captures: 0, checks: 0, phase: 'middlegame' }, () => 0, () => null)).toThrow(/no lines/);
});

test('still errs across seeds when the persona is already losing (PRD 10.7)', () => {
  // Six losing lines and a forced mate. The absolute win-per-cent floor must not collapse the
  // candidate set here: a 600 still blunders when behind, it just cannot be mated on purpose.
  const lines: AnalysisLine[] = [
    line('a', -450),
    line('b', -600),
    line('c', -800),
    line('d', -1200),
    line('e', -1600),
    line('f', -2000),
    { move: 'mated', pv: ['mated'], score: { mate: -1 }, depth: 8 },
  ];
  const chosen = new Set<string>();
  for (let seed = 0; seed < 500; seed++) {
    let i = 0;
    const rng = () => ((seed + 1) * 0.0137 * (i++ + 1)) % 1;
    chosen.add(pickMove(rosa, lines, { captures: 3, checks: 1, phase: 'middlegame' }, rng, () => 'hang'));
  }
  expect(chosen.size).toBeGreaterThan(2);
  expect(chosen.has('mated')).toBe(false);
});

test('when erring, prefers an error of a kind typical for the persona band', () => {
  const band = { ...rosa, error: { ...rosa.error, kinds: ['missMate'] } };
  const lines = [line('a', 50), line('hangs', -150), line('misses', -160)];
  const tag = (m: string): string | null => (m === 'hangs' ? 'hang' : m === 'misses' ? 'missMate' : null);
  const choice = pickMove(band, lines, { captures: 3, checks: 0, phase: 'middlegame' }, () => 0.0, tag);
  expect(choice).toBe('misses');
});

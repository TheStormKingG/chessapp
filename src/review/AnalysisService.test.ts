import { AnalysisService, DEPTH_COST, LADDER } from './AnalysisService';
import type { Analysis } from '@/engine';
import { EngineUnavailable } from '@/engine';
import { positionsOf } from './gameSource';

/** A fake engine that answers instantly and records what it was asked. */
function fakeEngine(opts: { perCallMs?: number; failAt?: number } = {}) {
  const calls: { fen: string; depth: number; multiPv: number }[] = [];
  let now = 0;
  const engine = {
    analyse: async (req: { fen: string; depth: number; multiPv?: number }): Promise<Analysis> => {
      calls.push({ fen: req.fen, depth: req.depth, multiPv: req.multiPv ?? 1 });
      if (opts.failAt !== undefined && calls.length > opts.failAt) throw new EngineUnavailable('boom');
      now += opts.perCallMs ?? 0;
      return { lines: [{ move: 'e2e4', pv: ['e2e4'], score: { cp: 20 }, depth: req.depth }], depth: req.depth };
    },
  };
  return { engine, calls, clock: () => now };
}

const SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];

test('one search per position, at MultiPV 1', () => {
  const { engine, calls, clock } = fakeEngine();
  const svc = new AnalysisService(engine, { now: clock });
  return svc.run(positionsOf(SANS).fens).then((r) => {
    expect(calls).toHaveLength(7); // 6 moves + the start position
    expect(calls.every((c) => c.multiPv === 1)).toBe(true);
    expect(r.positions).toHaveLength(7);
    expect(r.partial).toBe(false);
  });
});

test('the ladder drops to a shallower depth when the projection blows the budget', async () => {
  // The fixture is SEVEN positions, not eighty, so the rate has to be derived
  // from that: the budget allows 60000 / 7 = 8571 ms per position at depth 14.
  // 12000 ms projects to 84 s, which blows it; the depth-12 rung projects to
  // 25 s, which fits. (12000 x 7 = 84 s also stays under the 90 s wall, so this
  // test exercises the ladder and not the wall.)
  const { engine, calls, clock } = fakeEngine({ perCallMs: 12_000 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 3 });
  const fens = positionsOf(SANS).fens;
  await svc.run(fens);
  // The calibration positions run at 14; everything after runs shallower.
  expect(calls.slice(0, 3).every((c) => c.depth === 14)).toBe(true);
  expect(calls.slice(3).every((c) => c.depth < 14)).toBe(true);
});

test('the ladder stays at 14 when the projection fits', async () => {
  const { engine, calls, clock } = fakeEngine({ perCallMs: 10 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 3 });
  await svc.run(positionsOf(SANS).fens);
  expect(calls.every((c) => c.depth === 14)).toBe(true);
});

test('the 90-second wall stops the pass and marks it partial', async () => {
  // 40 s per position: the wall is crossed on the third.
  const { engine, clock } = fakeEngine({ perCallMs: 40_000 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 1 });
  const r = await svc.run(positionsOf(SANS).fens);
  expect(r.partial).toBe(true);
  expect(r.positions.length).toBeGreaterThan(0);
  expect(r.positions.length).toBeLessThan(7);
});

test('a partial pass reports exactly how far it got', async () => {
  const { engine, clock } = fakeEngine({ perCallMs: 40_000 });
  const svc = new AnalysisService(engine, { now: clock, calibrateN: 1 });
  const r = await svc.run(positionsOf(SANS).fens);
  // Every analysed position is contiguous from the start and correctly indexed.
  r.positions.forEach((p, i) => expect(p.index).toBe(i));
});

test('progress is reported for every position', async () => {
  const { engine, clock } = fakeEngine();
  const seen: number[] = [];
  const svc = new AnalysisService(engine, { now: clock, onProgress: (done) => seen.push(done) });
  await svc.run(positionsOf(SANS).fens);
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test('cancel stops submitting and resolves with what it had', async () => {
  const { engine, calls, clock } = fakeEngine();
  const svc: AnalysisService = new AnalysisService(engine, {
    now: clock,
    onProgress: (done) => {
      if (done === 2) svc.cancel();
    },
  });
  const r = await svc.run(positionsOf(SANS).fens);
  expect(calls.length).toBe(2);
  expect(r.cancelled).toBe(true);
  expect(r.positions).toHaveLength(2);
});

test('an engine failure aborts the pass and keeps what was analysed', async () => {
  const { engine, clock } = fakeEngine({ failAt: 2 });
  const svc = new AnalysisService(engine, { now: clock });
  const r = await svc.run(positionsOf(SANS).fens);
  expect(r.failed).toBe(true);
  expect(r.positions).toHaveLength(2);
});

test('the deeper key-moment pass runs at MultiPV 2', async () => {
  const { engine, calls, clock } = fakeEngine();
  const svc = new AnalysisService(engine, { now: clock });
  const fens = positionsOf(SANS).fens;
  await svc.deepen(fens[2]!, 16);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ fen: fens[2], depth: 16, multiPv: 2 });
});

test('the ladder costs less at every step down', () => {
  for (let i = 1; i < LADDER.length; i += 1) {
    expect(DEPTH_COST[LADDER[i]!]!).toBeLessThan(DEPTH_COST[LADDER[i - 1]!]!);
    expect(DEPTH_COST[LADDER[i]!]!).toBeGreaterThan(0);
  }
  expect(DEPTH_COST[14]).toBe(1);
});

test('a result that lands after cancel is discarded, not written into the run', async () => {
  // The real cancellation path: the learner leaves the review screen while a
  // search is already in flight. The plan's loop only checks `cancelled` before
  // submitting, so without a second check the in-flight reply is still appended
  // and reported through onProgress — this codebase has shipped exactly that
  // bug once, where a late engine reply graded the wrong challenge.
  const holder: { svc?: AnalysisService } = {};
  const calls: string[] = [];
  const progress: number[] = [];
  const engine = {
    analyse: async (req: { fen: string; depth: number; multiPv?: number }): Promise<Analysis> => {
      calls.push(req.fen);
      if (calls.length === 2) holder.svc!.cancel(); // cancelled mid-search
      return { lines: [{ move: 'e2e4', pv: ['e2e4'], score: { cp: 20 }, depth: req.depth }], depth: req.depth };
    },
  };
  holder.svc = new AnalysisService(engine, { now: () => 0, onProgress: (d) => progress.push(d) });
  const r = await holder.svc.run(positionsOf(SANS).fens);
  expect(calls).toHaveLength(2);
  expect(r.cancelled).toBe(true);
  expect(r.positions).toHaveLength(1);
  expect(progress).toEqual([1]);
});

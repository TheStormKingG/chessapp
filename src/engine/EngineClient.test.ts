import { EngineClient, type WorkerLike } from './EngineClient';

class FakeWorker implements WorkerLike {
  sent: string[] = [];
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  terminated = false;
  postMessage(msg: string) {
    this.sent.push(msg);
    const reply = (s: string) => queueMicrotask(() => this.onmessage?.({ data: s } as MessageEvent<string>));
    if (msg === 'uci') reply('uciok');
    if (msg === 'isready') reply('readyok');
    if (msg.startsWith('go')) {
      reply('info depth 8 multipv 1 score cp 30 pv e2e4 e7e5');
      reply('info depth 8 multipv 2 score cp 20 pv d2d4 d7d5');
      reply('bestmove e2e4');
    }
  }
  terminate() { this.terminated = true; }
}

test('analyse sends position and go, resolves lines sorted by multipv', async () => {
  const w = new FakeWorker();
  const e = new EngineClient(() => w, { idleMs: 10_000 });
  const res = await e.analyse({ fen: 'startpos', depth: 8, multiPv: 2 });
  expect(w.sent).toContain('setoption name MultiPV value 2');
  expect(w.sent).toContain('position fen startpos');
  expect(w.sent).toContain('go depth 8');
  expect(res.lines.map((l) => l.move)).toEqual(['e2e4', 'd2d4']);
  expect(res.lines[0]?.score).toEqual({ cp: 30 });
});

test('requests are serialised', async () => {
  const w = new FakeWorker();
  const e = new EngineClient(() => w, { idleMs: 10_000 });
  const [a, b] = await Promise.all([e.bestMove({ fen: 'f1', depth: 4 }), e.bestMove({ fen: 'f2', depth: 4 })]);
  expect(a).toBe('e2e4'); expect(b).toBe('e2e4');
  const goCount = w.sent.filter((s) => s.startsWith('go')).length;
  expect(goCount).toBe(2);
  expect(w.sent.indexOf('position fen f2')).toBeGreaterThan(w.sent.indexOf('go depth 4'));
});

test('idle timeout terminates the worker and a new request relaunches it', async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const e = new EngineClient(() => { const w = new FakeWorker(); workers.push(w); return w; }, { idleMs: 100 });
  const p = e.bestMove({ fen: 'f', depth: 1 });
  await vi.runAllTimersAsync();
  await p;
  vi.advanceTimersByTime(150);
  expect(workers[0]?.terminated).toBe(true);
  const p2 = e.bestMove({ fen: 'f', depth: 1 });
  await vi.runAllTimersAsync();
  await p2;
  expect(workers).toHaveLength(2);
  vi.useRealTimers();
});

test('worker failure rejects pending requests with EngineUnavailable', async () => {
  const e = new EngineClient(() => { throw new Error('no wasm'); }, { idleMs: 10 });
  await expect(e.bestMove({ fen: 'f', depth: 1 })).rejects.toThrow('EngineUnavailable');
});

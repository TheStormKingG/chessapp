import { parseBestMove, parseInfo, type Score } from './uci';

export interface WorkerLike {
  postMessage(msg: string): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<string>) => void) | null;
}

export interface AnalyseRequest { fen: string; depth: number; multiPv?: number }
export interface AnalysisLine { move: string; pv: string[]; score: Score; depth: number }
export interface Analysis { lines: AnalysisLine[]; depth: number }

interface Job { fen: string; depth: number; multiPv: number; resolve: (a: Analysis) => void; reject: (e: Error) => void }

export class EngineUnavailable extends Error { constructor(cause: unknown) { super('EngineUnavailable'); this.cause = cause; } }

export class EngineClient {
  private worker: WorkerLike | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private lines = new Map<number, AnalysisLine>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;

  constructor(private readonly spawn: () => WorkerLike, private readonly opts: { idleMs: number } = { idleMs: 60_000 }) {}

  analyse(req: AnalyseRequest): Promise<Analysis> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen: req.fen, depth: req.depth, multiPv: req.multiPv ?? 1, resolve, reject });
      void this.pump();
    });
  }

  async bestMove(req: AnalyseRequest): Promise<string> {
    const a = await this.analyse({ ...req, multiPv: 1 });
    const m = a.lines[0]?.move;
    if (!m) throw new EngineUnavailable('no bestmove');
    return m;
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; void this.pump(); }

  dispose() { this.stopIdle(); this.worker?.terminate(); this.worker = null; this.ready = null; }

  private ensure(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let w: WorkerLike;
      try { w = this.spawn(); } catch (e) { this.ready = null; reject(new EngineUnavailable(e)); return; }
      this.worker = w;
      w.onmessage = (e) => this.onLine(String(e.data), resolve);
      w.postMessage('uci');
    });
    return this.ready;
  }

  private onLine(line: string, onReady: () => void) {
    if (line === 'uciok') { this.worker?.postMessage('setoption name Hash value 16'); this.worker?.postMessage('setoption name Threads value 1'); this.worker?.postMessage('isready'); return; }
    if (line === 'readyok') { onReady(); return; }
    const job = this.current;
    if (!job) return;
    const info = parseInfo(line);
    if (info) { this.lines.set(info.multipv, { move: info.pv[0] ?? '', pv: info.pv, score: info.score, depth: info.depth }); return; }
    if (line.startsWith('bestmove')) {
      const best = parseBestMove(line);
      const ordered = [...this.lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      if (ordered.length === 0 && best) ordered.push({ move: best, pv: [best], score: { cp: 0 }, depth: job.depth });
      this.current = null;
      job.resolve({ lines: ordered, depth: job.depth });
      this.startIdle();
      void this.pump();
    }
  }

  private async pump() {
    if (this.current || this.paused) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    this.stopIdle();
    try { await this.ensure(); } catch (e) { this.current = null; job.reject(e as Error); this.queue.splice(0).forEach((j) => j.reject(e as Error)); return; }
    this.lines.clear();
    const w = this.worker;
    if (!w) { this.current = null; job.reject(new EngineUnavailable('worker missing')); return; }
    w.postMessage(`setoption name MultiPV value ${job.multiPv}`);
    w.postMessage(`position fen ${job.fen}`);
    w.postMessage(`go depth ${job.depth}`);
  }

  private startIdle() {
    this.stopIdle();
    this.idleTimer = setTimeout(() => { if (!this.current && this.queue.length === 0) { this.worker?.terminate(); this.worker = null; this.ready = null; } }, this.opts.idleMs);
  }
  private stopIdle() { if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; } }
}

/** Browser factory: the worker script locates its .wasm beside itself, so serve both from public/engine. */
export function createBrowserEngine(): EngineClient {
  return new EngineClient(() => new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`) as unknown as WorkerLike);
}

let shared: EngineClient | null = null;
export function getEngine(): EngineClient { return (shared ??= createBrowserEngine()); }

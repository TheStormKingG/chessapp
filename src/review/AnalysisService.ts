import type { Analysis } from '@/engine';
import { EngineUnavailable, scoreToWinPercent } from '@/engine';
import type { AnalysedPosition } from './types';

/**
 * PRD F-RV-1.
 *
 * One search per position at MultiPV 1. The value of the move actually played
 * is the NEXT position's value, negated, so 80 positions cover 79 moves with 80
 * searches rather than 158. MultiPV 2 costs 2.6x in the browser (design spec
 * section 1.2) and does not fit the 60-second budget; it is confined to the key
 * moments, via deepen().
 *
 * Depth is not fixed. The service times the first few positions, projects the
 * total, and steps down a ladder if the projection blows the budget — because
 * the multiplier between the development machine and the reference phone is not
 * measured (design spec section 1.4.4) and a fixed depth is therefore a bet.
 * The worst case of a ladder is a shallower review, which the summary states.
 */

/** Only the part of EngineClient this service uses, so a test can supply a fake. */
export interface AnalysisEngine {
  analyse(req: { fen: string; depth: number; multiPv?: number }): Promise<Analysis>;
}

export const BUDGET_MS = 60_000; // F-RV-1: "in under 60 seconds for a 40-move game"
export const WALL_MS = 90_000; // F-RV-1: "if analysis exceeds 90 seconds"
export const LADDER = [14, 12, 10] as const;

/**
 * Cost of each rung relative to depth 14, at MultiPV 1, measured by
 * scripts/measure-review-depth.mjs (Task 12) on an Apple M1, in a Chromium
 * Worker, over 81 positions of a real 80-move game. Two runs agreed:
 * depth 12 at 0.284 and 0.307, depth 10 at 0.097 and 0.103; the figures below
 * are those means, rounded.
 *
 * They are a shape, not a constant of nature: the assertion that protects them
 * is monotonicity, not the literal values. Re-measure on the target hardware
 * before trusting them there — that is exactly what the runtime ladder exists
 * to avoid depending on.
 */
export const DEPTH_COST: Record<number, number> = { 14: 1, 12: 0.3, 10: 0.1 };

export interface RunOptions {
  /** Injectable clock, so the budget and wall are testable without waiting. */
  now?: () => number;
  calibrateN?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface RunResult {
  positions: AnalysedPosition[];
  depth: number;
  partial: boolean;
  cancelled: boolean;
  failed: boolean;
}

export class AnalysisService {
  private cancelled = false;

  constructor(
    private readonly engine: AnalysisEngine,
    private readonly opts: RunOptions = {},
  ) {}

  cancel() {
    this.cancelled = true;
  }

  /**
   * `fens[0]` is the start position; `fens[i + 1]` is the position after ply i.
   * Submits ONE job at a time and awaits it: the shared EngineClient's queue has
   * no cancel, and flooding it would also hold up the board's own requests.
   */
  async run(fens: string[]): Promise<RunResult> {
    const now = this.opts.now ?? (() => Date.now());
    const calibrateN = this.opts.calibrateN ?? 6;
    const t0 = now();
    const positions: AnalysedPosition[] = [];
    let depth: number = LADDER[0];
    let failed = false;
    let partial = false;

    for (let i = 0; i < fens.length; i += 1) {
      if (this.cancelled) break;
      if (now() - t0 >= WALL_MS) {
        partial = true;
        break;
      }
      const fen = fens[i];
      if (fen === undefined) break;
      let a: Analysis;
      try {
        a = await this.engine.analyse({ fen, depth, multiPv: 1 });
      } catch (e) {
        if (!(e instanceof EngineUnavailable)) throw e;
        failed = true;
        break;
      }
      // Cancelled while this search was in flight. The result is real but the
      // caller has moved on, so it is dropped rather than appended: a late
      // reply that writes into a screen which has already left is the bug this
      // codebase has shipped once before.
      if (this.cancelled) break;
      const line = a.lines[0];
      if (line === undefined) {
        // A search that returned no line at all is an unusable engine, not a
        // position with no moves: EngineClient synthesises a line from
        // `bestmove` when it has no `info` at all. Treat it like a failure
        // rather than fabricating a win percentage.
        failed = true;
        break;
      }
      positions.push({
        index: i,
        fen,
        win: scoreToWinPercent(line.score),
        bestUci: line.move,
        pv: line.pv,
        depth,
      });
      this.opts.onProgress?.(positions.length, fens.length);

      // Choose the ladder rung once, on the calibration sample.
      if (i + 1 === calibrateN && fens.length > calibrateN) {
        depth = this.chooseDepth((now() - t0) / calibrateN, fens.length);
      }
    }

    return { positions, depth, partial, cancelled: this.cancelled, failed };
  }

  /** PRD F-RV-1: "Key moments are then re-analysed at a higher depth." */
  async deepen(fen: string, depth: number): Promise<Analysis> {
    return this.engine.analyse({ fen, depth, multiPv: 2 });
  }

  private chooseDepth(meanMsAt14: number, total: number): number {
    for (const rung of LADDER) {
      const cost = DEPTH_COST[rung] ?? 1;
      const projected = meanMsAt14 * cost * total;
      if (projected <= BUDGET_MS) return rung;
    }
    // Nothing on the ladder fits: take the shallowest rung and let the wall and
    // the `partial` flag handle the rest. `noUncheckedIndexedAccess` makes a
    // computed index on the tuple `number | undefined`, so index the last rung
    // literally rather than asserting it away.
    return LADDER[2];
  }
}

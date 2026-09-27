import { countAnalysed, countImported, countPendingAnalysis, markAnalysis, pendingAnalysis } from './storage';
import type { AnalysisState, ImportedGameRow } from './types';

/**
 * F-IM-3, "Analysis order and speed".
 *
 * > "The ten most recent games are analysed at once on the device with a visible
 * > progress bar, at the review depth in F-RV-1, so the learner sees a first
 * > profile within about five minutes. The rest are analysed in the background
 * > while the app is open, and continue on a later visit if the app is closed.
 * > The profile updates as games complete and shows how many games it is based on."
 *
 * The depth is not chosen here. `AnalysisService` already picks a rung of
 * F-RV-1's ladder from a measured rate on the actual device, and re-deciding that
 * for imported games would be a second, unmeasured answer to a question the
 * review layer has already answered properly.
 *
 * This module is orchestration only: it holds no engine and no Dexie review
 * table, and takes the per-game work as a function. That is what lets the
 * ordering, the resume behaviour and the stop conditions be tested with no engine,
 * no worker and no wasm — the parts most likely to be wrong are the parts that do
 * not need Stockfish to exercise.
 */

/** F-IM-3: "The ten most recent games are analysed at once." */
export const FOREGROUND_COUNT = 10;

/**
 * Analyses one game and says how it ended.
 *
 * Returning a state rather than throwing is deliberate: a queue of 500 games in
 * which one game's analysis throws must not lose the other 499, and a failure has
 * to be RECORDED against that game or the queue will pick it up again on every
 * visit for ever.
 */
export type GameAnalyser = (
  row: ImportedGameRow,
  onPositions: (done: number, total: number) => void,
) => Promise<Extract<AnalysisState, 'done' | 'failed'>>;

export interface QueueOptions {
  analyser: GameAnalyser;
  /** Progress within the current game, for F-IM-3's progress bar. */
  onPositions?: (done: number, total: number) => void;
  /** After each game: how many of this run's games are finished. */
  onGameDone?: (completed: number, total: number, row: ImportedGameRow) => void;
  /**
   * Checked before each game. Returning false stops the run cleanly.
   *
   * This is how "in the background while the app is open" ends: the caller's
   * cleanup flips it, and the queue stops between games rather than mid-analysis.
   * It is checked before every game rather than once, because a background run
   * over 490 games outlives many screens.
   */
  shouldContinue?: () => boolean;
}

export interface QueueOutcome {
  analysed: number;
  failed: number;
  /** True when the run stopped early because `shouldContinue` said so. */
  stopped: boolean;
}

/**
 * Walks up to `limit` pending games, newest first.
 *
 * The pending list is re-read on every iteration rather than snapshotted once.
 * A snapshot would be a list of rows whose `analysis` field is a copy taken
 * before any of them ran, so a game analysed by a foreground run that overlapped
 * this one would be analysed a second time here — and the second review would
 * overwrite the first and append a second `game_reviewed` event for one game.
 */
async function drain(limit: number, opts: QueueOptions): Promise<QueueOutcome> {
  let analysed = 0;
  let failed = 0;
  let stopped = false;
  const total = Math.min(limit, await countPendingAnalysis());

  for (let i = 0; i < limit; i += 1) {
    if (opts.shouldContinue && !opts.shouldContinue()) {
      stopped = true;
      break;
    }
    const next = (await pendingAnalysis(1))[0];
    if (next === undefined) break;

    let state: Extract<AnalysisState, 'done' | 'failed'>;
    try {
      state = await opts.analyser(next, (d, t) => {
        opts.onPositions?.(d, t);
      });
    } catch {
      // An analyser that throws is the same outcome as one that reports failure.
      // What must not happen is the row staying `pending`, because then this game
      // is retried on every visit and the queue never reaches the next one.
      state = 'failed';
    }
    await markAnalysis(next.gameId, state);
    if (state === 'done') analysed += 1;
    else failed += 1;
    opts.onGameDone?.(analysed + failed, total, next);
  }
  return { analysed, failed, stopped };
}

/**
 * F-IM-3's first pass: the ten most recent, with the learner watching.
 *
 * `pendingAnalysis` orders by `playedAt` descending, so "the ten most recent"
 * is the ten most recently PLAYED and not the ten most recently imported. For an
 * import that walks chess.com's months backwards those two orders are the same
 * only by accident, and the learner's first profile should rest on their newest
 * chess.
 */
export async function runForegroundAnalysis(opts: QueueOptions): Promise<QueueOutcome> {
  return drain(FOREGROUND_COUNT, opts);
}

/**
 * F-IM-3's second pass: everything still pending.
 *
 * Bounded by the number pending at the start rather than by `Infinity`, so a
 * defective analyser that somehow left rows pending cannot spin for ever. The
 * bound is re-derived on each call, which is exactly what makes the run resume on
 * a later visit: the state it resumes from is the `analysis` column, not anything
 * this process remembered.
 */
export async function runBackgroundAnalysis(opts: QueueOptions): Promise<QueueOutcome> {
  const pending = await countPendingAnalysis();
  if (pending === 0) return { analysed: 0, failed: 0, stopped: false };
  return drain(pending, opts);
}

/**
 * F-IM-3: "shows how many games it is based on", and F-SW-6's sample size.
 *
 * `analysed` is the honest denominator for the profile: a game that has been
 * imported but not yet analysed contributes nothing to it, and counting it would
 * overstate the profile's basis for as long as the queue is behind.
 */
export interface ProfileBasis {
  imported: number;
  analysed: number;
  pending: number;
}

export async function profileBasis(): Promise<ProfileBasis> {
  const [imported, analysed, pending] = await Promise.all([countImported(), countAnalysed(), countPendingAnalysis()]);
  return { imported, analysed, pending };
}

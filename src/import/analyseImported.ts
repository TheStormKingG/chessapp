import { db } from '@/data/db';
import { useProgress } from '@/data';
import { getEngine } from '@/engine';
import { reportEngineFailure, reportError } from '@/analytics';
import { AnalysisService, bandForUnit, bankReview, loadBook, lookupOpening, positionsOf, reviewFor } from '@/review';
import type { AnalysisEngine } from '@/review';
import type { GameAnalyser } from './analysisQueue';
import { sourceFromImported } from './reviewSource';

/**
 * The real per-game analyser behind F-IM-3 and F-IM-6.
 *
 * This is a thin adapter and nothing more. It builds the `ReviewSource` and hands
 * it to `reviewFor`, which is the same function `ReviewScreen` calls — so an
 * imported game is analysed by the same code, at the same F-RV-1 depth ladder, and
 * produces the same cached `Review`. Opening the review afterwards is then a cache
 * hit rather than a second analysis, because `reviewFor` serves a complete cached
 * review.
 *
 * It is kept out of ./analysisQueue.ts on purpose: the queue holds the ordering,
 * the resume behaviour and the stop conditions, and those are worth testing
 * without an engine. Everything that genuinely needs Stockfish is here.
 */

/** How far up the learner's path the review's thresholds should be read at. */
function currentBand() {
  const progress = useProgress.getState().progress;
  const units = Object.keys(progress.units ?? {});
  // Same shape as ReviewScreen's `furthestUnit`: the highest unit id the learner
  // has touched, which bandForUnit turns into one of the four PRD sections.
  const furthest = units.sort().at(-1) ?? '1.1';
  return bandForUnit(furthest);
}

export interface AnalyserDeps {
  engine?: AnalysisEngine;
  /** Injected in tests; the real one appends to the event log. */
  append?: (p: ReturnType<typeof bankReview>) => Promise<unknown>;
}

/**
 * Builds the analyser the queue calls.
 *
 * The engine is resolved ONCE per analyser rather than per game: `getEngine()`
 * returns a shared client backed by one worker, and asking for it 500 times would
 * be 500 calls that each risk spawning a worker if that singleton ever changes.
 */
export function makeImportedGameAnalyser(deps: AnalyserDeps = {}): GameAnalyser {
  const engine = deps.engine ?? getEngine();
  return async (row, onPositions) => {
    const source = sourceFromImported(row);
    try {
      // The opening book is a nicety, exactly as in ReviewScreen: no cache and no
      // connection costs the opening name, not the review.
      let book = null;
      try {
        const b = await loadBook();
        const { ucis } = positionsOf(source.sans);
        const r = lookupOpening(b, ucis);
        book = { name: r.name, leftBookAtPly: r.leftBookAtPly, bookPlies: r.bookPlies };
      } catch (e) {
        reportError(e, { where: 'import:openingBook' });
      }

      const service = new AnalysisService(engine, { onProgress: onPositions });
      const { review, fromCache } = await reviewFor({
        source,
        table: db.reviews,
        engine,
        band: currentBand(),
        book,
        service,
      });

      // F-IM-6: "Imported games feed the error log, the habit score and the
      // profile." They do so by appending the SAME event an in-app game appends,
      // which is why no projection needed changing. It is appended only for a
      // review that was actually computed here — a cache hit means the event was
      // banked when that review was built, and appending a second one would count
      // one game twice in the habit score.
      if (!fromCache) {
        const payload = bankReview(review, false);
        if (payload) {
          const append = deps.append ?? ((p: typeof payload) => useProgress.getState().append(p));
          await append(payload);
        }
      }
      // A partial review still counts as a reviewed game (F-RV-1), so it is
      // `done` and not `failed`: the learner did the work and saw a real review,
      // and leaving it pending would re-analyse it on every visit for ever.
      return 'done';
    } catch (e) {
      reportEngineFailure(e, 'import:analyse', { extra: { gameId: row.gameId } });
      return 'failed';
    }
  };
}

/**
 * Per-band puzzle packs (PRD 8.4 F-PZ-9, design spec sections 2.4 and 3.2).
 *
 * Format is produced by `scripts/build-puzzles.mjs`; see that file's header.
 * Each line is padded to LINE_WIDTH and the file is sorted by rating, so
 * `findByRating` is two binary searches and a slice rather than a scan.
 *
 * FETCHED, NEVER IMPORTED, and never precached. `vite.config.ts` carries a
 * CacheFirst `/data/` route, and `globPatterns` deliberately omits `txt`: a
 * precached pack would be charged to every first load, and the shell budget has
 * no room for it. `tests/e2e/sw-upgrade.spec.ts` asserts both halves against
 * the BUILT worker.
 *
 * THE CACHE HOLDS THE RESOLVED PACK, NOT THE PROMISE. `openingBook.ts` does
 * `cached ??= fetch(...)`, which stores the in-flight promise — so a
 * first-ever fetch made while offline poisons the module for the whole session
 * and coming back online does not retry until a reload. Here a rejection clears
 * the slot, so the next call tries again; concurrent callers still share one
 * fetch, which is the only property the promise cache was buying.
 */
import type { Puzzle, RatingBand, Theme } from './types';
import { THEMES } from './themes';

/** Must match LINE_WIDTH in scripts/build-puzzles.mjs. */
export const LINE_WIDTH = 120;

const KNOWN = new Set<string>(THEMES);

/** Packs that have loaded. Holds the value, so a later failure cannot unset it. */
const resolved = new Map<RatingBand, Puzzle[]>();
/** Loads in flight, so concurrent callers share a fetch. Cleared on settle. */
const inflight = new Map<RatingBand, Promise<Puzzle[]>>();

export function parsePack(text: string): Puzzle[] {
  const out: Puzzle[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line === '') continue;
    const [id, rating, themes, fen, solution] = line.split('\t');
    if (id === undefined || rating === undefined || themes === undefined) continue;
    if (fen === undefined || solution === undefined) continue;
    const parsed = themes.split('|').filter((t): t is Theme => KNOWN.has(t));
    if (parsed.length === 0) continue;
    out.push({
      id,
      fen,
      solution: solution.split(' ').filter(Boolean),
      rating: Number(rating),
      themes: parsed,
    });
  }
  return out;
}

/**
 * Load one band's pack, once per session.
 *
 * Rejects when the network and the runtime cache both miss — which is the
 * honest answer, and leaves the module able to succeed on the next call.
 */
export function loadPack(band: RatingBand, fetchImpl: typeof fetch = fetch): Promise<Puzzle[]> {
  const have = resolved.get(band);
  if (have) return Promise.resolve(have);

  const running = inflight.get(band);
  if (running) return running;

  const p = fetchImpl(`${import.meta.env.BASE_URL}data/puzzles/${band}.txt`)
    .then((r) => {
      if (!r.ok) throw new Error(`puzzle pack ${band}: HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
      const pack = parsePack(text);
      resolved.set(band, pack);
      return pack;
    })
    .finally(() => {
      // Clear the slot on BOTH paths. On success the value is already in
      // `resolved`; on failure clearing it is what lets the next call retry.
      inflight.delete(band);
    });

  inflight.set(band, p);
  return p;
}

/** Index of the first puzzle with `rating >= target`, by binary search. */
function lowerBound(pack: Puzzle[], target: number): number {
  let lo = 0;
  let hi = pack.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    // `mid < pack.length` always holds here; the fallback exists only to
    // satisfy noUncheckedIndexedAccess.
    if ((pack[mid]?.rating ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Every puzzle with `min <= rating <= max`, inclusive at both bounds.
 *
 * An empty window is a real answer, not an error: a learner at the top of the
 * shipped band genuinely has nothing in window, and design spec 3.2 makes
 * widening the caller's decision, not this function's.
 */
export function findByRating(pack: Puzzle[], min: number, max: number): Puzzle[] {
  return pack.slice(lowerBound(pack, min), lowerBound(pack, max + 1));
}

/** Test seam: forget every cached pack. Not used by application code. */
export function __resetPacks(): void {
  resolved.clear();
  inflight.clear();
}

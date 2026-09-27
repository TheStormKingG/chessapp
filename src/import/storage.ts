import { db } from '@/data/db';
import type { AnalysisState, CachedArchive, ImportedGame, ImportedGameRow } from './types';

/**
 * Dexie access for import. Everything that reads or writes the `imported` and
 * `archives` tables goes through here, so the queries F-IM-3 depends on exist in
 * one place and can be read against the indexes declared in src/data/db.ts.
 */

/**
 * Stores games, skipping any already held.
 *
 * Returns the counts F-IM-7 needs to say a re-import cost nothing. `bulkPut`
 * would be shorter and would silently overwrite, which would reset the
 * `analysis` state of every game already analysed — turning a re-import into a
 * full re-analysis, the exact opposite of the requirement.
 */
export async function storeImported(
  games: readonly ImportedGame[],
  now = new Date(),
): Promise<{ added: number; alreadyHeld: number }> {
  if (games.length === 0) return { added: 0, alreadyHeld: 0 };
  const ids = games.map((g) => g.gameId);
  const existing = await db.imported.where('gameId').anyOf(ids).primaryKeys();
  const held = new Set(existing);
  const fresh: ImportedGameRow[] = [];
  const seen = new Set<string>();
  for (const g of games) {
    if (held.has(g.gameId)) continue;
    // A provider can return the same game twice — chess.com's monthly archives
    // overlap at a month boundary when a game's end_time and its archive month
    // disagree. Two rows with one key is not possible in Dexie, but counting the
    // duplicate as "added" would overstate the import to the learner.
    if (seen.has(g.gameId)) continue;
    seen.add(g.gameId);
    fresh.push({ ...g, importedAt: now.toISOString(), analysis: 'pending' });
  }
  if (fresh.length > 0) await db.imported.bulkAdd(fresh);
  return { added: fresh.length, alreadyHeld: games.length - fresh.length };
}

/** Every imported game, newest first. F-IM-6's listing order. */
export async function allImported(): Promise<ImportedGameRow[]> {
  return db.imported.orderBy('playedAt').reverse().toArray();
}

export async function importedById(gameId: string): Promise<ImportedGameRow | undefined> {
  return db.imported.get(gameId);
}

export async function countImported(): Promise<number> {
  return db.imported.count();
}

/**
 * The next games awaiting analysis, newest first (F-IM-3).
 *
 * `where('analysis')` uses the declared index, so resuming on a later visit costs
 * an index walk rather than reading every stored game. The sort is applied after
 * the index filter because Dexie cannot order by a second field on an `equals`
 * query without the compound index, and reversing a compound range here would
 * read less clearly than sorting a list that is at most 500 long.
 */
export async function pendingAnalysis(limit: number): Promise<ImportedGameRow[]> {
  const rows = await db.imported.where('analysis').equals('pending' satisfies AnalysisState).toArray();
  rows.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  return rows.slice(0, limit);
}

export async function countPendingAnalysis(): Promise<number> {
  return db.imported.where('analysis').equals('pending' satisfies AnalysisState).count();
}

/** How many imported games have a finished review. F-IM-3's "how many games it rests on". */
export async function countAnalysed(): Promise<number> {
  return db.imported.where('analysis').equals('done' satisfies AnalysisState).count();
}

export async function markAnalysis(gameId: string, analysis: AnalysisState): Promise<void> {
  await db.imported.update(gameId, { analysis });
}

/**
 * Reads a cached archive body, or null.
 *
 * An INCOMPLETE month is never returned: the current month grows as the learner
 * plays, and handing back yesterday's copy of it is how a cache stops F-IM-4's
 * daily check from ever seeing a new game. The row is kept rather than deleted so
 * that the fetch that replaces it can be a conditional one later.
 */
export async function readArchive(url: string): Promise<string | null> {
  const row = await db.archives.get(url);
  if (row === undefined) return null;
  if (!row.complete) return null;
  return row.body;
}

export async function writeArchive(url: string, body: string, complete: boolean, now = new Date()): Promise<void> {
  const row: CachedArchive = { url, body, fetchedAt: now.toISOString(), complete };
  await db.archives.put(row);
}

/** F-AC-4: imported data is covered by the same deletion rules as everything else. */
export async function deleteAllImported(): Promise<void> {
  await db.imported.clear();
  await db.archives.clear();
}

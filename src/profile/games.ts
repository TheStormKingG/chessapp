import type { LearnerEvent } from '@/data/events';
import type { Review } from '@/review/types';
import type { ImportedGameRow } from '@/import/types';
import type { ProfileGame } from './types';

/**
 * Where the profile's games come from.
 *
 * A `Review` carries the analysis and two things it does not carry: when the game
 * was PLAYED and how it ended. Those come from whichever side of the existing
 * import/in-app seam the game arrived on:
 *
 *  - an imported game: the `imported` Dexie row, which has `playedAt`, `result` and
 *    F-IM-2's `speed`;
 *  - an in-app game: the event log, where `game_started` carries the colour and its
 *    own `createdAt` is when the game began, and `game_finished` carries the result.
 *    This is the same join `sourceFromEvents` does in src/review/gameSource.ts, and
 *    it is done here rather than reused because that function rebuilds a
 *    `ReviewSource` for re-analysis — it needs the PGN and the persona, which this
 *    does not, and it returns null for a game whose PGN is empty, which is a game
 *    the profile should still count if it has a review.
 *
 * ── WHY A REVIEW WITH NO PROVENANCE IS DROPPED ───────────────────────────────
 *
 * `review.createdAt` is when the ANALYSIS ran, not when the game was played, and
 * for an imported back-catalogue the two are years apart. Using it as a fallback
 * would put a 2019 game at the top of the recency ranking because it was imported
 * this morning — a wrong answer that looks entirely ordinary. So an undateable
 * review is excluded and counted, and the count is surfaced rather than swallowed:
 * a non-zero one means something upstream is wrong and a screen can say so.
 *
 * In practice it is zero. `useGame` appends `game_started` before any move, and
 * `storeImported` writes the row before analysis is queued, so every review has one
 * side of the seam behind it.
 */

export interface ProfileGamesResult {
  games: ProfileGame[];
  /** Reviews that could not be dated, and so are not in the profile. */
  undateable: number;
}

/**
 * Assembles the profile's input. Pure: the caller does the reading.
 *
 * Returns games in whatever order the reviews arrived in — `buildProfile` sorts,
 * and doing it here as well would be two places that decide what "recent" means.
 */
export function profileGamesFrom(input: {
  reviews: readonly Review[];
  imported: readonly ImportedGameRow[];
  events: readonly LearnerEvent[];
}): ProfileGamesResult {
  const importedById = new Map(input.imported.map((r) => [r.gameId, r]));

  /** gameId to what the event log knows about that in-app game. */
  const inApp = new Map<string, { startedAt?: string; result?: 'win' | 'loss' | 'draw' }>();
  for (const e of input.events) {
    const p = e.payload;
    if (p.type === 'game_started') {
      const entry = inApp.get(p.gameId) ?? {};
      // The FIRST game_started wins. A gameId cannot be started twice, but if the
      // log ever held two, the earlier one is when the game began.
      entry.startedAt = entry.startedAt ?? e.createdAt;
      inApp.set(p.gameId, entry);
    } else if (p.type === 'game_finished') {
      const entry = inApp.get(p.gameId) ?? {};
      entry.result = p.result;
      inApp.set(p.gameId, entry);
    }
  }

  const games: ProfileGame[] = [];
  let undateable = 0;

  for (const review of input.reviews) {
    const row = importedById.get(review.gameId);
    if (row !== undefined) {
      games.push({
        gameId: review.gameId,
        playedAt: row.playedAt,
        result: row.result,
        speed: row.speed,
        review,
      });
      continue;
    }
    const own = inApp.get(review.gameId);
    if (own?.startedAt !== undefined && own.result !== undefined) {
      games.push({
        gameId: review.gameId,
        playedAt: own.startedAt,
        result: own.result,
        speed: 'in-app',
        review,
      });
      continue;
    }
    undateable += 1;
  }

  return { games, undateable };
}

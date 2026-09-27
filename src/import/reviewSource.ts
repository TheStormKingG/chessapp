import type { ReviewSource } from '@/review/types';
import { importedById } from './storage';
import type { ImportedGame } from './types';

/**
 * F-IM-6: "Every imported game gets a full review (section 8.6), listed in the
 * Review tab with the source, the opponent and the result."
 *
 * ── THIS IS THE OTHER HALF OF AN EXISTING SEAM ───────────────────────────────
 *
 * src/review/gameSource.ts says of `sourceFromEvents`:
 *
 * > "Import (PRD F-RV-9, out of scope for this plan) would build the same
 * > ReviewSource from a PGN and everything downstream would be unchanged. This
 * > function is the seam."
 *
 * So this file builds that same `ReviewSource` and nothing in src/review/ changes
 * shape to accommodate it. The whole analysis path — `positionsOf`, then
 * `AnalysisService` at F-RV-1's depth ladder, `judgeMoves`, `keyMoments`,
 * `errorLog`, `buildReview` and the `ReviewScreen` that shows it — runs on an
 * imported game exactly as it runs on one played in the app, because it cannot
 * tell the difference.
 *
 * That is also why an imported game banks the ordinary `game_reviewed` event:
 * F-IM-6's "Imported games feed the error log, the habit score and the profile"
 * needs no new projection, because the projection already counts that event.
 */
export function sourceFromImported(game: ImportedGame): ReviewSource {
  return {
    gameId: game.gameId,
    learner: game.learner,
    /**
     * `persona` is what the coach names when it says "this is from your game
     * against Rosa". For an imported game that is the opponent's username, which
     * is the most truthful thing available: there is no persona, and inventing
     * one would put a name in the coach's mouth that the learner never played.
     */
    persona: game.opponent,
    sans: game.sans,
    result: game.result,
    timeControl: 'imported',
    startedAt: game.playedAt,
  };
}

/**
 * Resolves an imported game's review source by id, or null.
 *
 * `ReviewScreen` calls this after `sourceFromEvents` returns null, so one route —
 * `/play/review/:gameId` — serves both kinds of game and an imported game's
 * review is reached by exactly the link an in-app game's is. Adding a second
 * route would have meant a second screen, and F-IM-6 asks for the same review,
 * not a similar one.
 */
export async function importedSource(gameId: string): Promise<ReviewSource | null> {
  const row = await importedById(gameId);
  if (row === undefined) return null;
  return sourceFromImported(row);
}

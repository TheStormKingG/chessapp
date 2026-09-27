import type { Color } from '@/rules';

/**
 * The import vocabulary (PRD 8.14, F-IM-1 … F-IM-7). Every other file in
 * src/import/ speaks it and none of them redefine any of it.
 */

/**
 * Where a game came from. F-IM-6 lists this beside the opponent and the result,
 * so it is a stored property of the game and not a property of the screen that
 * happens to be showing it.
 */
export type ImportSource = 'chess.com' | 'lichess' | 'pgn';

/**
 * F-IM-2's speeds. `daily` is chess.com's correspondence class; Lichess calls
 * the same thing `correspondence` and the adapters normalise onto this union.
 *
 * `other` exists because both sites return classes this feature does not
 * import — ultraBullet, classical, and every variant pool — and a game that
 * lands there must be *visibly* excluded rather than silently coerced into
 * `blitz` by a fallback. F-IM-2 names four classes; a fifth bucket for
 * everything else is what keeps the four honest.
 */
export type Speed = 'rapid' | 'blitz' | 'daily' | 'bullet' | 'other';

/**
 * One game as import understands it, before any engine work.
 *
 * `sans` is the move list, which is what `ReviewSource` in src/review/types.ts
 * consumes — see `sourceFromImported` in ./reviewSource.ts. Storing the SAN list
 * rather than the raw PGN would throw away the tags F-IM-6 needs, so both are
 * kept: `pgn` is the archival record, `sans` the replayable one.
 */
export interface ImportedGame {
  /** Stable across re-imports of the same game — see `gameIdOf` in ./identity.ts. */
  gameId: string;
  source: ImportSource;
  /** The side the learner played. */
  learner: Color;
  /** The other player's display name, as the source site spells it. */
  opponent: string;
  /** Result from the learner's point of view, so it needs no colour to read. */
  result: 'win' | 'loss' | 'draw';
  speed: Speed;
  /** ISO 8601. When the source gives only a date, midnight UTC of that date. */
  playedAt: string;
  sans: string[];
  /** The game's full PGN as the source supplied it. */
  pgn: string;
  /** The learner's rating in that game, when the source states one. */
  learnerElo: number | null;
  opponentElo: number | null;
}

/**
 * F-IM-7 / F-ER-4: "If a source is unreachable or a username does not exist,
 * the app says so plainly."
 *
 * A discriminated union rather than an Error subclass, because the screen has to
 * show a different sentence and a different retry offer for each, and `instanceof`
 * across a module boundary is exactly the check that breaks under bundling.
 */
export type ImportFailure =
  | { kind: 'unknown-user'; source: ImportSource; username: string }
  | { kind: 'rate-limited'; source: ImportSource; retryAfterMs: number }
  | { kind: 'unreachable'; source: ImportSource; detail: string }
  | { kind: 'bad-pgn'; detail: string }
  | { kind: 'no-games'; source: ImportSource; username: string };

/** What a provider returns: either games or one stated reason there are none. */
export type FetchResult = { ok: true; games: ImportedGame[] } | { ok: false; failure: ImportFailure };

/**
 * A cached monthly archive body (F-IM-7: "caches monthly archives so a re-import
 * costs nothing").
 *
 * The body is stored verbatim rather than the games parsed out of it, so that a
 * later build which reads a field this one ignores gets it from the cache instead
 * of having to re-fetch every month the learner has ever played.
 */
export interface CachedArchive {
  /** The archive URL, which is the natural key. */
  url: string;
  body: string;
  fetchedAt: string;
  /**
   * Whether the month can never change again. The CURRENT month is never
   * complete: caching it would make F-IM-4's daily check permanently blind to
   * every new game, which is the one way "caching costs nothing" becomes wrong.
   */
  complete: boolean;
}

/** F-IM-3's analysis state for one imported game. */
export type AnalysisState = 'pending' | 'done' | 'failed';

/** An imported game as stored, plus the bookkeeping F-IM-3 resumes from. */
export interface ImportedGameRow extends ImportedGame {
  importedAt: string;
  /**
   * F-IM-3: "The rest are analysed in the background while the app is open, and
   * continue on a later visit if the app is closed." That sentence is the reason
   * this field is persisted rather than held in memory — a queue that lived in a
   * component would restart from the top on every visit, and re-analyse the ten
   * games it had already done.
   */
  analysis: AnalysisState;
}

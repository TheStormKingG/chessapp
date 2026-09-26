import Dexie, { type EntityTable } from 'dexie';
import type { LearnerEvent } from './events';
import type { LessonResume } from './resume';
import type { Review } from '@/review/types';
import type { RatingBand } from '@/puzzles/types';
import type { CachedArchive, ImportedGameRow } from '@/import/types';

export interface GameRow {
  id: string;
  pgn: string;
  fen: string;
  persona: string;
  color: 'w' | 'b';
  startedAt: string;
  finishedAt: string | null;
  result: 'win' | 'loss' | 'draw' | null;
}

/** What a learner has of a per-band puzzle pack (PRD 8.4 F-PZ-9). */
export interface PuzzlePackRow {
  band: RatingBand;
  fetchedAt: string;
  count: number;
}

export class ChessDb extends Dexie {
  events!: EntityTable<LearnerEvent, 'id'>;
  games!: EntityTable<GameRow, 'id'>;
  /** In-flight lesson places, keyed by lesson id — see resume.ts. */
  resume!: EntityTable<LessonResume, 'lessonId'>;
  /**
   * Cached reviews, keyed on gameId (PRD F-RV-3). This is derived data: the
   * append-only event log stays the source of truth for progress, and a review
   * can always be rebuilt by re-analysing the game. Losing this table costs
   * engine time, never progress.
   */
  reviews!: EntityTable<Review, 'gameId'>;
  /**
   * Per-band puzzle pack metadata. Derived data, like `reviews`: the packs
   * themselves live in the service worker's CacheFirst /data/ cache, and
   * losing this table costs a network round trip, never progress.
   */
  puzzles!: EntityTable<PuzzlePackRow, 'band'>;
  /**
   * Games imported from chess.com, Lichess or a PGN file (PRD 8.14 F-IM-1).
   *
   * These are NOT derived data, which is what makes this table different from
   * `reviews` and `puzzles`: an imported game cannot be rebuilt from the event
   * log, because the log records that an import happened and not the moves it
   * brought. Losing this table loses the games until the learner imports again,
   * and for a pasted PGN there may be nothing left to import from.
   *
   * The event log stays the source of truth for PROGRESS — every imported game
   * that gets reviewed appends the same `game_reviewed` event an in-app game
   * does, so the projection needs no knowledge of import at all.
   */
  imported!: EntityTable<ImportedGameRow, 'gameId'>;
  /**
   * F-IM-7: "caches monthly archives so a re-import costs nothing."
   *
   * Derived data — losing it costs network round trips, never games. Only
   * COMPLETE months are safe to keep indefinitely; see `isCompleteMonth` in
   * src/import/chesscom.ts for why the current month must never be trusted.
   */
  archives!: EntityTable<CachedArchive, 'url'>;
  constructor() {
    super('chessapp');
    this.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
    this.version(2).stores({ resume: 'lessonId' });
    this.version(3).stores({ reviews: 'gameId, createdAt' });
    /**
     * v4 caches per-band puzzle pack metadata (PRD 8.4 F-PZ-9). The packs
     * themselves are fetched and held by the service worker's CacheFirst
     * /data/ route; this table records which bands a learner has, so the
     * screen can say what is available offline without a network probe.
     *
     * Additive: no existing table is touched, so the upgrade cannot lose a
     * row. Task 7's dry-run proves that against a populated v3 database
     * rather than asserting it here in a comment.
     */
    this.version(4).stores({ puzzles: 'band, fetchedAt' });
    /**
     * v5 adds game import (PRD 8.14 F-IM-1 … F-IM-7).
     *
     * `imported` is indexed on `playedAt` and on `analysis` because F-IM-3 asks
     * for "the ten most recent" first and then "the rest in the background",
     * which is one descending query and one query by state. `[analysis+playedAt]`
     * is compound so resuming on a later visit is a single index walk rather
     * than a full-table scan the learner waits for on every open.
     *
     * Additive, like v4: no existing table is touched, so the upgrade cannot lose
     * a row. dbMigration.test.ts proves that against a populated earlier
     * database rather than asserting it here in a comment.
     */
    this.version(5).stores({
      imported: 'gameId, playedAt, analysis, source, [analysis+playedAt]',
      archives: 'url, fetchedAt, complete',
    });
  }
}

export const db = new ChessDb();

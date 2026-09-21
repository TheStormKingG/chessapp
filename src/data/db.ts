import Dexie, { type EntityTable } from 'dexie';
import type { LearnerEvent } from './events';
import type { LessonResume } from './resume';
import type { Review } from '@/review/types';
import type { RatingBand } from '@/puzzles/types';

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
  }
}

export const db = new ChessDb();

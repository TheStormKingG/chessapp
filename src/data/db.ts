import Dexie, { type EntityTable } from 'dexie';
import type { LearnerEvent } from './events';
import type { LessonResume } from './resume';
import type { Review } from '@/review/types';

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
  constructor() {
    super('chessapp');
    this.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
    this.version(2).stores({ resume: 'lessonId' });
    this.version(3).stores({ reviews: 'gameId, createdAt' });
  }
}

export const db = new ChessDb();

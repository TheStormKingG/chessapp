import Dexie, { type EntityTable } from 'dexie';
import type { LearnerEvent } from './events';
import type { LessonResume } from './resume';

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
  constructor() {
    super('chessapp');
    this.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
    this.version(2).stores({ resume: 'lessonId' });
  }
}

export const db = new ChessDb();

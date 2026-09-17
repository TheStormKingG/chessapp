/** Day in the device's local time zone, PRD F-EN-1 / F-AC-3. */
export function localDay(d: Date): string {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type EventPayload =
  | { type: 'lesson_started'; lessonId: string }
  | {
      type: 'challenge_attempted';
      lessonId: string;
      challengeId: string;
      correct: boolean;
      hints: number;
      misses: number;
      mastery: boolean;
      context: 'lesson' | 'checkpoint';
    }
  | { type: 'lesson_completed'; lessonId: string; stars: 1 | 2 | 3; xp: number; replay: boolean }
  | {
      type: 'checkpoint_attempted';
      unit: string;
      score: number;
      passed: boolean;
      attempt: number;
      missedConcepts: string[];
    }
  | { type: 'unit_tested_out'; unit: string }
  | {
      type: 'game_started';
      gameId: string;
      persona: string;
      color: 'w' | 'b';
      timeControl: 'untimed' | '10+0';
      coach: boolean;
    }
  | {
      type: 'game_finished';
      gameId: string;
      result: 'win' | 'loss' | 'draw';
      moves: number;
      hints: number;
      takebacks: number;
      crowns: 0 | 1 | 2 | 3;
      pgn: string;
    }
  | { type: 'settings_changed'; key: string; value: string | boolean | number };

export interface LearnerEvent {
  id: string;
  deviceDay: string;
  createdAt: string;
  payload: EventPayload;
  synced: 0 | 1;
}

export function newEvent(payload: EventPayload, now = new Date()): LearnerEvent {
  return {
    id: crypto.randomUUID(),
    deviceDay: localDay(now),
    createdAt: now.toISOString(),
    payload,
    synced: 0,
  };
}

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
      /**
       * Where the attempt happened. `'placement'` is the onboarding placement
       * test and the rules check (F-ON-5): that work is real and is recorded
       * like any other, but it is neither a lesson nor a unit's checkpoint, and
       * filing it under either would make a learner's first twelve questions
       * indistinguishable from a checkpoint they never took.
       *
       * `reduceProgress` counts every attempt whatever its context and reads
       * this field for nothing, so widening the union changes no projection.
       */
      context: 'lesson' | 'checkpoint' | 'placement';
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
  /**
   * PRD 2.2: a game review is a learning action; playing without reviewing is
   * not. Appended once per game, whether the analysis finished or stopped at
   * the 90-second wall — a learner on a slow device did the work and saw a real
   * review, and withholding the credit would penalise them for their hardware.
   *
   * `partial` is therefore a real boolean, not the literal `false` it was while
   * partial reviews were refused. It is the record of WHICH kind was banked, so
   * the event log distinguishes the two and a later migration can tell them
   * apart. Nothing downstream keys off it: `reduceProgress` counts a game once
   * by `gameId` whichever kind arrives first, so a partial banked now and a
   * full review banked after a re-analysis still count once.
   */
  | {
      type: 'game_reviewed';
      gameId: string;
      accuracy: number;
      blunders: number;
      mistakes: number;
      drillCompleted: boolean;
      partial: boolean;
    }
  /**
   * One finished puzzle attempt (PRD 8.4).
   *
   * `source` is a union rather than a boolean because F-PZ-2 requires themed
   * practice to have no rating impact, and Phase 2 adds sprint and streak run.
   * A boolean would need a migration the first time a third kind arrives.
   *
   * `ms` is the solve time, which F-PZ-1 shows after completion and never
   * before. It is recorded here so the screen never has to time itself.
   */
  | {
      type: 'puzzle_attempted';
      puzzleId: string;
      themes: string[];
      puzzleRating: number;
      solved: boolean;
      hinted: boolean;
      misses: number;
      source: 'rated' | 'themed' | 'daily' | 'fix';
      ms: number;
    }
  /**
   * One completed import (PRD 8.14 F-IM-1).
   *
   * The games themselves live in the `imported` Dexie table, not here: a payload
   * carrying five hundred PGNs would make every projection rebuild read
   * megabytes, and the event log is replayed on every load. What is recorded is
   * that an import happened, from where, and how much it brought — which is what
   * the profile's "how many games it rests on" (F-IM-3) and the honesty
   * requirements of F-IM-7 need.
   *
   * `username` is null for a pasted PGN, which has no account behind it.
   */
  | {
      type: 'games_imported';
      source: 'chess.com' | 'lichess' | 'pgn';
      username: string | null;
      /** How many games were stored by this import. */
      added: number;
      /** How many the source returned that were already held. F-IM-7's re-import. */
      alreadyHeld: number;
      /** How many were refused, with the reason counts folded into `skipped`. */
      skipped: number;
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

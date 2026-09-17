import type { LearnerEvent } from './events';

export interface Progress {
  lessons: Record<string, { stars: 1 | 2 | 3; completed: boolean }>;
  units: Record<string, { passed: boolean; attempts: number; testedOut: boolean }>;
  xp: number;
  attempts: number;
  masteryAttempts: number;
  games: number;
  consecutiveLosses: number;
  lastEventAt: string | null;
}

export function emptyProgress(): Progress {
  return {
    lessons: {},
    units: {},
    xp: 0,
    attempts: 0,
    masteryAttempts: 0,
    games: 0,
    consecutiveLosses: 0,
    lastEventAt: null,
  };
}

/** Pure projection of the append-only log. XP is never deducted (PRD F-EN-2). */
export function reduceProgress(start: Progress, events: LearnerEvent[]): Progress {
  const seen = new Set<string>();
  const p: Progress = structuredClone(start);
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const e of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    p.lastEventAt = e.createdAt;
    const x = e.payload;
    switch (x.type) {
      case 'lesson_completed': {
        const prev = p.lessons[x.lessonId];
        p.lessons[x.lessonId] = {
          stars: prev ? (Math.max(prev.stars, x.stars) as 1 | 2 | 3) : x.stars,
          completed: true,
        };
        p.xp += x.replay ? Math.floor(x.xp / 2) : x.xp;
        break;
      }
      case 'challenge_attempted': {
        p.attempts += 1;
        if (x.mastery) p.masteryAttempts += 1;
        break;
      }
      case 'checkpoint_attempted': {
        const u = p.units[x.unit] ?? { passed: false, attempts: 0, testedOut: false };
        p.units[x.unit] = { ...u, attempts: u.attempts + 1, passed: u.passed || x.passed };
        if (x.passed) p.xp += 50;
        break;
      }
      case 'unit_tested_out': {
        const u = p.units[x.unit] ?? { passed: false, attempts: 0, testedOut: false };
        p.units[x.unit] = { ...u, passed: true, testedOut: true };
        break;
      }
      case 'game_finished': {
        p.games += 1;
        p.consecutiveLosses = x.result === 'loss' ? p.consecutiveLosses + 1 : 0;
        p.xp += 10;
        break;
      }
      default:
        break;
    }
  }
  return p;
}

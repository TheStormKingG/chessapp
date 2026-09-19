import type { LearnerEvent } from './events';

export interface Progress {
  lessons: Record<string, { stars: 1 | 2 | 3; completed: boolean }>;
  /** `attempts` counts every attempt; `failedAttempts` only the failed ones (PRD 6.4). */
  units: Record<string, { passed: boolean; attempts: number; failedAttempts: number; testedOut: boolean }>;
  xp: number;
  attempts: number;
  masteryAttempts: number;
  games: number;
  /** PRD 2.2: completed game reviews. A review is a learning action; play alone is not. */
  reviews: number;
  /** The games already counted, so a second visit to the review route cannot double-count. */
  gamesReviewed: Record<string, true>;
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
    reviews: 0,
    gamesReviewed: {},
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
        const u = p.units[x.unit] ?? { passed: false, attempts: 0, failedAttempts: 0, testedOut: false };
        p.units[x.unit] = {
          ...u,
          attempts: u.attempts + 1,
          // PRD 6.4 counts failed attempts: a pass clears the run, it does not add to it.
          failedAttempts: x.passed ? 0 : u.failedAttempts + 1,
          passed: u.passed || x.passed,
        };
        // PRD F-PA-7: a retake of an already-passed checkpoint does not re-award the bonus.
        if (x.passed && !u.passed) p.xp += 50;
        break;
      }
      case 'unit_tested_out': {
        const u = p.units[x.unit] ?? { passed: false, attempts: 0, failedAttempts: 0, testedOut: false };
        p.units[x.unit] = { ...u, passed: true, failedAttempts: 0, testedOut: true };
        break;
      }
      case 'game_finished': {
        p.games += 1;
        p.consecutiveLosses = x.result === 'loss' ? p.consecutiveLosses + 1 : 0;
        p.xp += 10;
        break;
      }
      case 'game_reviewed': {
        // The `seen` set above de-duplicates by event id. This guard is the
        // different question: the same game reviewed twice, by two events with
        // two ids. Both are needed.
        if (!p.gamesReviewed[x.gameId]) {
          p.gamesReviewed[x.gameId] = true;
          p.reviews += 1;
          // PRD F-EN-2: XP is never deducted, and a review is worth more than a
          // game, because the research says review is the efficient half.
          p.xp += 20;
        }
        break;
      }
      default:
        break;
    }
  }
  return p;
}

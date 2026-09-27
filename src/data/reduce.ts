import type { LearnerEvent } from './events';
import { xpForEvent, type XpContext } from '@/engagement/xp';
import { nextRating } from '@/puzzles/rating';
import type { PuzzleRating } from '@/puzzles/types';

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
  /**
   * The games this log records as LOST, by id — the whole of what F-EN-2's
   * "review of a loss 25" needs from a game that finished earlier.
   *
   * Only losses, because only losses change a rate: a won game, a drawn game and
   * a game with no `game_finished` at all (every imported game) pay the same 15,
   * so storing the other results would be storing a distinction nothing reads.
   * The name says which distinction is kept.
   */
  lostGames: Record<string, true>;
  consecutiveLosses: number;
  /**
   * The puzzle rating, PROJECTED from the log and never stored as an
   * independently mutable value. When the formula changes — and it will, when
   * Glicko-2 lands — every historical rating re-derives instead of needing a
   * migration.
   */
  puzzleRating: PuzzleRating;
  puzzlesSolved: number;
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
    lostGames: {},
    consecutiveLosses: 0,
    puzzleRating: { rating: 800, confidence: 0 },
    puzzlesSolved: 0,
    lastEventAt: null,
  };
}

/**
 * Pure projection of the append-only log. XP is never deducted (PRD F-EN-2).
 *
 * The RATES live in `engagement/xp.ts`, which is the whole of F-EN-2's table in
 * one testable function; this file owns only WHEN an award happens — once per
 * game, once per unit — and hands that context over. Before this split the rates
 * were four literals in four `case` arms and three of them disagreed with the
 * PRD.
 */
export function reduceProgress(start: Progress, events: LearnerEvent[]): Progress {
  const seen = new Set<string>();
  const p: Progress = structuredClone(start);
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const e of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    p.lastEventAt = e.createdAt;
    const x = e.payload;

    /*
     * Built from the state BEFORE this event is applied, and the award is taken
     * from it before any arm below mutates that state. The ordering is the whole
     * correctness argument: `unitAlreadyPassed` read after the checkpoint arm has
     * set `passed` would be true for the very attempt that earned the bonus, and
     * `alreadyReviewed` read after the review arm would never pay a review at
     * all.
     */
    const ctx: XpContext = {
      alreadyReviewed: x.type === 'game_reviewed' && p.gamesReviewed[x.gameId] === true,
      unitAlreadyPassed: x.type === 'checkpoint_attempted' && (p.units[x.unit]?.passed ?? false),
      reviewedGameResult: x.type === 'game_reviewed' && p.lostGames[x.gameId] === true ? 'loss' : null,
    };
    p.xp += xpForEvent(x, ctx);

    switch (x.type) {
      case 'lesson_completed': {
        const prev = p.lessons[x.lessonId];
        p.lessons[x.lessonId] = {
          stars: prev ? (Math.max(prev.stars, x.stars) as 1 | 2 | 3) : x.stars,
          completed: true,
        };
        break;
      }
      case 'challenge_attempted': {
        p.attempts += 1;
        // F-PA-7: a replay does not change mastery. The attempt still counts
        // as an attempt -- the learner did the work -- but it cannot raise the
        // mastery figure a second time on content they have already proved.
        if (x.mastery && x.replay !== true) p.masteryAttempts += 1;
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
        // PRD F-PA-7's "a retake does not re-award the bonus" is `ctx`'s
        // `unitAlreadyPassed` above, read before this arm set `passed`.
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
        // Recorded for F-EN-2's "review of a loss 25", which is asked of a
        // `game_reviewed` event that arrives later and carries no result itself.
        if (x.result === 'loss') p.lostGames[x.gameId] = true;
        break;
      }
      case 'game_reviewed': {
        // The `seen` set above de-duplicates by event id. This guard is the
        // different question: the same game reviewed twice, by two events with
        // two ids. Both are needed.
        if (!p.gamesReviewed[x.gameId]) {
          p.gamesReviewed[x.gameId] = true;
          p.reviews += 1;
        }
        break;
      }
      case 'puzzle_attempted': {
        if (x.solved) p.puzzlesSolved += 1;
        // F-PZ-2: themed practice never moves the rating.
        // F-PZ-4: neither does a solve that came after a hint.
        const counts = x.source !== 'themed' && !(x.solved && x.hinted);
        if (counts) {
          p.puzzleRating = nextRating(p.puzzleRating, x.puzzleRating, x.solved);
        }
        break;
      }
      default:
        break;
    }
  }
  return p;
}

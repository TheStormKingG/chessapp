import type { LearnerEvent } from '@/data/events';
import { SECTIONS } from '@/path/curriculum';
import { MILESTONES } from './streak';

/**
 * F-EN-5, verbatim:
 *
 * > "Achievements. Tied to demonstrated skill and effort, never to volume alone.
 * > Examples: first checkpoint, first game with no hanging pieces, first
 * > back-rank mate delivered in a game, ten reviewed losses, a full section, a
 * > 30-day streak. Displayed in a showcase on the profile."
 *
 * ── THE RULE IS A CONSTRAINT, NOT A THEME ────────────────────────────────────
 *
 * "Never to volume alone" is the only binding sentence; the six examples are
 * examples. So every entry below declares its `basis` — `'skill'` (the learner
 * did something correctly that they could have done wrongly) or `'effort'` (the
 * learner did something deliberately costly that the app cannot fake for them) —
 * and `achievements.test.ts` holds the constraint with a test that no amount of
 * activity unlocks anything on its own: fifty finished games, two hundred failed
 * puzzles and a hundred failed checkpoints unlock nothing at all.
 *
 * "Ten reviewed losses" is in F-EN-5's own list and looks like a count. It is an
 * effort achievement, not a volume one, and the distinction is what the test
 * checks: reviewing a LOSS is the specific thing learners avoid, and the counter
 * ignores every other game — a hundred reviewed wins never move it.
 *
 * ── TWO OF F-EN-5'S EXAMPLES CANNOT BE PROJECTED, AND SAY SO ─────────────────
 *
 * Both are declared with a `blocked` reason and are never unlocked, the same
 * pattern `quests.ts` uses for F-EN-3's pool. A list with the awkward entries
 * quietly dropped cannot be told from a list someone mis-transcribed:
 *
 *   - "first game with no hanging pieces" needs the per-move classification, and
 *     the `hung_piece` theme lives on `ErrorEntry` rows in the `errors` Dexie
 *     table (`review/errorLog.ts`), not in the event log. `game_reviewed` carries
 *     accuracy, blunder and mistake counts and no theme breakdown. Putting a
 *     hanging-piece count on that event is what would make this projectable.
 *
 *   - "first back-rank mate delivered in a game" needs a mate-pattern classifier
 *     over the final position of a won game. `game_finished` does carry the PGN,
 *     so the data is there — but naming the pattern correctly is a rules query of
 *     exactly the kind this project has repeatedly got subtly wrong (a defended
 *     piece is not reachable by a move; a pawn's capture squares are not among
 *     its legal moves), and an achievement that fires on the wrong mates is worse
 *     than one that is absent. It waits for a classifier with its own tests.
 *
 * `clean-game` is NOT a rename of the hanging-pieces example. It is a separate,
 * fully projectable skill achievement — a reviewed game with no blunders and no
 * mistakes — and it is here because F-EN-5's list is explicitly examples and its
 * rule admits it.
 */

export type AchievementId =
  | 'first-checkpoint'
  | 'clean-game'
  | 'no-hanging-pieces'
  | 'back-rank-mate'
  | 'ten-reviewed-losses'
  | 'full-section'
  | 'thirty-day-streak';

/** F-EN-5's "ten reviewed losses". */
export const REVIEWED_LOSSES_TARGET = 10;

/**
 * F-EN-5's "a 30-day streak", taken from F-EN-1's own milestone list rather than
 * written again, so the two cannot drift apart.
 */
export const STREAK_ACHIEVEMENT_DAYS = MILESTONES[3];

/** What one day of the log adds to the running totals an achievement reads. */
export interface AchievementTotals {
  checkpointsPassed: number;
  cleanReviewedGames: number;
  reviewedLosses: number;
  sectionsComplete: number;
  /** The longest streak the learner has ever had — `Streak.bestDays`. */
  bestStreakDays: number;
}

interface AchievementCommon {
  id: AchievementId;
  title: string;
  /** What the learner reads under the title. */
  detail: string;
  basis: 'skill' | 'effort';
}

/**
 * A DISCRIMINATED UNION, not one shape with a `blocked` flag beside a `progress`
 * function.
 *
 * The earlier shape had both: a `blocked` string AND a `progress` that returned 0.
 * Either one on its own prevented the entry unlocking, so removing either left
 * every test passing — two guards for one rule, and neither distinguishable from
 * its own absence. Here a blocked entry has no `progress` and no `target`, so
 * there is nothing for the walk to evaluate and no second place for the rule to
 * live. A future blocked entry cannot acquire a predicate that quietly fires.
 */
export type AchievementDefinition =
  | (AchievementCommon & { blocked: null; target: number; progress: (t: AchievementTotals) => number })
  | (AchievementCommon & { blocked: string });

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first-checkpoint',
    title: 'First checkpoint',
    detail: 'Passed a unit checkpoint on positions you had not seen.',
    basis: 'skill',
    target: 1,
    progress: (t) => t.checkpointsPassed,
    blocked: null,
  },
  {
    id: 'clean-game',
    title: 'A clean game',
    detail: 'Played a game the review found no blunders and no mistakes in.',
    basis: 'skill',
    target: 1,
    progress: (t) => t.cleanReviewedGames,
    blocked: null,
  },
  {
    id: 'no-hanging-pieces',
    title: 'Nothing left hanging',
    detail: 'Played a game without leaving a piece to be taken.',
    basis: 'skill',
    blocked:
      'the hung_piece classification lives on ErrorEntry rows in Dexie, not on any event; game_reviewed carries no theme breakdown',
  },
  {
    id: 'back-rank-mate',
    title: 'Back-rank mate',
    detail: 'Delivered a back-rank mate in a game.',
    basis: 'skill',
    blocked: 'needs a mate-pattern classifier over the final position of a won game; none exists yet',
  },
  {
    id: 'ten-reviewed-losses',
    title: 'Ten losses reviewed',
    detail: 'Went back through ten games you lost. This is where the improvement is.',
    basis: 'effort',
    target: REVIEWED_LOSSES_TARGET,
    progress: (t) => t.reviewedLosses,
    blocked: null,
  },
  {
    id: 'full-section',
    title: 'A section finished',
    detail: 'Passed every checkpoint in a section of the path.',
    basis: 'skill',
    target: 1,
    progress: (t) => t.sectionsComplete,
    blocked: null,
  },
  {
    id: 'thirty-day-streak',
    title: 'Thirty days',
    detail: 'Came back and did something on thirty days in a row.',
    basis: 'effort',
    target: STREAK_ACHIEVEMENT_DAYS,
    progress: (t) => t.bestStreakDays,
    blocked: null,
  },
];

export interface Achievement {
  id: AchievementId;
  title: string;
  detail: string;
  basis: 'skill' | 'effort';
  /** 1 for a blocked entry, which has no scale of its own. */
  target: number;
  progress: number;
  unlocked: boolean;
  /** Why this can never be earned in this build, or null. F-EN-5's two examples. */
  blocked: string | null;
  /**
   * The local day it was first earned, or null.
   *
   * Null for `thirty-day-streak` even when it is unlocked: the streak ledger
   * keeps the best LENGTH a run reached and not the calendar day it reached it,
   * so there is no day to name. Stated here rather than filled with today's date,
   * which would move every time the showcase is opened.
   */
  unlockedOn: string | null;
}

export interface AchievementInput {
  events: readonly LearnerEvent[];
  /** `Streak.bestDays`. Passed in rather than recomputed so there is one streak walk. */
  bestStreakDays: number;
}

/**
 * The achievement showcase (F-EN-5), as a projection of the log.
 *
 * Walks the log in day order so the day each achievement was first earned can be
 * recorded. Once unlocked, an achievement stays unlocked: the walk never
 * decrements, and `unlockedOn` is written once.
 */
export function achievementsFrom(input: AchievementInput): Achievement[] {
  const totals: AchievementTotals = {
    checkpointsPassed: 0,
    cleanReviewedGames: 0,
    reviewedLosses: 0,
    sectionsComplete: 0,
    bestStreakDays: input.bestStreakDays,
  };
  const unlockedOn = new Map<AchievementId, string>();
  const reviewed = new Set<string>();
  const lost = new Set<string>();
  const passedUnits = new Set<string>();

  const record = (day: string) => {
    for (const a of ACHIEVEMENTS) {
      if (a.blocked !== null || unlockedOn.has(a.id)) continue;
      if (a.progress(totals) >= a.target) unlockedOn.set(a.id, day);
    }
    // `a.blocked !== null` above is the TYPE narrowing that gives access to
    // `progress`; it is not a second gate. A blocked entry has no predicate.
  };

  // By `createdAt`, because an achievement's day must respect the order things
  // happened in: a review banked before its own game finished would otherwise be
  // counted against a result the log did not yet hold.
  for (const e of [...input.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const x = e.payload;
    if (x.type === 'game_finished' && x.result === 'loss') lost.add(x.gameId);
    else if (x.type === 'checkpoint_attempted' && x.passed) {
      // Counted per UNIT, not per attempt: three passes of one checkpoint are one
      // checkpoint passed. Derived from the set's SIZE rather than incremented
      // behind an `if (!has(...))` guard — an independent counter plus a guard is
      // two representations of one fact, and the guard was untestable because
      // nothing reads the counter except through a target of 1.
      //
      // `unit_tested_out` is deliberately not counted: the onboarding placement
      // appends one per unit below the placement point, and an achievement handed
      // out for units the learner never sat is the exact "volume alone" failure
      // F-EN-5 forbids.
      passedUnits.add(x.unit);
      totals.checkpointsPassed = passedUnits.size;
      totals.sectionsComplete = countCompleteSections(passedUnits);
    } else if (x.type === 'game_reviewed' && !reviewed.has(x.gameId)) {
      reviewed.add(x.gameId);
      if (lost.has(x.gameId)) totals.reviewedLosses += 1;
      if (x.blunders === 0 && x.mistakes === 0) totals.cleanReviewedGames += 1;
    } else {
      continue;
    }
    record(e.deviceDay);
  }

  // The streak achievement is not driven by an event, so it is settled after the
  // walk and carries no day. See `Achievement.unlockedOn`.
  return ACHIEVEMENTS.map((a) => {
    if (a.blocked !== null) {
      return {
        id: a.id,
        title: a.title,
        detail: a.detail,
        basis: a.basis,
        target: 1,
        progress: 0,
        unlocked: false,
        blocked: a.blocked,
        unlockedOn: null,
      };
    }
    const progress = Math.min(a.target, a.progress(totals));
    return {
      id: a.id,
      title: a.title,
      detail: a.detail,
      basis: a.basis,
      target: a.target,
      progress,
      unlocked: progress >= a.target,
      blocked: null,
      unlockedOn: unlockedOn.get(a.id) ?? null,
    };
  });
}

/**
 * How many whole sections of the path have every one of their units passed.
 *
 * Every unit, including ones whose content is not authored yet (`built: false`),
 * because a section is not finished while part of it does not exist. The
 * consequence is that Sections 3 and 4 cannot be completed until their content
 * lands, which is correct rather than a limitation to work around.
 */
function countCompleteSections(passedUnits: ReadonlySet<string>): number {
  return SECTIONS.filter((s) => s.units.length > 0 && s.units.every((u) => passedUnits.has(u.id))).length;
}

/** The unlocked ones, for the showcase. F-EN-5: "displayed in a showcase on the profile". */
export function unlockedAchievements(all: readonly Achievement[]): Achievement[] {
  return all.filter((a) => a.unlocked);
}

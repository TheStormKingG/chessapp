import type { LearnerEvent } from '@/data/events';
import type { DailyGoal } from '@/onboarding/types';
import { dayToUtcNoon, daysBetween, shiftDay } from '@/tailored/schedule';
import { PUZZLES_IN_A_SET } from './qualifying';
import { xpByDay } from './xp';

/**
 * F-EN-3, verbatim:
 *
 * > "Three daily quests drawn from a pool (review a game, solve five 'fix my
 * > mistakes' puzzles, finish a lesson, play a 15+10 game, earn 50 XP), each
 * > paying a small reward (an XP boost for 15 minutes or a cosmetic). Completing
 * > all three pays a bonus. One weekly quest, complete five daily plans in the
 * > week, pays a streak freeze."
 *
 * ── THE POOL IS WRITTEN OUT IN FULL, INCLUDING WHAT CANNOT BE BUILT ──────────
 *
 * All five of F-EN-3's pool entries are declared below. Two of them cannot be
 * answered from this app's event log as written, and rather than drop them the
 * entry carries the reason, and `drawableQuests()` filters on it. A pool with
 * three entries and no explanation is indistinguishable from a pool someone
 * mis-transcribed:
 *
 *   - "play a 15+10 game" is BLOCKED. The app has two time controls, `'untimed'`
 *     and `'10+0'` (`data/events.ts`, `play/GameMachine.ts`); 15+10 does not
 *     exist, so no log can ever satisfy this quest. It is not drawn.
 *
 *   - "solve five 'fix my mistakes' puzzles" ships with a stated DEVIATION. The
 *     `'fix'` puzzle source is declared in `EventPayload` and never emitted:
 *     the fix-it drill (`review/fixIt.ts`) is built as a Lesson and played
 *     through the lesson machine, so it appends `challenge_attempted`, not
 *     `puzzle_attempted`. The quest therefore counts any five solved puzzles. It
 *     is drawn, and the deviation is on the entry.
 *
 * ── WHY THE REWARD IS A COSMETIC AND NOT AN XP BOOST ─────────────────────────
 *
 * F-EN-3 offers a choice ("an XP boost for 15 minutes OR a cosmetic") and this
 * takes the cosmetic, for a structural reason. A timed multiplier makes XP depend
 * on WHEN an event was appended relative to a boost window, so the total would
 * stop being a function of the log and a replay would produce a different number
 * from the live fold — the property `data/reduce.ts` is built on. The bonus for
 * completing all three is a cosmetic credit too, for the same reason.
 *
 * Quest completion therefore pays `questCredits`, which `cosmetics.ts` spends.
 *
 * ── THE WEEKLY QUEST, AND THE ONE THING IT LEANS ON THAT IS NOT BUILT ────────
 *
 * "Complete five daily plans in the week". There is no daily plan: PRD 8.2's
 * F-HM-2 owns it and nothing in `src/` presents one — `onboarding/signup.ts` says
 * the same about F-ON-7's first occasion. So `dailyPlanDays` evaluates F-HM-2's
 * OWN ITEM LIST against the log instead of reading a plan object:
 *
 * > "The daily plan contains one lesson ..., a set of five puzzles ..., one game
 * > item and its review. ... A 5-minute goal shows the lesson and puzzles only,
 * > with the game offered as an extra. ... A game that runs past the goal still
 * > completes the plan, and an untimed game satisfies the game item."
 *
 * That is a projection of the plan's CONTENTS, not a record that a plan was
 * presented and finished, and the difference matters in one direction: a learner
 * who did all four things without ever seeing a plan is credited. The 20-minute
 * goal's extra story game is NOT required, because story games do not exist
 * (`xp.ts` says the same about their rate). When F-HM-2 lands, this function must
 * be replaced by the plan's own completion record and this comment deleted.
 */

export type DailyQuestId =
  | 'review-a-game'
  | 'five-fix-puzzles'
  | 'finish-a-lesson'
  | 'play-a-15-10-game'
  | 'earn-50-xp';

/** F-EN-3's "earn 50 XP". */
export const QUEST_XP_TARGET = 50;

/** F-EN-3's "three daily quests". */
export const DAILY_QUESTS = 3;

/** F-EN-3's "complete five daily plans in the week". */
export const PLANS_PER_WEEKLY_QUEST = 5;

/** What one day's events add up to, for the quests that count something. */
export interface DayCounts {
  lessons: number;
  reviews: number;
  puzzlesSolved: number;
  puzzleAttempts: number;
  gamesFinished: number;
  xp: number;
}

export interface DailyQuestDefinition {
  id: DailyQuestId;
  /** F-EN-3's own words for this pool entry, so the deviation is readable against it. */
  spec: string;
  /** What the learner reads. */
  title: string;
  target: number;
  progress: (c: DayCounts) => number;
  /** Non-null means the log can never answer this quest; it is not drawn. */
  blocked: string | null;
  /** Non-null means it is drawn, but measures something slightly different. */
  deviation: string | null;
}

/** F-EN-3's pool, in F-EN-3's order. */
export const QUEST_POOL: readonly DailyQuestDefinition[] = [
  {
    id: 'review-a-game',
    spec: 'review a game',
    title: 'Review a game',
    target: 1,
    progress: (c) => c.reviews,
    blocked: null,
    deviation: null,
  },
  {
    id: 'five-fix-puzzles',
    spec: "solve five 'fix my mistakes' puzzles",
    title: 'Solve five puzzles',
    target: PUZZLES_IN_A_SET,
    progress: (c) => c.puzzlesSolved,
    blocked: null,
    deviation:
      "the 'fix' puzzle source is never emitted — the fix-it drill is played as a lesson — so this counts any five solved puzzles",
  },
  {
    id: 'finish-a-lesson',
    spec: 'finish a lesson',
    title: 'Finish a lesson',
    target: 1,
    progress: (c) => c.lessons,
    blocked: null,
    deviation: null,
  },
  {
    id: 'play-a-15-10-game',
    spec: 'play a 15+10 game',
    title: 'Play a 15+10 game',
    target: 1,
    // Reachable only if a 15+10 control is ever added; it counts finished games
    // so that the arm is not a `throw` waiting to be hit.
    progress: (c) => c.gamesFinished,
    blocked: "the app has no 15+10 time control — only 'untimed' and '10+0' exist",
    deviation: null,
  },
  {
    id: 'earn-50-xp',
    spec: 'earn 50 XP',
    title: 'Earn 50 XP',
    target: QUEST_XP_TARGET,
    progress: (c) => c.xp,
    blocked: null,
    deviation: null,
  },
];

/** The pool entries the event log can actually answer, in pool order. */
export function drawableQuests(): DailyQuestDefinition[] {
  return QUEST_POOL.filter((q) => q.blocked === null);
}

export interface DailyQuest {
  id: DailyQuestId;
  title: string;
  target: number;
  progress: number;
  done: boolean;
}

export interface DayQuests {
  day: string;
  quests: DailyQuest[];
  /** F-EN-3's "completing all three pays a bonus". */
  allThreeDone: boolean;
}

function zeroCounts(): DayCounts {
  return { lessons: 0, reviews: 0, puzzlesSolved: 0, puzzleAttempts: 0, gamesFinished: 0, xp: 0 };
}

/**
 * Every day's counts, in ONE pass over the log.
 *
 * One pass rather than one pass per day: `questCredits` and `dailyPlanDays` both
 * ask about every day the log mentions, and a per-day scan that also called
 * `xpByDay` (itself a whole-log walk) made the cost quadratic in the log — which
 * is paid on a screen that renders on every navigation.
 */
export function countsByDay(events: readonly LearnerEvent[]): Map<string, DayCounts> {
  const byDay = new Map<string, DayCounts>();
  const reviewed = new Set<string>();
  const get = (day: string) => {
    const c = byDay.get(day) ?? zeroCounts();
    byDay.set(day, c);
    return c;
  };
  for (const e of events) {
    const c = get(e.deviceDay);
    const x = e.payload;
    if (x.type === 'lesson_completed') c.lessons += 1;
    else if (x.type === 'game_reviewed') {
      // One review per game, matching the projection: re-opening the review
      // route must not tick the quest twice.
      if (!reviewed.has(x.gameId)) {
        reviewed.add(x.gameId);
        c.reviews += 1;
      }
    } else if (x.type === 'game_finished') c.gamesFinished += 1;
    else if (x.type === 'puzzle_attempted') {
      c.puzzleAttempts += 1;
      if (x.solved) c.puzzlesSolved += 1;
    }
  }
  for (const [day, xp] of xpByDay(events)) get(day).xp = xp;
  return byDay;
}

/** One day's counts. */
export function countsFor(events: readonly LearnerEvent[], day: string): DayCounts {
  return countsByDay(events).get(day) ?? zeroCounts();
}

/**
 * Which three of the drawable pool a day gets.
 *
 * Deterministic in the day string, so the same day always draws the same three
 * — a random draw would hand a learner a different set on every reload and lose a
 * quest they had already half finished. The rotation is the day's ordinal
 * modulo the pool size, which walks the pool one step a day and so gives every
 * entry a turn rather than favouring the first three.
 */
export function drawFor(day: string): DailyQuestDefinition[] {
  const pool = drawableQuests();
  if (pool.length <= DAILY_QUESTS) return pool;
  // Days since the Unix epoch: a stable, monotone ordinal for a `YYYY-MM-DD`.
  const ordinal = daysBetween('1970-01-01', day);
  const start = ((ordinal % pool.length) + pool.length) % pool.length;
  return Array.from({ length: DAILY_QUESTS }, (_, i) => pool[(start + i) % pool.length]).filter(
    (q): q is DailyQuestDefinition => q !== undefined,
  );
}

export function questsOn(events: readonly LearnerEvent[], day: string): DayQuests {
  return questsFromCounts(countsFor(events, day), day);
}

function questsFromCounts(counts: DayCounts, day: string): DayQuests {
  const quests = drawFor(day).map((d) => {
    const progress = Math.min(d.target, d.progress(counts));
    return { id: d.id, title: d.title, target: d.target, progress, done: progress >= d.target };
  });
  return { day, quests, allThreeDone: quests.length > 0 && quests.every((q) => q.done) };
}

/**
 * F-EN-3's rewards, as a running count of credits the cosmetics catalogue spends.
 *
 * One credit per completed daily quest, plus one bonus credit for a day on which
 * all three were completed. Counted over every day the log mentions up to and
 * including `today`, because a reward earned on Tuesday is still held on Friday.
 */
export function questCredits(events: readonly LearnerEvent[], today: string): number {
  let credits = 0;
  for (const [day, counts] of countsByDay(events)) {
    if (daysBetween(day, today) < 0) continue;
    const q = questsFromCounts(counts, day);
    credits += q.quests.filter((x) => x.done).length;
    if (q.allThreeDone) credits += 1;
  }
  return credits;
}

/**
 * The days on which F-HM-2's plan items were all completed. See the header for
 * exactly what this projects and what it does not.
 *
 * At a 5-minute goal the plan is "the lesson and puzzles only", so the game item
 * and its review are not required. At every other goal all four are.
 */
export function dailyPlanDays(events: readonly LearnerEvent[], goal: DailyGoal): string[] {
  const needsGame = goal > 5;
  const out: string[] = [];
  for (const [day, c] of countsByDay(events)) {
    const done =
      c.lessons >= 1 && c.puzzleAttempts >= PUZZLES_IN_A_SET && (!needsGame || (c.gamesFinished >= 1 && c.reviews >= 1));
    if (done) out.push(day);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * The Monday of the calendar week a day falls in, as the week's key.
 *
 * A CALENDAR week and not the rolling seven days `tailored/schedule.ts` uses,
 * because this window pays a reward: a rolling window would pay a freeze again
 * every day the fifth plan stayed inside it, and "one weekly quest" means one.
 * Monday-based, so a weekend's work belongs to the week it felt like.
 */
export function weekKey(day: string): string {
  // `dayToUtcNoon` is why this is read at noon rather than midnight: see the
  // import comment in `streak.ts`. getUTCDay puts Sunday at 0, so the
  // Monday-based back-shift is (d + 6) % 7.
  const weekday = new Date(dayToUtcNoon(day)).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

export interface WeeklyQuest {
  /** The Monday of the week this describes. */
  week: string;
  /** Plans completed in that week, capped at the target. */
  progress: number;
  target: number;
  done: boolean;
  /** The day the fifth plan landed, which is the day the freeze was granted. */
  completedOn: string | null;
}

export function weeklyQuestOn(events: readonly LearnerEvent[], goal: DailyGoal, today: string): WeeklyQuest {
  const week = weekKey(today);
  const inWeek = dailyPlanDays(events, goal).filter((d) => weekKey(d) === week);
  const fifth = inWeek[PLANS_PER_WEEKLY_QUEST - 1] ?? null;
  return {
    week,
    progress: Math.min(PLANS_PER_WEEKLY_QUEST, inWeek.length),
    target: PLANS_PER_WEEKLY_QUEST,
    done: fifth !== null,
    completedOn: fifth,
  };
}

/**
 * The days a streak freeze was earned — F-EN-1's only input for a grant.
 *
 * One per calendar week at most, on the day the week's fifth plan was completed.
 * `streak.ts` applies F-EN-1's cap of two held, so this function does not: how
 * many are HELD is the streak ledger's business, and capping here as well would
 * be the same rule in two places with no way to tell which one was doing the work.
 */
export function freezeGrantDays(events: readonly LearnerEvent[], goal: DailyGoal): string[] {
  const byWeek = new Map<string, string[]>();
  for (const day of dailyPlanDays(events, goal)) {
    const key = weekKey(day);
    byWeek.set(key, [...(byWeek.get(key) ?? []), day]);
  }
  return [...byWeek.values()]
    .map((days) => days[PLANS_PER_WEEKLY_QUEST - 1])
    .filter((d): d is string => d !== undefined)
    .sort((a, b) => a.localeCompare(b));
}

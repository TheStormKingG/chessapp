import { newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import type { DailyGoal } from '@/onboarding/types';
import { shiftDay } from '@/tailored/schedule';
import {
  DAILY_QUESTS,
  PLANS_PER_WEEKLY_QUEST,
  QUEST_POOL,
  QUEST_XP_TARGET,
  countsFor,
  dailyPlanDays,
  drawFor,
  drawableQuests,
  freezeGrantDays,
  questCredits,
  questsOn,
  weekKey,
  weeklyQuestOn,
} from './quests';
import { streakOn } from './streak';
import { qualifyingDays } from './qualifying';

function ev(payload: EventPayload, day: string, hour = 12): LearnerEvent {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent(payload, new Date(y, m - 1, d, hour));
}

const lesson = (day: string, id = '1.1.1', xp = 14) =>
  ev({ type: 'lesson_completed', lessonId: id, stars: 3, xp, replay: false }, day);
const puzzles = (day: string, n: number, solved = true) =>
  Array.from({ length: n }, (_, i) =>
    ev(
      {
        type: 'puzzle_attempted',
        puzzleId: `${day}-p${String(i)}`,
        themes: ['fork'],
        puzzleRating: 1000,
        solved,
        hinted: false,
        misses: 0,
        source: 'rated',
        ms: 4000,
      },
      day,
    ),
  );
const gameAndReview = (day: string, id: string) => [
  ev({ type: 'game_started', gameId: id, persona: 'ada', color: 'w', timeControl: '10+0', coach: true }, day),
  ev({ type: 'game_finished', gameId: id, result: 'loss', moves: 30, hints: 0, takebacks: 0, crowns: 1, pgn: '' }, day),
  ev(
    { type: 'game_reviewed', gameId: id, accuracy: 60, blunders: 2, mistakes: 1, drillCompleted: true, partial: false },
    day,
  ),
];

/** Everything F-HM-2's default plan asks for, on one day. */
function planDay(day: string): LearnerEvent[] {
  return [lesson(day, '1.1.1'), ...puzzles(day, 5), ...gameAndReview(day, `g-${day}`)];
}

/* ------------------------------------------------------------------- the pool */

test('F-EN-3\'s pool is written out in full, all five entries', () => {
  expect(QUEST_POOL.map((q) => q.id)).toEqual([
    'review-a-game',
    'five-fix-puzzles',
    'finish-a-lesson',
    'play-a-15-10-game',
    'earn-50-xp',
  ]);
  expect(QUEST_POOL).toHaveLength(5);
});

test('the blocked entry is never drawn, and the reason is on the entry', () => {
  const blocked = QUEST_POOL.filter((q) => q.blocked !== null);
  expect(blocked.map((q) => q.id)).toEqual(['play-a-15-10-game']);
  expect(blocked[0]?.blocked).toMatch(/15\+10/);
  expect(drawableQuests().map((q) => q.id)).not.toContain('play-a-15-10-game');
  // Positive control: the drawable list is not empty, so "does not contain" is a
  // statement about this entry and not about an empty filter.
  expect(drawableQuests()).toHaveLength(4);
});

test('the deviating entry is drawn and says how it deviates', () => {
  const fix = QUEST_POOL.find((q) => q.id === 'five-fix-puzzles');
  expect(fix?.blocked).toBeNull();
  expect(fix?.deviation).toMatch(/fix/);
  expect(fix?.spec).toBe("solve five 'fix my mistakes' puzzles");
  expect(drawableQuests().map((q) => q.id)).toContain('five-fix-puzzles');
});

test('three quests are drawn, deterministically, and the draw rotates through the pool', () => {
  expect(drawFor('2026-04-01')).toHaveLength(DAILY_QUESTS);
  expect(drawFor('2026-04-01').map((q) => q.id)).toEqual(drawFor('2026-04-01').map((q) => q.id));
  // Four drawable entries and three drawn, so consecutive days differ and every
  // entry gets a turn inside four days.
  const week = [0, 1, 2, 3].map((i) => drawFor(shiftDay('2026-04-01', i)).map((q) => q.id));
  expect(new Set(week.map((ids) => ids.join(','))).size).toBe(4);
  expect(new Set(week.flat())).toEqual(new Set(drawableQuests().map((q) => q.id)));
});

/* ---------------------------------------------------------- a day's progress */

test('a quest is done when the day\'s count reaches its target, and progress is capped', () => {
  const day = '2026-04-02';
  const events = [...puzzles(day, 7)];
  const q = questsOn(events, day).quests.find((x) => x.id === 'five-fix-puzzles');
  expect(q).toBeDefined();
  expect(q?.progress).toBe(5);
  expect(q?.done).toBe(true);
  // Four is not five.
  const four = questsOn(puzzles(day, 4), day).quests.find((x) => x.id === 'five-fix-puzzles');
  expect(four?.progress).toBe(4);
  expect(four?.done).toBe(false);
});

test('an unsolved puzzle does not count toward the solve-five quest', () => {
  const day = '2026-04-02';
  const unsolved = questsOn(puzzles(day, 5, false), day).quests.find((x) => x.id === 'five-fix-puzzles');
  expect(unsolved?.progress).toBe(0);
  // Positive control: the same five, solved, do count — so the zero is about
  // `solved` and not about the day or the draw.
  expect(questsOn(puzzles(day, 5, true), day).quests.find((x) => x.id === 'five-fix-puzzles')?.progress).toBe(5);
});

test('the XP quest reads the day\'s XP and not the running total', () => {
  const day = '2026-04-03';
  const yesterday = shiftDay(day, -1);
  // Plenty of XP yesterday, none today.
  const events = [...planDay(yesterday), ...planDay(yesterday).map(() => lesson(yesterday, '1.1.2'))];
  expect(countsFor(events, yesterday).xp).toBeGreaterThan(QUEST_XP_TARGET);
  expect(countsFor(events, day).xp).toBe(0);
});

test('a re-review of the same game does not tick the review quest twice', () => {
  const day = '2026-04-04';
  const review = () =>
    ev(
      { type: 'game_reviewed', gameId: 'g1', accuracy: 60, blunders: 0, mistakes: 0, drillCompleted: false, partial: false },
      day,
    );
  expect(countsFor([review(), review()], day).reviews).toBe(1);
  // Two different games do count twice, which is the control for the guard above.
  const other = ev(
    { type: 'game_reviewed', gameId: 'g2', accuracy: 60, blunders: 0, mistakes: 0, drillCompleted: false, partial: false },
    day,
  );
  expect(countsFor([review(), other], day).reviews).toBe(2);
});

test('completing all three pays a bonus credit on top of the three', () => {
  // A day whose draw is satisfied in full. Built by doing everything, then
  // checked against the draw for that day rather than assumed.
  const day = '2026-04-06';
  const events = [...planDay(day), lesson(day, '1.1.2'), ...puzzles(day, 6)];
  const q = questsOn(events, day);
  expect(q.quests.every((x) => x.done)).toBe(true);
  expect(q.allThreeDone).toBe(true);
  expect(questCredits(events, day)).toBe(DAILY_QUESTS + 1);
});

test('a day with one quest done pays one credit and no bonus', () => {
  const day = '2026-04-06';
  const events = [lesson(day)];
  const q = questsOn(events, day);
  const done = q.quests.filter((x) => x.done);
  expect(q.allThreeDone).toBe(false);
  expect(questCredits(events, day)).toBe(done.length);
  expect(done.length).toBeLessThan(DAILY_QUESTS);
});

test('credits are cumulative over days and ignore days after today', () => {
  const a = '2026-04-06';
  const b = '2026-04-07';
  const events = [lesson(a), lesson(b)];
  const both = questCredits(events, b);
  const onlyFirst = questCredits(events, a);
  expect(both).toBeGreaterThan(onlyFirst);
  expect(onlyFirst).toBeGreaterThan(0);
});

test('no quests are done on an empty log', () => {
  expect(questsOn([], '2026-04-06').quests.every((q) => !q.done)).toBe(true);
  expect(questsOn([], '2026-04-06').allThreeDone).toBe(false);
  expect(questCredits([], '2026-04-06')).toBe(0);
});

/* ------------------------------------------------- the weekly quest and freezes */

test('a day counts as a plan only when every one of F-HM-2\'s items is done', () => {
  const day = '2026-04-06';
  const full = planDay(day);
  expect(dailyPlanDays(full, 10)).toEqual([day]);
  // Each item removed in turn: the day stops counting. This is what makes the
  // conjunction real rather than a check on the first item.
  expect(dailyPlanDays(full.filter((e) => e.payload.type !== 'lesson_completed'), 10)).toEqual([]);
  expect(dailyPlanDays(full.filter((e) => e.payload.type !== 'puzzle_attempted'), 10)).toEqual([]);
  expect(dailyPlanDays(full.filter((e) => e.payload.type !== 'game_finished'), 10)).toEqual([]);
  expect(dailyPlanDays(full.filter((e) => e.payload.type !== 'game_reviewed'), 10)).toEqual([]);
});

test('a five-minute goal\'s plan is the lesson and puzzles only', () => {
  const day = '2026-04-06';
  const lessonAndPuzzles = [lesson(day), ...puzzles(day, 5)];
  expect(dailyPlanDays(lessonAndPuzzles, 5)).toEqual([day]);
  // The same day is NOT a plan at any longer goal, which is the whole of the
  // difference the goal makes.
  for (const goal of [10, 15, 20] as DailyGoal[]) {
    expect(dailyPlanDays(lessonAndPuzzles, goal)).toEqual([]);
  }
});

test('the weekly quest completes on the fifth plan of the calendar week', () => {
  // Monday 6 April 2026 to Friday 10 April 2026.
  const days = [0, 1, 2, 3, 4].map((i) => shiftDay('2026-04-06', i));
  const events = days.flatMap(planDay);
  const onThursday = weeklyQuestOn(events.filter((e) => e.deviceDay <= days[3]!), 10, days[3]!);
  expect(onThursday.progress).toBe(4);
  expect(onThursday.done).toBe(false);
  const onFriday = weeklyQuestOn(events, 10, days[4]!);
  expect(onFriday.progress).toBe(PLANS_PER_WEEKLY_QUEST);
  expect(onFriday.done).toBe(true);
  expect(onFriday.completedOn).toBe(days[4]);
  expect(onFriday.week).toBe('2026-04-06');
});

test('five plans spread across two calendar weeks complete neither week', () => {
  // Thursday and Friday of one week, Monday to Wednesday of the next.
  const split = ['2026-04-02', '2026-04-03', '2026-04-06', '2026-04-07', '2026-04-08'];
  const events = split.flatMap(planDay);
  expect(dailyPlanDays(events, 10)).toHaveLength(5);
  expect(weeklyQuestOn(events, 10, '2026-04-03').done).toBe(false);
  expect(weeklyQuestOn(events, 10, '2026-04-08').done).toBe(false);
  expect(freezeGrantDays(events, 10)).toEqual([]);
  // Positive control: five in ONE week does grant, so the empty list above is
  // about the split.
  const oneWeek = [0, 1, 2, 3, 4].map((i) => shiftDay('2026-04-06', i)).flatMap(planDay);
  expect(freezeGrantDays(oneWeek, 10)).toEqual(['2026-04-10']);
});

test('one freeze a week at most, however many plans the week holds', () => {
  const events = [0, 1, 2, 3, 4, 5, 6].map((i) => shiftDay('2026-04-06', i)).flatMap(planDay);
  expect(dailyPlanDays(events, 10)).toHaveLength(7);
  expect(freezeGrantDays(events, 10)).toEqual(['2026-04-10']);
});

test('two weeks of five plans grant two freezes, on the fifth day of each', () => {
  const week1 = [0, 1, 2, 3, 4].map((i) => shiftDay('2026-04-06', i)).flatMap(planDay);
  const week2 = [0, 1, 2, 3, 4].map((i) => shiftDay('2026-04-13', i)).flatMap(planDay);
  expect(freezeGrantDays([...week1, ...week2], 10)).toEqual(['2026-04-10', '2026-04-17']);
});

test('weekKey is the Monday of the week, including for a Sunday', () => {
  expect(weekKey('2026-04-06')).toBe('2026-04-06'); // Monday
  expect(weekKey('2026-04-12')).toBe('2026-04-06'); // Sunday of the same week
  expect(weekKey('2026-04-13')).toBe('2026-04-13'); // the next Monday
  // A Sunday must not key to the week starting the next day, which is what a
  // getUTCDay-based shift gets wrong without the (d + 6) % 7 correction.
  expect(weekKey('2026-04-12')).not.toBe('2026-04-13');
});

test('the freeze the weekly quest grants is the freeze the streak spends', () => {
  /*
   * The join between F-EN-3 and F-EN-1, end to end: a week of five plans grants a
   * freeze, and the freeze covers a missed day that would otherwise have started
   * the grace period. Without this the two modules could each be right about
   * their own half and disagree about the day.
   */
  const events = [0, 1, 2, 3, 4].map((i) => shiftDay('2026-04-06', i)).flatMap(planDay);
  const grants = freezeGrantDays(events, 10);
  const days = qualifyingDays(events);
  expect(grants).toEqual(['2026-04-10']);

  // Saturday the 11th is missed. On Sunday the 12th the streak is intact and the
  // freeze is gone.
  const withFreeze = streakOn({ qualifyingDays: days, freezeGrantDays: grants, today: '2026-04-12' });
  expect(withFreeze.days).toBe(5);
  expect(withFreeze.freezesSpentOn).toEqual(['2026-04-11']);
  expect(withFreeze.graceDaysUsed).toBe(0);

  // Without the grant the same log is paused, which is the control that the
  // freeze is what did the work.
  const without = streakOn({ qualifyingDays: days, freezeGrantDays: [], today: '2026-04-12' });
  expect(without.status).toBe('paused');
  expect(without.graceDaysUsed).toBe(1);
});

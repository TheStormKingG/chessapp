import { newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import { shiftDay } from '@/tailored/schedule';
import { emptyEngagement, engagementFrom } from './state';

/**
 * The composition, not the parts. Each module is tested on its own; these tests
 * exist because the ORDER in `state.ts` is a claim — the streak needs the weekly
 * quest's freezes, the achievements need the streak's best length, the cosmetics
 * need the achievements — and an order that was wrong would leave every
 * individual module's tests passing.
 */

function ev(payload: EventPayload, day: string, hour = 12, minute = 0): LearnerEvent {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent(payload, new Date(y, m - 1, d, hour, minute));
}

/** Everything F-HM-2's default plan asks for, on one day. */
function planDay(day: string): LearnerEvent[] {
  return [
    ev({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 14, replay: false }, day),
    ...Array.from({ length: 5 }, (_, i) =>
      ev(
        {
          type: 'puzzle_attempted',
          puzzleId: `${day}-p${String(i)}`,
          themes: ['fork'],
          puzzleRating: 1000,
          solved: true,
          hinted: false,
          misses: 0,
          source: 'rated',
          ms: 4000,
        },
        day,
        12,
        i,
      ),
    ),
    ev({ type: 'game_started', gameId: `g-${day}`, persona: 'ada', color: 'w', timeControl: '10+0', coach: true }, day, 13),
    ev(
      { type: 'game_finished', gameId: `g-${day}`, result: 'loss', moves: 30, hints: 0, takebacks: 0, crowns: 1, pgn: '' },
      day,
      13,
      10,
    ),
    ev(
      {
        type: 'game_reviewed',
        gameId: `g-${day}`,
        accuracy: 70,
        blunders: 0,
        mistakes: 0,
        drillCompleted: true,
        partial: false,
      },
      day,
      13,
      20,
    ),
  ];
}

function at(day: string, hour = 20): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour);
}

test('the freeze the weekly quest grants reaches the streak, through the composition', () => {
  // Monday to Friday of one week: five plans, so a freeze. Saturday is missed.
  const week = [0, 1, 2, 3, 4].map((i) => shiftDay('2026-04-06', i)).flatMap(planDay);
  const sunday = engagementFrom(week, 10, at('2026-04-12'));
  expect(sunday.weekly.done).toBe(true);
  expect(sunday.streak.days).toBe(5);
  expect(sunday.streak.freezesSpentOn).toEqual(['2026-04-11']);
  expect(sunday.streak.graceDaysUsed).toBe(0);
});

test('the achievements see the streak the streak walk produced', () => {
  const days = Array.from({ length: 30 }, (_, i) => shiftDay('2026-04-01', i));
  const events = days.flatMap(planDay);
  const e = engagementFrom(events, 10, at(days[29] ?? '2026-04-30'));
  expect(e.streak.days).toBe(30);
  expect(e.achievements.find((a) => a.id === 'thirty-day-streak')?.unlocked).toBe(true);
  // A shorter run does not, so the line above is reading the streak rather than
  // always unlocking.
  const short = engagementFrom(planDay('2026-04-01'), 10, at('2026-04-01'));
  expect(short.achievements.find((a) => a.id === 'thirty-day-streak')?.unlocked).toBe(false);
});

test('the cosmetics see the achievements the achievement walk produced', () => {
  const events = [
    ...planDay('2026-04-06'),
    ev({ type: 'checkpoint_attempted', unit: '1.1', score: 0.9, passed: true, attempt: 1, missedConcepts: [] }, '2026-04-06', 14),
  ];
  const e = engagementFrom(events, 10, at('2026-04-06'));
  expect(e.achievements.find((a) => a.id === 'first-checkpoint')?.unlocked).toBe(true);
  expect(e.cosmetics.map((c) => c.id)).toContain('board-slate');
  // Without the checkpoint, the same day does not hold that board.
  const without = engagementFrom(planDay('2026-04-06'), 10, at('2026-04-06'));
  expect(without.cosmetics.map((c) => c.id)).not.toContain('board-slate');
  // Positive control for the exclusion: the free entries ARE there, so the list
  // is not simply empty.
  expect(without.cosmetics.map((c) => c.id)).toContain('board-stone');
});

test('the day is the device\'s local day at the time the projection is taken', () => {
  const e = engagementFrom(planDay('2026-04-06'), 10, new Date(2026, 3, 6, 23, 59));
  expect(e.today).toBe('2026-04-06');
  expect(e.doneToday.length).toBeGreaterThan(0);
  // Ten minutes later is the next local day, and nothing has been done on it.
  const after = engagementFrom(planDay('2026-04-06'), 10, new Date(2026, 3, 7, 0, 9));
  expect(after.today).toBe('2026-04-07');
  expect(after.doneToday).toEqual([]);
  expect(after.streak.status).toBe('at-risk');
});

test('the goal changes what counts as a plan, and therefore the freeze', () => {
  // Five days of lesson-and-puzzles only: a plan at a 5-minute goal, not at 10.
  const week = [0, 1, 2, 3, 4]
    .map((i) => shiftDay('2026-04-06', i))
    .flatMap((day) => planDay(day).filter((e) => e.payload.type === 'lesson_completed' || e.payload.type === 'puzzle_attempted'));
  expect(engagementFrom(week, 5, at('2026-04-10')).weekly.done).toBe(true);
  expect(engagementFrom(week, 10, at('2026-04-10')).weekly.done).toBe(false);
});

test('the empty projection is coherent and unlocks the free cosmetics only', () => {
  const e = emptyEngagement('2026-04-06');
  expect(e.streak.days).toBe(0);
  expect(e.questCredits).toBe(0);
  expect(e.achievements.every((a) => !a.unlocked)).toBe(true);
  expect(e.cosmetics.every((c) => c.unlock === null)).toBe(true);
  expect(e.cosmetics.length).toBeGreaterThan(0);
  // And it agrees with the projection of an empty log, which is the thing it
  // stands in for while Dexie is being read.
  const projected = engagementFrom([], 10, at('2026-04-06'));
  expect(projected.streak).toEqual(e.streak);
  expect(projected.cosmetics.map((c) => c.id)).toEqual(e.cosmetics.map((c) => c.id));
});

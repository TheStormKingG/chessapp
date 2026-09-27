import { newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import { SECTIONS } from '@/path/curriculum';
import { shiftDay } from '@/tailored/schedule';
import {
  ACHIEVEMENTS,
  REVIEWED_LOSSES_TARGET,
  STREAK_ACHIEVEMENT_DAYS,
  achievementsFrom,
  unlockedAchievements,
  type AchievementId,
} from './achievements';

function ev(payload: EventPayload, day: string, hour = 12): LearnerEvent {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent(payload, new Date(y, m - 1, d, hour));
}

const DAY = '2026-05-04';

const passCheckpoint = (unit: string, day = DAY) =>
  ev({ type: 'checkpoint_attempted', unit, score: 0.9, passed: true, attempt: 1, missedConcepts: [] }, day);
const failCheckpoint = (unit: string, attempt: number, day = DAY) =>
  ev({ type: 'checkpoint_attempted', unit, score: 0.2, passed: false, attempt, missedConcepts: ['x'] }, day);
const finish = (id: string, result: 'win' | 'loss' | 'draw', day = DAY) =>
  ev({ type: 'game_finished', gameId: id, result, moves: 30, hints: 0, takebacks: 0, crowns: 1, pgn: '' }, day);
const review = (id: string, o: { blunders?: number; mistakes?: number } = {}, day = DAY) =>
  ev(
    {
      type: 'game_reviewed',
      gameId: id,
      accuracy: 70,
      blunders: o.blunders ?? 1,
      mistakes: o.mistakes ?? 1,
      drillCompleted: false,
      partial: false,
    },
    day,
  );

function ids(events: readonly LearnerEvent[], bestStreakDays = 0): AchievementId[] {
  return unlockedAchievements(achievementsFrom({ events, bestStreakDays })).map((a) => a.id);
}

/* ------------------------------------------------------- F-EN-5's constraint */

test('F-EN-5: volume alone unlocks nothing at all', () => {
  /*
   * The binding sentence of F-EN-5 is "never to volume alone", so this is the one
   * test the catalogue must not be able to pass by accident. The log below is a
   * great deal of activity with none of the things the achievements are about:
   * games played and reviewed but sloppily, puzzles attempted and failed,
   * checkpoints sat and failed.
   */
  const events: LearnerEvent[] = [];
  for (let i = 0; i < 50; i += 1) {
    events.push(finish(`g${String(i)}`, 'win'));
    events.push(review(`g${String(i)}`, { blunders: 3, mistakes: 2 }));
  }
  for (let i = 0; i < 200; i += 1) {
    events.push(
      ev(
        {
          type: 'puzzle_attempted',
          puzzleId: `p${String(i)}`,
          themes: ['fork'],
          puzzleRating: 1200,
          solved: false,
          hinted: true,
          misses: 4,
          source: 'rated',
          ms: 30000,
        },
        DAY,
      ),
    );
  }
  for (let i = 0; i < 100; i += 1) events.push(failCheckpoint('1.1', i + 1));
  for (let i = 0; i < 40; i += 1) {
    events.push(ev({ type: 'lesson_completed', lessonId: `1.1.${String(i)}`, stars: 1, xp: 10, replay: false }, DAY));
  }

  expect(ids(events)).toEqual([]);

  // THE POSITIVE CONTROL THIS ABSENCE NEEDS. The same fixture with ONE passed
  // checkpoint added does unlock something, so the empty list above is a property
  // of the log and not of a catalogue that never unlocks anything.
  expect(ids([...events, passCheckpoint('1.1')])).toContain('first-checkpoint');
});

test('a hundred reviewed WINS do not move the ten-reviewed-losses counter', () => {
  // "Ten reviewed losses" is the entry that most looks like a volume counter. It
  // counts one specific costly thing, and this is what says so.
  const wins: LearnerEvent[] = [];
  for (let i = 0; i < 100; i += 1) {
    wins.push(finish(`w${String(i)}`, 'win'));
    wins.push(review(`w${String(i)}`));
  }
  expect(ids(wins)).not.toContain('ten-reviewed-losses');
  const losses: LearnerEvent[] = [];
  for (let i = 0; i < REVIEWED_LOSSES_TARGET; i += 1) {
    losses.push(finish(`l${String(i)}`, 'loss'));
    losses.push(review(`l${String(i)}`));
  }
  expect(ids(losses)).toContain('ten-reviewed-losses');
});

test('every entry declares skill or effort, and none is a bare count of activity', () => {
  for (const a of ACHIEVEMENTS) {
    expect(['skill', 'effort']).toContain(a.basis);
    expect(a.detail.length).toBeGreaterThan(0);
  }
  expect(ACHIEVEMENTS.map((a) => a.id)).toHaveLength(7);
});

test('a blocked entry has no predicate to evaluate, which is what stops it unlocking', () => {
  // The union, asserted at runtime: a blocked entry carries no `progress` and no
  // `target`, so "never unlocks" is a property of its SHAPE. The earlier design
  // had a blocked flag AND a progress function returning 0, and removing either
  // left every test in this file passing.
  for (const a of ACHIEVEMENTS) {
    if (a.blocked === null) {
      expect(typeof a.progress, a.id).toBe('function');
      expect(a.target, a.id).toBeGreaterThan(0);
    } else {
      expect('progress' in a, a.id).toBe(false);
      expect('target' in a, a.id).toBe(false);
    }
  }
  // Both branches are non-empty, so neither loop arm is unreachable.
  expect(ACHIEVEMENTS.filter((a) => a.blocked === null).length).toBeGreaterThan(0);
  expect(ACHIEVEMENTS.filter((a) => a.blocked !== null).length).toBeGreaterThan(0);
});

test('the same game reviewed twice counts once toward ten reviewed losses', () => {
  // Two events with different ids for one game — the shape `data/reduce.ts`
  // guards with its own `gamesReviewed` map, guarded here for the same reason.
  const events: LearnerEvent[] = [];
  for (let i = 0; i < REVIEWED_LOSSES_TARGET; i += 1) {
    events.push(finish(`l${String(i)}`, 'loss'));
    events.push(review(`l${String(i)}`));
    events.push(review(`l${String(i)}`));
  }
  expect(ids(events)).toContain('ten-reviewed-losses');
  // Nine games, each reviewed twice, is nine — not eighteen.
  const nine: LearnerEvent[] = [];
  for (let i = 0; i < REVIEWED_LOSSES_TARGET - 1; i += 1) {
    nine.push(finish(`n${String(i)}`, 'loss'));
    nine.push(review(`n${String(i)}`));
    nine.push(review(`n${String(i)}`));
  }
  expect(ids(nine)).not.toContain('ten-reviewed-losses');
  const a = achievementsFrom({ events: nine, bestStreakDays: 0 }).find((x) => x.id === 'ten-reviewed-losses');
  expect(a?.progress).toBe(REVIEWED_LOSSES_TARGET - 1);
});

test('a clean game reviewed twice is one clean game', () => {
  const twice = [finish('g1', 'win'), review('g1', { blunders: 0, mistakes: 0 }), review('g1', { blunders: 0, mistakes: 0 })];
  const a = achievementsFrom({ events: twice, bestStreakDays: 0 }).find((x) => x.id === 'clean-game');
  expect(a?.progress).toBe(1);
  expect(a?.unlocked).toBe(true);
});

/* --------------------------------------------------- each unlockable entry */

test('the first passed checkpoint unlocks, and failed ones do not', () => {
  expect(ids([failCheckpoint('1.1', 1), failCheckpoint('1.1', 2)])).not.toContain('first-checkpoint');
  expect(ids([failCheckpoint('1.1', 1), passCheckpoint('1.1')])).toContain('first-checkpoint');
});

test('testing out of a unit does not count as a passed checkpoint', () => {
  // The onboarding placement appends one `unit_tested_out` per unit below the
  // placement point (`onboarding/PlacementRoute.tsx`), so counting them would hand
  // a new learner a section achievement for work never done.
  const placement = SECTIONS[0]?.units.map((u) => ev({ type: 'unit_tested_out', unit: u.id }, DAY)) ?? [];
  expect(placement.length).toBeGreaterThan(1);
  expect(ids(placement)).toEqual([]);
  // Positive control: the same units PASSED at their checkpoints do unlock both.
  const passed = SECTIONS[0]?.units.map((u) => passCheckpoint(u.id)) ?? [];
  expect(ids(passed)).toEqual(expect.arrayContaining(['first-checkpoint', 'full-section']));
});

test('a reviewed game with no blunders and no mistakes unlocks the clean game', () => {
  expect(ids([finish('g1', 'win'), review('g1', { blunders: 0, mistakes: 0 })])).toContain('clean-game');
  // One blunder is enough to disqualify it, and one mistake is too.
  expect(ids([finish('g1', 'win'), review('g1', { blunders: 1, mistakes: 0 })])).not.toContain('clean-game');
  expect(ids([finish('g1', 'win'), review('g1', { blunders: 0, mistakes: 1 })])).not.toContain('clean-game');
});

test('a clean game does not need to be a won game', () => {
  // The rule is about play, not result, which is the same principle F-EN-2's XP
  // table follows.
  expect(ids([finish('g1', 'loss'), review('g1', { blunders: 0, mistakes: 0 })])).toContain('clean-game');
});

test('a section unlocks only when every one of its units is passed', () => {
  const units = SECTIONS[0]?.units.map((u) => u.id) ?? [];
  expect(units.length).toBeGreaterThan(1);
  const allButOne = units.slice(0, -1).map((u) => passCheckpoint(u));
  expect(ids(allButOne)).not.toContain('full-section');
  expect(ids(units.map((u) => passCheckpoint(u)))).toContain('full-section');
});

test('the same checkpoint passed many times is one unit, not a section', () => {
  const many = [1, 2, 3, 4, 5, 6, 7, 8].map(() => passCheckpoint('1.1'));
  expect(ids(many)).toContain('first-checkpoint');
  expect(ids(many)).not.toContain('full-section');
});

test('the thirty-day streak reads the best run and the target comes from F-EN-1', () => {
  expect(STREAK_ACHIEVEMENT_DAYS).toBe(30);
  expect(ids([], 29)).not.toContain('thirty-day-streak');
  expect(ids([], 30)).toContain('thirty-day-streak');
  // It has no day, deliberately: the streak ledger keeps the best length and not
  // the calendar day it was reached.
  const a = achievementsFrom({ events: [], bestStreakDays: 40 }).find((x) => x.id === 'thirty-day-streak');
  expect(a?.unlocked).toBe(true);
  expect(a?.unlockedOn).toBeNull();
});

/* ------------------------------------------------------- blocked entries */

test('the two entries the log cannot answer never unlock, and carry their reason', () => {
  const blocked = ACHIEVEMENTS.filter((a) => a.blocked !== null).map((a) => a.id);
  expect(blocked).toEqual(['no-hanging-pieces', 'back-rank-mate']);
  for (const a of ACHIEVEMENTS) {
    if (a.blocked !== null) expect(a.blocked.length).toBeGreaterThan(20);
  }
  // The reason travels to the UI, so a locked entry can say why rather than
  // looking like something the learner has not got round to.
  for (const a of achievementsFrom({ events: [], bestStreakDays: 0 })) {
    expect(a.blocked === null || a.blocked.length > 20, a.id).toBe(true);
  }
  // Not even a log that does everything unlocks them.
  const everything = [
    ...(SECTIONS[0]?.units.map((u) => passCheckpoint(u.id)) ?? []),
    finish('g1', 'loss'),
    review('g1', { blunders: 0, mistakes: 0 }),
  ];
  const unlocked = ids(everything, 400);
  for (const id of blocked) expect(unlocked).not.toContain(id);
  // Positive control: that log DID unlock four other entries, so the exclusions
  // above are about these two.
  expect(unlocked.length).toBeGreaterThanOrEqual(3);
});

/* --------------------------------------------------------- the day, and monotonicity */

test('unlockedOn is the day the achievement was earned, not the day it is read', () => {
  const events = [failCheckpoint('1.1', 1, '2026-05-01'), passCheckpoint('1.1', '2026-05-02')];
  const later = [...events, ev({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: false }, '2026-06-01')];
  const a = achievementsFrom({ events: later, bestStreakDays: 0 }).find((x) => x.id === 'first-checkpoint');
  expect(a?.unlockedOn).toBe('2026-05-02');
});

test('an unlocked achievement is never taken away by later events', () => {
  const base = [finish('g1', 'win'), review('g1', { blunders: 0, mistakes: 0 })];
  expect(ids(base)).toContain('clean-game');
  const messy: LearnerEvent[] = [...base];
  for (let i = 0; i < 20; i += 1) {
    messy.push(finish(`m${String(i)}`, 'loss', shiftDay(DAY, i + 1)));
    messy.push(review(`m${String(i)}`, { blunders: 5, mistakes: 5 }, shiftDay(DAY, i + 1)));
  }
  expect(ids(messy)).toContain('clean-game');
});

test('progress is reported and capped for an entry in progress', () => {
  const events: LearnerEvent[] = [];
  for (let i = 0; i < 3; i += 1) {
    events.push(finish(`l${String(i)}`, 'loss'));
    events.push(review(`l${String(i)}`));
  }
  const a = achievementsFrom({ events, bestStreakDays: 0 }).find((x) => x.id === 'ten-reviewed-losses');
  expect(a?.progress).toBe(3);
  expect(a?.unlocked).toBe(false);
  const streak = achievementsFrom({ events: [], bestStreakDays: 900 }).find((x) => x.id === 'thirty-day-streak');
  expect(streak?.progress).toBe(STREAK_ACHIEVEMENT_DAYS);
});

test('an empty log unlocks nothing and reports every entry at nought', () => {
  const all = achievementsFrom({ events: [], bestStreakDays: 0 });
  expect(all).toHaveLength(ACHIEVEMENTS.length);
  expect(all.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
  expect(unlockedAchievements(all)).toEqual([]);
});

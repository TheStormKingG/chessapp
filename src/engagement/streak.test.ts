import { localDay, newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import { shiftDay } from '@/tailored/schedule';
import { PUZZLES_IN_A_SET, qualifyingDayIndex, qualifyingDays } from './qualifying';
import {
  DAYS_TO_RESET,
  GRACE_DAYS,
  MAX_FREEZES,
  MILESTONES,
  noStreak,
  streakOn,
  type Streak,
  type StreakInput,
} from './streak';

/* ------------------------------------------------------------------ helpers */

/** `n` consecutive days ending on `last`, ascending. */
function run(last: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(last, -(n - 1 - i)));
}

function s(o: Partial<StreakInput> & { today: string }): Streak {
  return streakOn({ qualifyingDays: [], freezeGrantDays: [], ...o });
}

/* ================================================================= the core */

test('an empty log is no streak, not a streak of nought with a loss date', () => {
  const st = s({ today: '2026-03-10' });
  expect(st).toEqual(noStreak());
  expect(st.loseAtEndOf).toBeNull();
  expect(st.status).toBe('none');
});

test('one qualifying action today is a streak of one', () => {
  const st = s({ qualifyingDays: ['2026-03-10'], today: '2026-03-10' });
  expect(st.days).toBe(1);
  expect(st.status).toBe('extended-today');
  expect(st.lastQualifyingDay).toBe('2026-03-10');
});

test('two actions on one day are still one day', () => {
  // Duplicates collapse: the rule counts DAYS with a qualifying action.
  expect(s({ qualifyingDays: ['2026-03-10', '2026-03-10'], today: '2026-03-10' }).days).toBe(1);
});

test('consecutive days accumulate, and the count is the number of days', () => {
  expect(s({ qualifyingDays: run('2026-03-10', 5), today: '2026-03-10' }).days).toBe(5);
});

test('a future day is ignored rather than trusted', () => {
  // A clock that moved backwards, or a log synced from a device an hour ahead.
  const st = s({ qualifyingDays: ['2026-03-11', '2026-03-12'], today: '2026-03-10' });
  expect(st.days).toBe(0);
  // Positive control: the same days with `today` moved forward DO count, so the
  // zero above is the future filter and not a broken day comparison.
  expect(s({ qualifyingDays: ['2026-03-11', '2026-03-12'], today: '2026-03-12' }).days).toBe(2);
});

/* ------------------------------------------------- the grace period, day by day */

test('the day after the last action: alive, at risk, nothing spent', () => {
  const st = s({ qualifyingDays: run('2026-03-10', 4), today: '2026-03-11' });
  expect(st.days).toBe(4);
  expect(st.status).toBe('at-risk');
  expect(st.graceDaysUsed).toBe(0);
  // Today has not ended, so today cannot have been missed yet.
  expect(st.loseAtEndOf).toBe('2026-03-13');
});

test('GRACE DAY ONE: the first missed day pauses the streak and does not reduce it', () => {
  const st = s({ qualifyingDays: run('2026-03-10', 4), today: '2026-03-12' });
  expect(st.days).toBe(4);
  expect(st.status).toBe('paused');
  expect(st.graceDaysUsed).toBe(1);
  expect(st.loseAtEndOf).toBe('2026-03-13');
});

test('GRACE DAY TWO: the second missed day is still inside the grace period', () => {
  const st = s({ qualifyingDays: run('2026-03-10', 4), today: '2026-03-13' });
  expect(st.days).toBe(4);
  expect(st.status).toBe('paused');
  expect(st.graceDaysUsed).toBe(GRACE_DAYS);
  // Today is the third day without an action; the reset is at its END, so a
  // qualifying action at any point today still saves it.
  expect(st.loseAtEndOf).toBe('2026-03-13');
});

test('THE THIRD DAY, acted on: the streak survives and extends', () => {
  const st = s({ qualifyingDays: [...run('2026-03-10', 4), '2026-03-13'], today: '2026-03-13' });
  expect(st.days).toBe(5);
  expect(st.status).toBe('extended-today');
  expect(st.graceDaysUsed).toBe(0);
});

test('THE END OF THE THIRD DAY: the streak resets, and not one day earlier', () => {
  const days = run('2026-03-10', 4);
  // 11th, 12th, 13th missed. On the 13th it is alive; on the 14th it is gone.
  expect(s({ qualifyingDays: days, today: '2026-03-13' }).days).toBe(4);
  const st = s({ qualifyingDays: days, today: '2026-03-14' });
  expect(st.days).toBe(0);
  expect(st.status).toBe('none');
  expect(st.lastQualifyingDay).toBeNull();
  expect(st.loseAtEndOf).toBeNull();
});

test('after a reset a new action starts again at one, not at the old total', () => {
  const st = s({ qualifyingDays: [...run('2026-03-10', 30), '2026-03-20'], today: '2026-03-20' });
  expect(st.days).toBe(1);
});

test('the reset boundary is DAYS_TO_RESET and the constant is the grace period plus one', () => {
  expect(DAYS_TO_RESET).toBe(GRACE_DAYS + 1);
  const last = '2026-03-10';
  const alive = s({ qualifyingDays: [last], today: shiftDay(last, DAYS_TO_RESET) });
  const gone = s({ qualifyingDays: [last], today: shiftDay(last, DAYS_TO_RESET + 1) });
  expect(alive.days).toBe(1);
  expect(gone.days).toBe(0);
});

/* ------------------------------------------------------------------ freezes */

test('A FREEZE CONSUMES ITSELF: one missed day, one freeze, the streak continues', () => {
  const st = s({
    qualifyingDays: run('2026-03-10', 4),
    freezeGrantDays: ['2026-03-09'],
    today: '2026-03-12', // the 11th was missed and is over
  });
  expect(st.days).toBe(4);
  expect(st.freezes).toBe(0);
  expect(st.freezesSpentOn).toEqual(['2026-03-11']);
  // The day was covered, so no grace day was spent — this is the reading the
  // module's header argues for, and the assertion that pins it.
  expect(st.graceDaysUsed).toBe(0);
  expect(st.status).toBe('at-risk');
});

test('a freeze preserves the streak and does not extend it', () => {
  // Four days, one frozen day, then an action. Five calendar days, five days of
  // streak would mean the freeze paid for a day of work.
  const st = s({
    qualifyingDays: [...run('2026-03-10', 4), '2026-03-12'],
    freezeGrantDays: ['2026-03-09'],
    today: '2026-03-12',
  });
  expect(st.days).toBe(5);
  expect(st.freezesSpentOn).toEqual(['2026-03-11']);
  // Without the freeze the same log gives the same 5: the freeze is what kept the
  // run unbroken, not what added to it.
  expect(s({ qualifyingDays: [...run('2026-03-10', 4), '2026-03-12'], today: '2026-03-12' }).days).toBe(5);
});

test('TWO FREEZES cover two separate missed days', () => {
  const st = s({
    qualifyingDays: run('2026-03-10', 4),
    freezeGrantDays: ['2026-03-08', '2026-03-09'],
    today: '2026-03-13', // the 11th and 12th missed and over
  });
  expect(st.days).toBe(4);
  expect(st.freezes).toBe(0);
  expect(st.freezesSpentOn).toEqual(['2026-03-11', '2026-03-12']);
  expect(st.graceDaysUsed).toBe(0);
});

test('TWO FREEZES then three more missed days: the grace period runs from scratch', () => {
  const days = run('2026-03-10', 4);
  const freezes = ['2026-03-08', '2026-03-09'];
  // 11th, 12th frozen. 13th, 14th, 15th are the three uncovered days.
  expect(s({ qualifyingDays: days, freezeGrantDays: freezes, today: '2026-03-15' }).days).toBe(4);
  expect(s({ qualifyingDays: days, freezeGrantDays: freezes, today: '2026-03-16' }).days).toBe(0);
});

test('at most two freezes are held, and a third grant is lost rather than banked', () => {
  expect(MAX_FREEZES).toBe(2);
  const st = s({
    qualifyingDays: ['2026-03-10'],
    freezeGrantDays: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04'],
    today: '2026-03-10',
  });
  expect(st.freezes).toBe(MAX_FREEZES);
  // And the cap really binds: two grants give two.
  expect(
    s({ qualifyingDays: ['2026-03-10'], freezeGrantDays: ['2026-03-01', '2026-03-02'], today: '2026-03-10' }).freezes,
  ).toBe(2);
});

test('a freeze earned on the missed day itself covers that night', () => {
  const st = s({
    qualifyingDays: run('2026-03-10', 3),
    freezeGrantDays: ['2026-03-11'],
    today: '2026-03-12',
  });
  expect(st.freezesSpentOn).toEqual(['2026-03-11']);
  expect(st.days).toBe(3);
});

test('no freeze is spent on a day that has not ended', () => {
  const st = s({ qualifyingDays: run('2026-03-10', 3), freezeGrantDays: ['2026-03-09'], today: '2026-03-11' });
  expect(st.freezes).toBe(1);
  expect(st.freezesSpentOn).toEqual([]);
  expect(st.status).toBe('at-risk');
  // It is spent the moment that day is over, which is the positive control that
  // the freeze was spendable all along.
  expect(s({ qualifyingDays: run('2026-03-10', 3), freezeGrantDays: ['2026-03-09'], today: '2026-03-12' }).freezes).toBe(0);
});

test('a freeze is never spent when there is no streak to protect', () => {
  // Grants with no activity at all, then a first action much later: the freeze is
  // still held, because there was nothing to keep alive in between.
  const st = s({ qualifyingDays: ['2026-03-20'], freezeGrantDays: ['2026-03-01'], today: '2026-03-20' });
  expect(st.freezes).toBe(1);
  expect(st.freezesSpentOn).toEqual([]);
});

test('freezes survive a reset: they are earned, not tied to the run', () => {
  const st = s({
    qualifyingDays: ['2026-03-01'],
    freezeGrantDays: ['2026-03-20'],
    today: '2026-03-21',
  });
  expect(st.days).toBe(0);
  expect(st.freezes).toBe(1);
});

/* ------------------------------------------------- the loss date the UI prints */

test('the loss date accounts for held freezes, one day each', () => {
  const days = run('2026-03-10', 4);
  const bare = s({ qualifyingDays: days, today: '2026-03-11' });
  const one = s({ qualifyingDays: days, freezeGrantDays: ['2026-03-10'], today: '2026-03-11' });
  const two = s({ qualifyingDays: days, freezeGrantDays: ['2026-03-09', '2026-03-10'], today: '2026-03-11' });
  expect(bare.loseAtEndOf).toBe('2026-03-13');
  expect(one.loseAtEndOf).toBe('2026-03-14');
  expect(two.loseAtEndOf).toBe('2026-03-15');
});

test('the loss date is the day the walk actually resets on', () => {
  // The two are computed differently — one by counting forward, one by walking
  // the calendar — so agreeing is a real check rather than a restatement.
  for (const freezeGrantDays of [[], ['2026-03-09'], ['2026-03-08', '2026-03-09']]) {
    for (const today of ['2026-03-11', '2026-03-12', '2026-03-13']) {
      const st = s({ qualifyingDays: run('2026-03-10', 4), freezeGrantDays, today });
      const lose = st.loseAtEndOf;
      expect(lose).not.toBeNull();
      if (lose === null) continue;
      expect(s({ qualifyingDays: run('2026-03-10', 4), freezeGrantDays, today: lose }).days).toBe(4);
      expect(s({ qualifyingDays: run('2026-03-10', 4), freezeGrantDays, today: shiftDay(lose, 1) }).days).toBe(0);
    }
  }
});

/* ---------------------------------------------------------------- milestones */

test('a milestone is reported on the day it is reached and only then', () => {
  for (const m of MILESTONES) {
    const last = '2026-06-01';
    const st = s({ qualifyingDays: run(last, m), today: last });
    expect(st.days).toBe(m);
    expect(st.milestoneToday).toBe(m);
  }
});

test('a milestone is not reported on a later day, or on a paused day', () => {
  const last = '2026-06-01';
  // Day 7 reached; the next day the streak is 7 and at risk, and the card must
  // not fire again.
  expect(s({ qualifyingDays: run(last, 7), today: last }).milestoneToday).toBe(7);
  expect(s({ qualifyingDays: run(last, 7), today: shiftDay(last, 1) }).milestoneToday).toBeNull();
  expect(s({ qualifyingDays: run(last, 7), today: shiftDay(last, 2) }).status).toBe('paused');
  expect(s({ qualifyingDays: run(last, 7), today: shiftDay(last, 2) }).milestoneToday).toBeNull();
});

test('a day that is not a milestone reports none, and the next one is named', () => {
  const st = s({ qualifyingDays: run('2026-06-01', 8), today: '2026-06-01' });
  expect(st.milestoneToday).toBeNull();
  expect(st.nextMilestone).toBe(14);
  expect(s({ qualifyingDays: [], today: '2026-06-01' }).nextMilestone).toBe(3);
});

test('past the last milestone there is no next one', () => {
  const st = s({ qualifyingDays: run('2027-06-01', 366), today: '2027-06-01' });
  expect(st.days).toBe(366);
  expect(st.nextMilestone).toBeNull();
  expect(st.milestoneToday).toBeNull();
});

/* ------------------------------------------- time zones, DST and month ends */

test('a streak crosses a month end and a year end', () => {
  expect(s({ qualifyingDays: run('2026-03-02', 5), today: '2026-03-02' }).days).toBe(5);
  expect(s({ qualifyingDays: run('2027-01-02', 5), today: '2027-01-02' }).days).toBe(5);
  // The days really did cross the boundary, so the count above is not five days
  // inside one month.
  expect(run('2026-03-02', 5)[0]).toBe('2026-02-26');
  expect(run('2027-01-02', 5)[0]).toBe('2026-12-29');
});

test('a run across a spring-forward DST boundary is not one day short', () => {
  // 29 March 2026 is the European spring-forward; 8 March 2026 is the US one.
  // A day walk built on local midnight loses an hour here and turns six whole
  // days into 6.958, which truncates to a shorter run.
  for (const last of ['2026-03-31', '2026-03-10']) {
    expect(s({ qualifyingDays: run(last, 7), today: last }).days).toBe(7);
  }
});

test('a run across an autumn-back DST boundary is not one day long', () => {
  for (const last of ['2026-10-27', '2026-11-03']) {
    const days = run(last, 7);
    expect(s({ qualifyingDays: days, today: last }).days).toBe(7);
    // And the reset boundary is still exactly three days after the last action.
    expect(s({ qualifyingDays: days, today: shiftDay(last, 3) }).days).toBe(7);
    expect(s({ qualifyingDays: days, today: shiftDay(last, 4) }).days).toBe(0);
  }
});

test('A DAY THAT CROSSES A TIME-ZONE CHANGE: the day is the one the device was in', () => {
  /*
   * F-EN-1: "Days are counted in the device's local time zone AT THE TIME OF THE
   * ACTION." The consequence is that a learner who flies west can act twice in
   * what a UTC clock calls one day and have it be two local days, or act on two
   * UTC days and have it be one local day. Neither is a bug to be corrected — the
   * day is stamped on the event when it happens and never recomputed, which is
   * why this reducer takes DAY STRINGS and no offsets at all.
   *
   * The two events below are 20 hours apart. Stamped in a zone at UTC+13 the
   * second is the next local day; stamped at UTC-11 it is the same one. The
   * reducer is handed each stamping and agrees with it, which is the property that
   * makes the rule hold on a moving device.
   */
  const acrossTheLine = streakOn({
    qualifyingDays: ['2026-03-10', '2026-03-11'],
    freezeGrantDays: [],
    today: '2026-03-11',
  });
  const sameSide = streakOn({ qualifyingDays: ['2026-03-10', '2026-03-10'], freezeGrantDays: [], today: '2026-03-10' });
  expect(acrossTheLine.days).toBe(2);
  expect(sameSide.days).toBe(1);

  // And the stamping itself: `localDay` is the device's own date, so the same
  // instant in two zones is two different days. This is the seam the reducer
  // trusts, asserted rather than assumed.
  const evening = new Date(2026, 2, 10, 23, 30);
  const nextMorning = new Date(2026, 2, 11, 19, 30);
  expect(localDay(evening)).toBe('2026-03-10');
  expect(localDay(nextMorning)).toBe('2026-03-11');
  expect(Math.round((nextMorning.getTime() - evening.getTime()) / 3_600_000)).toBe(20);
});

/* =========================================== F-EN-1's qualifying actions */

function ev(payload: EventPayload, day: string, hour = 12): LearnerEvent {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent(payload, new Date(y, m - 1, d, hour));
}

const DAY = '2026-04-01';

test('each of F-EN-1\'s six kinds qualifies a day on its own', () => {
  const cases: [string, LearnerEvent[]][] = [
    ['lesson', [ev({ type: 'lesson_completed', lessonId: '1.1.1', stars: 1, xp: 10, replay: false }, DAY)]],
    [
      'checkpoint',
      [ev({ type: 'checkpoint_attempted', unit: '1.1', score: 0.2, passed: false, attempt: 1, missedConcepts: [] }, DAY)],
    ],
    [
      'review',
      [
        ev(
          { type: 'game_reviewed', gameId: 'g1', accuracy: 50, blunders: 0, mistakes: 0, drillCompleted: false, partial: false },
          DAY,
        ),
      ],
    ],
    [
      'coached-game',
      [
        ev({ type: 'game_started', gameId: 'g1', persona: 'ada', color: 'w', timeControl: 'untimed', coach: true }, DAY),
        ev({ type: 'game_finished', gameId: 'g1', result: 'loss', moves: 20, hints: 0, takebacks: 0, crowns: 0, pgn: '' }, DAY),
      ],
    ],
    [
      'daily-puzzle',
      [
        ev(
          { type: 'puzzle_attempted', puzzleId: 'p1', themes: ['fork'], puzzleRating: 900, solved: false, hinted: false, misses: 3, source: 'daily', ms: 9000 },
          DAY,
        ),
      ],
    ],
    [
      'puzzle-set',
      Array.from({ length: PUZZLES_IN_A_SET }, (_, i) =>
        ev(
          { type: 'puzzle_attempted', puzzleId: `p${String(i)}`, themes: ['fork'], puzzleRating: 900, solved: false, hinted: false, misses: 1, source: 'rated', ms: 5000 },
          DAY,
        ),
      ),
    ],
  ];
  for (const [kind, events] of cases) {
    expect(qualifyingDays(events), kind).toEqual([DAY]);
    expect(qualifyingDayIndex(events).get(DAY), kind).toContain(kind);
  }
  expect(cases).toHaveLength(6);
});

test('an uncoached game does not qualify, and the same game with a coach does', () => {
  const finish = ev(
    { type: 'game_finished', gameId: 'g1', result: 'win', moves: 20, hints: 0, takebacks: 0, crowns: 3, pgn: '' },
    DAY,
  );
  const start = (coach: boolean) =>
    ev({ type: 'game_started', gameId: 'g1', persona: 'ada', color: 'w', timeControl: 'untimed', coach }, DAY);
  expect(qualifyingDays([start(false), finish])).toEqual([]);
  expect(qualifyingDays([start(true), finish])).toEqual([DAY]);
});

test('a coached game is credited to the day it finished, not the day it began', () => {
  const start = ev(
    { type: 'game_started', gameId: 'g1', persona: 'ada', color: 'w', timeControl: 'untimed', coach: true },
    '2026-04-01',
    23,
  );
  const finish = ev(
    { type: 'game_finished', gameId: 'g1', result: 'draw', moves: 60, hints: 0, takebacks: 0, crowns: 1, pgn: '' },
    '2026-04-02',
    0,
  );
  expect(qualifyingDays([start, finish])).toEqual(['2026-04-02']);
});

test('the join works whichever order the two game events arrive in', () => {
  const start = ev({ type: 'game_started', gameId: 'g1', persona: 'ada', color: 'w', timeControl: 'untimed', coach: true }, DAY);
  const finish = ev({ type: 'game_finished', gameId: 'g1', result: 'win', moves: 20, hints: 0, takebacks: 0, crowns: 3, pgn: '' }, DAY);
  expect(qualifyingDays([finish, start])).toEqual([DAY]);
  expect(qualifyingDays([start, finish])).toEqual([DAY]);
});

test('four puzzles are not a set, and the fifth makes one', () => {
  const p = (i: number, day: string) =>
    ev(
      { type: 'puzzle_attempted', puzzleId: `p${String(i)}`, themes: ['fork'], puzzleRating: 900, solved: true, hinted: false, misses: 0, source: 'rated', ms: 3000 },
      day,
    );
  expect(qualifyingDays([0, 1, 2, 3].map((i) => p(i, DAY)))).toEqual([]);
  expect(qualifyingDays([0, 1, 2, 3, 4].map((i) => p(i, DAY)))).toEqual([DAY]);
});

test('a set of five is a property of the day: three today and two tomorrow qualify neither', () => {
  const p = (i: number, day: string) =>
    ev(
      { type: 'puzzle_attempted', puzzleId: `p${String(i)}`, themes: ['fork'], puzzleRating: 900, solved: true, hinted: false, misses: 0, source: 'rated', ms: 3000 },
      day,
    );
  const split = [p(0, '2026-04-01'), p(1, '2026-04-01'), p(2, '2026-04-01'), p(3, '2026-04-02'), p(4, '2026-04-02')];
  expect(qualifyingDays(split)).toEqual([]);
  // Positive control: five on ONE of those days does qualify it, so the empty
  // result is about the split and not about the fixture.
  expect(qualifyingDays([...split, p(5, '2026-04-01'), p(6, '2026-04-01')])).toEqual(['2026-04-01']);
});

test('qualifying is about effort, never outcome', () => {
  // Every outcome field flipped to its worst value. PRD 8.9: "Streaks count
  // effort and never outcomes."
  const events = [
    ev({ type: 'checkpoint_attempted', unit: '1.1', score: 0, passed: false, attempt: 3, missedConcepts: ['x'] }, DAY),
    ev({ type: 'game_started', gameId: 'g1', persona: 'ada', color: 'w', timeControl: 'untimed', coach: true }, DAY),
    ev({ type: 'game_finished', gameId: 'g1', result: 'loss', moves: 8, hints: 5, takebacks: 4, crowns: 0, pgn: '' }, DAY),
    ev(
      { type: 'puzzle_attempted', puzzleId: 'p1', themes: ['fork'], puzzleRating: 900, solved: false, hinted: true, misses: 9, source: 'daily', ms: 60000 },
      DAY,
    ),
  ];
  expect(qualifyingDayIndex(events).get(DAY)).toEqual(['checkpoint', 'coached-game', 'daily-puzzle']);
  expect(streakOn({ qualifyingDays: qualifyingDays(events), freezeGrantDays: [], today: DAY }).days).toBe(1);
});

test('events that are not qualifying actions qualify no day', () => {
  const events = [
    ev({ type: 'lesson_started', lessonId: '1.1.1' }, DAY),
    ev(
      { type: 'challenge_attempted', lessonId: '1.1.1', challengeId: 'c1', correct: true, hints: 0, misses: 0, mastery: true, context: 'lesson' },
      DAY,
    ),
    ev({ type: 'unit_tested_out', unit: '1.1' }, DAY),
    ev({ type: 'games_imported', source: 'lichess', username: 'x', added: 50, alreadyHeld: 0, skipped: 0 }, DAY),
    ev({ type: 'settings_changed', key: 'coachMuted', value: true }, DAY),
  ];
  expect(qualifyingDays(events)).toEqual([]);
  // The positive control this absence needs: the SAME index function does return
  // a day when a qualifying event is added, so "no days" is not "the function
  // returns nothing".
  expect(
    qualifyingDays([...events, ev({ type: 'lesson_completed', lessonId: '1.1.1', stars: 1, xp: 10, replay: false }, DAY)]),
  ).toEqual([DAY]);
});

test('an import of fifty games is not fifty days of work', () => {
  // The event that most looks like activity and is not: F-IM-1 can bring in
  // hundreds of games, and none of them was played today.
  const events = [ev({ type: 'games_imported', source: 'chess.com', username: 'x', added: 500, alreadyHeld: 0, skipped: 2 }, DAY)];
  expect(streakOn({ qualifyingDays: qualifyingDays(events), freezeGrantDays: [], today: DAY }).days).toBe(0);
});

test('the index is in ascending day order and names the kinds in F-EN-1\'s order', () => {
  const events = [
    ev({ type: 'lesson_completed', lessonId: '1.1.2', stars: 1, xp: 10, replay: false }, '2026-04-03'),
    ev({ type: 'lesson_completed', lessonId: '1.1.1', stars: 1, xp: 10, replay: false }, '2026-04-01'),
    ev({ type: 'checkpoint_attempted', unit: '1.1', score: 0.9, passed: true, attempt: 1, missedConcepts: [] }, '2026-04-01'),
  ];
  const index = qualifyingDayIndex(events);
  expect([...index.keys()]).toEqual(['2026-04-01', '2026-04-03']);
  expect(index.get('2026-04-01')).toEqual(['lesson', 'checkpoint']);
});

test('a freeze earned in the past is held even when the only qualifying day is in the future', () => {
  // The case the removed future-day filter got wrong: it returned early on an
  // all-future `qualifyingDays` and the past grant was never read, so an earned
  // freeze vanished. This is the input on which the filter and its absence
  // differ, which is why it is a test and not a comment.
  const st = s({ qualifyingDays: ['2026-03-20'], freezeGrantDays: ['2026-03-01'], today: '2026-03-10' });
  expect(st.days).toBe(0);
  expect(st.freezes).toBe(1);
  expect(st.freezesSpentOn).toEqual([]);
});

test('a day later than today never counts, whatever else is in the log', () => {
  // With a real past run alongside the future day, so the zero cannot come from
  // an empty input.
  const withFuture = s({ qualifyingDays: [...run('2026-03-10', 3), '2026-03-25'], today: '2026-03-11' });
  const withoutFuture = s({ qualifyingDays: run('2026-03-10', 3), today: '2026-03-11' });
  expect(withFuture).toEqual(withoutFuture);
  expect(withFuture.days).toBe(3);
});

test('a freeze RESTARTS the grace period, which is the reading this module chose', () => {
  /*
   * The one input on which F-EN-1's two readings of a freeze disagree, and
   * therefore the only test that can hold the choice in place. The module header
   * argues for (a); without this test (b) passes every other assertion in this
   * file.
   *
   *   10th  qualifying action, streak 1
   *   11th  missed, no freeze held      -> grace 1
   *   12th  freeze earned and spent     -> (a) grace back to 0   (b) grace stays 1
   *   13th  missed                      -> (a) 1                 (b) 2
   *   14th  missed                      -> (a) 2                 (b) 3, RESET
   *   15th  missed                      -> (a) 3, RESET
   */
  const input = { qualifyingDays: ['2026-03-10'], freezeGrantDays: ['2026-03-12'] };
  // The 12th is settled once it has ended, so this is read on the 13th.
  expect(s({ ...input, today: '2026-03-13' }).freezesSpentOn).toEqual(['2026-03-12']);
  expect(s({ ...input, today: '2026-03-13' }).graceDaysUsed).toBe(0);

  // THE DISCRIMINATOR. Under reading (b) the run has already reset by the 15th,
  // because the frozen day would have counted toward the three.
  expect(s({ ...input, today: '2026-03-15' }).days).toBe(1);
  expect(s({ ...input, today: '2026-03-15' }).graceDaysUsed).toBe(GRACE_DAYS);

  // And it does end — one day later than (b) would have ended it, which is the
  // whole of the difference the choice makes.
  expect(s({ ...input, today: '2026-03-16' }).days).toBe(0);
});

test('the best run is remembered after the current one resets', () => {
  // F-EN-5's "a 30-day streak" is an achievement about a run the learner HAS HAD.
  // `days` forgets it; `bestDays` is what an achievement may key on, because an
  // achievement that could be taken away again is not an achievement.
  const st = s({ qualifyingDays: run('2026-03-10', 30), today: '2026-04-20' });
  expect(st.days).toBe(0);
  expect(st.bestDays).toBe(30);
  // And it is the maximum, not the last: a short run after a long one does not
  // lower it.
  const after = s({ qualifyingDays: [...run('2026-03-10', 30), '2026-04-20'], today: '2026-04-20' });
  expect(after.days).toBe(1);
  expect(after.bestDays).toBe(30);
});

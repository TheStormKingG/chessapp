import { newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import { ACTIVITY_DAYS_BEFORE_REMINDERS } from '@/onboarding/notifications';
import { noStreak, streakOn, type Streak } from './streak';
import {
  DEFAULT_REMINDER_HOUR,
  QUIET_FROM_HOUR,
  QUIET_UNTIL_HOUR,
  REMINDER_CHANNELS,
  REMINDER_TEMPLATES,
  TAPS_TO_TURN_A_CHANNEL_OFF,
  chooseCopy,
  defaultChannels,
  isQuietHour,
  plan,
  reminderControlReady,
  reminderHour,
  requestPermissionFromTap,
  usualHour,
  type ReminderContext,
} from './reminders';

function at(day: string, hour: number, minute = 0): LearnerEvent {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent({ type: 'lesson_started', lessonId: '1.1.1' } satisfies EventPayload, new Date(y, m - 1, d, hour, minute));
}

const NOW = new Date(2026, 4, 20, 12, 0);

function ctx(o: Partial<ReminderContext> = {}): ReminderContext {
  return { resumeLessonTitle: null, unreviewedGames: 0, streak: noStreak(), ...o };
}

function streakOf(days: number, freezes = 0): Streak {
  const last = '2026-05-20';
  const qualifyingDays = Array.from({ length: days }, (_, i) =>
    new Date(2026, 4, 20 - (days - 1 - i)).toISOString().slice(0, 10),
  );
  const s = streakOn({
    qualifyingDays,
    freezeGrantDays: freezes > 0 ? ['2026-05-01', '2026-05-02'].slice(0, freezes) : [],
    today: last,
  });
  expect(s.days).toBe(days);
  return s;
}

/* -------------------------------------------------------------- quiet hours */

test('quiet hours wrap midnight and leave the day open', () => {
  for (const h of [21, 22, 23, 0, 3, 7]) expect(isQuietHour(h), String(h)).toBe(true);
  for (const h of [8, 12, 18, 20]) expect(isQuietHour(h), String(h)).toBe(false);
  expect(QUIET_FROM_HOUR).toBeGreaterThan(QUIET_UNTIL_HOUR);
});

test('a reminder in quiet hours is MOVED, not dropped', () => {
  // A learner whose habit is 23:00 gets one reminder at the end of quiet hours
  // rather than none at all.
  const lateNightLearner = [at('2026-05-18', 23), at('2026-05-19', 23), at('2026-05-20', 22)];
  expect(usualHour(lateNightLearner, NOW)).toBe(23);
  expect(reminderHour(lateNightLearner, NOW)).toBe(QUIET_UNTIL_HOUR);
  expect(isQuietHour(reminderHour(lateNightLearner, NOW))).toBe(false);
});

/* ------------------------------------------------------------ the usual time */

test('the usual hour is the median of recent activity, not the mean', () => {
  // Four sessions at 18:00 and one at 02:00. The mean is about 14:48, which is an
  // hour this learner has never once opened the app.
  const events = [at('2026-05-16', 18), at('2026-05-17', 18), at('2026-05-18', 18), at('2026-05-19', 18), at('2026-05-20', 2)];
  expect(usualHour(events, NOW)).toBe(18);
  const mean = Math.round(events.reduce((a, e) => a + new Date(e.createdAt).getHours(), 0) / events.length);
  expect(mean).not.toBe(18);
});

test('a tie rounds down, so the later hour is still ahead of the learner', () => {
  const events = [at('2026-05-19', 18), at('2026-05-20', 19)];
  expect(usualHour(events, NOW)).toBe(18);
});

test('activity older than the window is ignored', () => {
  const old = [at('2026-01-01', 7), at('2026-01-02', 7), at('2026-01-03', 7)];
  expect(usualHour(old, NOW)).toBe(DEFAULT_REMINDER_HOUR);
  // Positive control: the same three sessions inside the window DO set the hour,
  // so the default above is the window and not a broken median.
  const recent = [at('2026-05-18', 9), at('2026-05-19', 9), at('2026-05-20', 9)];
  expect(usualHour(recent, NOW)).toBe(9);
});

test('an empty log falls back to a stated hour rather than to midnight', () => {
  expect(usualHour([], NOW)).toBe(DEFAULT_REMINDER_HOUR);
  expect(isQuietHour(DEFAULT_REMINDER_HOUR)).toBe(false);
});

/* ------------------------------------------------------------- the channels */

test('both channels are off until the learner turns one on', () => {
  expect(defaultChannels()).toEqual({ push: false, email: false });
  expect(plan({ channels: defaultChannels(), lastSentDay: null, today: '2026-05-20', actedToday: false, hour: 18, context: ctx() })).toEqual({
    send: false,
    reason: 'no-channel-on',
  });
});

test('push is preferred and email is the fallback, exactly as F-EN-7 orders them', () => {
  const base = { lastSentDay: null, today: '2026-05-20', actedToday: false, hour: 18, context: ctx() };
  const both = plan({ ...base, channels: { push: true, email: true } });
  const emailOnly = plan({ ...base, channels: { push: false, email: true } });
  expect(both.send && both.channel).toBe('push');
  expect(emailOnly.send && emailOnly.channel).toBe('email');
  expect([...REMINDER_CHANNELS]).toEqual(['push', 'email']);
});

test('turning a channel off stops the reminder on that channel', () => {
  const base = { lastSentDay: null, today: '2026-05-20', actedToday: false, hour: 18, context: ctx() };
  expect(plan({ ...base, channels: { push: true, email: false } }).send).toBe(true);
  expect(plan({ ...base, channels: { push: false, email: false } }).send).toBe(false);
  expect(TAPS_TO_TURN_A_CHANNEL_OFF).toBe(2);
});

/* --------------------------------------------------- one a day at most */

test('one reminder a day at most', () => {
  const base = { channels: { push: true, email: false }, today: '2026-05-20', actedToday: false, hour: 18, context: ctx() };
  expect(plan({ ...base, lastSentDay: '2026-05-20' })).toEqual({ send: false, reason: 'already-sent-today' });
  // Yesterday's send does not block today's, which is the control that the guard
  // is about the DAY and not about there being any previous send at all.
  expect(plan({ ...base, lastSentDay: '2026-05-19' }).send).toBe(true);
});

test('a learner who has already done something today is not reminded to do it', () => {
  const base = { channels: { push: true, email: false }, lastSentDay: null, today: '2026-05-20', hour: 18, context: ctx() };
  expect(plan({ ...base, actedToday: true })).toEqual({ send: false, reason: 'acted-today' });
  expect(plan({ ...base, actedToday: false }).send).toBe(true);
});

/* ------------------------------------------------------------------ the copy */

test('unfinished business outranks the streak, and a specific thing outranks a general one', () => {
  const withBoth = ctx({ unreviewedGames: 2, resumeLessonTitle: 'The rook', streak: streakOf(9) });
  expect(chooseCopy(withBoth).id).toBe('unfinished-review');
  expect(chooseCopy(ctx({ resumeLessonTitle: 'The rook', streak: streakOf(9) })).id).toBe('unfinished-lesson');
  expect(chooseCopy(ctx({ streak: streakOf(9) })).id).toBe('streak-at-risk');
  expect(chooseCopy(ctx()).id).toBe('come-back');
});

test('a milestone one day away gets its own line', () => {
  // Six days, so the next milestone is seven and it is one day away.
  expect(chooseCopy(ctx({ streak: streakOf(6) })).id).toBe('streak-milestone-near');
  expect(chooseCopy(ctx({ streak: streakOf(6) })).title).toContain('7');
  // Five days is two away, so the ordinary streak line is used.
  expect(chooseCopy(ctx({ streak: streakOf(5) })).id).toBe('streak-at-risk');
});

test('the streak line names the freezes in reserve when there are any', () => {
  expect(chooseCopy(ctx({ streak: streakOf(9, 1) })).body).toMatch(/1 freeze in reserve/);
  expect(chooseCopy(ctx({ streak: streakOf(9, 2) })).body).toMatch(/2 freezes in reserve/);
  expect(chooseCopy(ctx({ streak: streakOf(9, 0) })).body).not.toMatch(/reserve/);
});

test('one game reads as one game, not as "1 games"', () => {
  expect(chooseCopy(ctx({ unreviewedGames: 1 })).title).toBe('One game still to look at');
  expect(chooseCopy(ctx({ unreviewedGames: 3 })).title).toBe('3 games still to look at');
});

test('F-EN-7: no template is guilt for its own sake', () => {
  /*
   * The content constraint, as a sweep over every template with every shape of
   * context. Banned: naming a failure, counting what was missed, or asking a
   * question the learner can only answer by feeling bad.
   */
  const banned = [
    /\bdon'?t forget\b/i,
    /\bfailed?\b/i,
    /\bmissed\b/i,
    /\blast chance\b/i,
    /\bstill\b.*\bhaven'?t\b/i,
    /\byou'?ve? not\b/i,
    /\blosing\b/i,
    /\bbroke(n)?\b/i,
    /\bgiving up\b/i,
    /\bdisappoint/i,
    /\blet .* down\b/i,
    /\bsad\b/i,
    /\bwe miss you\b/i,
    /\bcome on\b/i,
    /!{2,}/,
  ];
  const contexts: ReminderContext[] = [
    ctx(),
    ctx({ unreviewedGames: 1 }),
    ctx({ unreviewedGames: 4 }),
    ctx({ resumeLessonTitle: 'The knight' }),
    ctx({ streak: streakOf(1) }),
    ctx({ streak: streakOf(6) }),
    ctx({ streak: streakOf(9) }),
    ctx({ streak: streakOf(9, 2) }),
  ];
  const lines: string[] = [];
  for (const c of contexts) {
    for (const t of REMINDER_TEMPLATES) {
      if (!t.applies(c)) continue;
      const copy = t.copy(c);
      lines.push(copy.title, copy.body);
    }
  }
  // Every template really was reached, so the sweep covers the bank rather than a
  // corner of it.
  const reached = new Set(
    contexts.flatMap((c) => REMINDER_TEMPLATES.filter((t) => t.applies(c)).map((t) => t.id)),
  );
  expect(reached.size).toBe(REMINDER_TEMPLATES.length);
  expect(lines.length).toBeGreaterThan(REMINDER_TEMPLATES.length);

  for (const line of lines) {
    for (const rx of banned) {
      expect(rx.test(line), `"${line}" matched ${String(rx)}`).toBe(false);
    }
  }
  // THE POSITIVE CONTROL. A filter that matches nothing passes this test whatever
  // the copy says, so the same sweep is run over a line that SHOULD be caught.
  const guilt = "Don't forget! You've not practised and your streak is broken!!";
  expect(banned.some((rx) => rx.test(guilt))).toBe(true);
});

test('every template is anchored on something the learner can act on', () => {
  // The other half of "never guilt": each line names a concrete next action or the
  // thing that is still theirs to keep.
  const anchors = /lesson|puzzle|review|game|days|keeps it|opens where/i;
  for (const c of [
    ctx({ unreviewedGames: 2 }),
    ctx({ resumeLessonTitle: 'The knight' }),
    ctx({ streak: streakOf(6) }),
    ctx({ streak: streakOf(9) }),
    ctx(),
  ]) {
    const copy = chooseCopy(c);
    expect(`${copy.title} ${copy.body}`, copy.id).toMatch(anchors);
  }
  expect(anchors.test('a line with no anchor at all')).toBe(false);
});

/* ------------------------------------------- the permission prompt's caller */

describe('the permission prompt', () => {
  const original = globalThis.Notification;
  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'Notification');
    else Object.defineProperty(globalThis, 'Notification', { value: original, configurable: true, writable: true });
  });

  function stubNotification(permission: NotificationPermission, onRequest: () => void) {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: {
        permission,
        requestPermission: () => {
          onRequest();
          return Promise.resolve('granted' as NotificationPermission);
        },
      },
    });
  }

  function twoDays(): LearnerEvent[] {
    return [at('2026-05-19', 18), at('2026-05-20', 18)];
  }

  test('nothing is asked before F-ON-8\'s two days of activity', async () => {
    let asked = 0;
    stubNotification('default', () => {
      asked += 1;
    });
    const out = await requestPermissionFromTap([at('2026-05-20', 18)]);
    expect(out).toEqual({ requested: false, decision: { allowed: false, reason: 'too-few-days' } });
    expect(asked).toBe(0);
    expect(ACTIVITY_DAYS_BEFORE_REMINDERS).toBe(2);
  });

  test('with two days of activity and a tap, the prompt is raised exactly once', async () => {
    let asked = 0;
    stubNotification('default', () => {
      asked += 1;
    });
    const out = await requestPermissionFromTap(twoDays());
    expect(out).toEqual({ requested: true, permission: 'granted' });
    // The positive control for the test above: the SAME stub does get called when
    // the gate allows it, so "asked 0 times" there was the gate refusing.
    expect(asked).toBe(1);
  });

  test('a learner who has already answered is not asked again', async () => {
    for (const permission of ['granted', 'denied'] as NotificationPermission[]) {
      let asked = 0;
      stubNotification(permission, () => {
        asked += 1;
      });
      const out = await requestPermissionFromTap(twoDays());
      expect(out).toEqual({ requested: true, permission });
      // A denial is permanent in every browser. Asking again is not something this
      // code gets to decide, so it does not ask.
      expect(asked).toBe(0);
    }
  });

  test('the control reports readiness without asking for anything', async () => {
    let asked = 0;
    stubNotification('default', () => {
      asked += 1;
    });
    expect(reminderControlReady([at('2026-05-20', 18)])).toEqual({ allowed: false, reason: 'too-few-days' });
    expect(reminderControlReady(twoDays())).toEqual({ allowed: true });
    expect(asked).toBe(0);
  });

  test('a browser with no Notification API refuses rather than throwing', async () => {
    Reflect.deleteProperty(globalThis, 'Notification');
    const out = await requestPermissionFromTap(twoDays());
    expect(out.requested).toBe(false);
  });
});

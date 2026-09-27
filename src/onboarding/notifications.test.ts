import { newEvent, type LearnerEvent } from '@/data/events';
import {
  ACTIVITY_DAYS_BEFORE_REMINDERS,
  activityDays,
  mayRequestNotificationPermission,
} from './notifications';
import { signupPromptDue, type SignupPromptInput } from './signup';

function event(day: string, hour = 12): LearnerEvent {
  // `deviceDay` is derived from the local date by `newEvent`, so the fixture
  // builds it from a real local Date rather than writing the field by hand.
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent({ type: 'lesson_started', lessonId: '1.1.1' }, new Date(y, m - 1, d, hour));
}

/* ----------------------------------------------------- F-ON-8, the gate */

test('activity days are distinct local days, ascending', () => {
  const events = [event('2026-03-02'), event('2026-03-01', 22), event('2026-03-01', 8)];
  expect(activityDays(events)).toEqual(['2026-03-01', '2026-03-02']);
  // Non-vacuous: three events really did go in, and two of them share a day —
  // so the de-duplication did work rather than the input being unique already.
  expect(events).toHaveLength(3);
  expect(events.map((e) => e.deviceDay)).toContain('2026-03-01');
});

test('two events in one evening are one day of activity, not two', () => {
  // The reason `deviceDay` is read and `createdAt` is not: a 22:00 session in a
  // positive-offset zone has a UTC date of the next day.
  const days = activityDays([event('2026-03-01', 22), event('2026-03-01', 23)]);
  expect(days).toEqual(['2026-03-01']);
  expect(mayRequestNotificationPermission({ activeDays: days.length, fromTap: true })).toEqual({
    allowed: false,
    reason: 'too-few-days',
  });
});

test('an empty log is nought days, not an error', () => {
  expect(activityDays([])).toEqual([]);
});

test('permission is refused before two days of activity, however the call arrives', () => {
  expect(ACTIVITY_DAYS_BEFORE_REMINDERS).toBe(2);
  for (const days of [0, 1]) {
    expect(mayRequestNotificationPermission({ activeDays: days, fromTap: true })).toEqual({
      allowed: false,
      reason: 'too-few-days',
    });
  }
});

test('permission is refused without a tap, however much activity there is', () => {
  for (const days of [2, 3, 99]) {
    expect(mayRequestNotificationPermission({ activeDays: days, fromTap: false })).toEqual({
      allowed: false,
      reason: 'not-a-tap',
    });
  }
});

test('permission is allowed only with two days of activity AND a tap', () => {
  expect(mayRequestNotificationPermission({ activeDays: 2, fromTap: true })).toEqual({ allowed: true });
  expect(mayRequestNotificationPermission({ activeDays: 3, fromTap: true })).toEqual({ allowed: true });
  // Both partitions are non-empty: the three refusals above and the two grants
  // here come from the same function, so neither branch is unreachable.
  expect(mayRequestNotificationPermission({ activeDays: 1, fromTap: true }).allowed).toBe(false);
  expect(mayRequestNotificationPermission({ activeDays: 2, fromTap: false }).allowed).toBe(false);
});

/* --------------------------------------------- F-ON-4 and F-ON-7, the policy */

function input(o: Partial<SignupPromptInput> = {}): SignupPromptInput {
  return {
    firstActivityDone: true,
    dailyPlanCompleted: false,
    firstCheckpointPassed: false,
    dismissed: [],
    signedIn: false,
    ...o,
  };
}

test('F-ON-4: nothing is offered before a first lesson or the placement test', () => {
  // Both triggers are on, so only the F-ON-4 gate can be holding this back.
  expect(
    signupPromptDue(
      input({ firstActivityDone: false, dailyPlanCompleted: true, firstCheckpointPassed: true }),
    ),
  ).toBeNull();
  // ...and the same input with the gate open does offer something, which is
  // what makes the null above attributable to the gate.
  expect(
    signupPromptDue(input({ dailyPlanCompleted: true, firstCheckpointPassed: true })),
  ).toBe('first_plan');
});

test('the prompt is due at the first daily plan and again at the first checkpoint', () => {
  expect(signupPromptDue(input({ dailyPlanCompleted: true }))).toBe('first_plan');
  expect(signupPromptDue(input({ firstCheckpointPassed: true }))).toBe('first_checkpoint');
  // Neither occasion is lost to the order the two happen in.
  expect(
    signupPromptDue(input({ firstCheckpointPassed: true, dismissed: ['first_plan'] })),
  ).toBe('first_checkpoint');
  expect(
    signupPromptDue(input({ dailyPlanCompleted: true, dismissed: ['first_checkpoint'] })),
  ).toBe('first_plan');
});

test('a declined occasion never returns, which is what "soft" means', () => {
  expect(
    signupPromptDue(
      input({ dailyPlanCompleted: true, firstCheckpointPassed: true, dismissed: ['first_plan', 'first_checkpoint'] }),
    ),
  ).toBeNull();
});

test('nothing is offered to a learner who already has an account', () => {
  expect(
    signupPromptDue(input({ signedIn: true, dailyPlanCompleted: true, firstCheckpointPassed: true })),
  ).toBeNull();
});

test('with neither occasion reached there is nothing to offer', () => {
  expect(signupPromptDue(input())).toBeNull();
});

import { ONBOARDED_KEY, ONBOARDED_VALUE } from '../../tests/onboarded';
import { ONBOARDING_STORAGE_KEY, onboardingAnswered, useOnboarding } from './store';
import { DEFAULT_DAILY_GOAL } from './types';

beforeEach(() => {
  localStorage.clear();
  useOnboarding.getState().reset();
});

test('a new device has no answers and a real default goal', () => {
  const s = useOnboarding.getState();
  expect(s.why).toBeNull();
  expect(s.level).toBeNull();
  expect(s.placedUnit).toBeNull();
  expect(s.answeredAt).toBeNull();
  expect(s.dailyGoal).toBe(DEFAULT_DAILY_GOAL);
  expect(onboardingAnswered(s)).toBe(false);
});

test('answering is what onboardingAnswered reads, and a placement is not', () => {
  useOnboarding.getState().markPlaced('2.3');
  // Both partitions, so neither field is standing in for the other: a placement
  // alone does not mean the questions were answered, and answering alone does
  // not mean a placement happened.
  expect(onboardingAnswered(useOnboarding.getState())).toBe(false);
  useOnboarding.getState().markAnswered(new Date('2026-03-01T09:00:00.000Z'));
  expect(useOnboarding.getState().answeredAt).toBe('2026-03-01T09:00:00.000Z');
  expect(onboardingAnswered(useOnboarding.getState())).toBe(true);
  expect(useOnboarding.getState().placedUnit).toBe('2.3');
});

test('the answers outlive the session, under the key the e2e seed uses', () => {
  expect(ONBOARDING_STORAGE_KEY).toBe(ONBOARDED_KEY);
  useOnboarding.getState().setWhy('help_a_child');
  useOnboarding.getState().setLevel('casual');
  useOnboarding.getState().setDailyGoal(20);
  const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  expect(raw).not.toBeNull();
  expect(JSON.parse(raw ?? '{}')).toMatchObject({
    state: { why: 'help_a_child', level: 'casual', dailyGoal: 20 },
  });
});

/**
 * The coupling `playwright.config.ts` depends on. A seed that stopped matching
 * zustand's envelope would not throw: the store would keep its defaults, `/`
 * would redirect to onboarding, and twenty specs would fail somewhere else with
 * a message about Today. So the real store is hydrated from the real seed here.
 */
test('the e2e seed really hydrates the store as a learner who has been through onboarding', async () => {
  localStorage.setItem(ONBOARDED_KEY, ONBOARDED_VALUE);
  await useOnboarding.persist.rehydrate();
  const s = useOnboarding.getState();
  expect(onboardingAnswered(s)).toBe(true);
  expect(s.level).toBe('new');
  expect(s.placedUnit).toBeNull();
  /*
   * Non-vacuous. The assertions above would hold just as well if `rehydrate` had
   * done nothing, so the control is the same seed under a different key: the
   * store goes back to its defaults, which is exactly what the specs would see
   * if the key ever drifted. `reset()` runs FIRST, because it persists — putting
   * it after the `removeItem` would write the key back and the control would be
   * measuring its own side effect.
   */
  useOnboarding.getState().reset();
  localStorage.removeItem(ONBOARDED_KEY);
  localStorage.setItem(`${ONBOARDED_KEY}-elsewhere`, ONBOARDED_VALUE);
  await useOnboarding.persist.rehydrate();
  expect(onboardingAnswered(useOnboarding.getState())).toBe(false);
  expect(useOnboarding.getState().level).toBeNull();
});

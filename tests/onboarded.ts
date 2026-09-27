/**
 * The persisted onboarding record of a learner who has already been through the
 * three questions (PRD 8.1 F-ON-1 … F-ON-3).
 *
 * WHY THIS EXISTS. F-ON-1 makes the coach's question the first screen a learner
 * with no record and no progress sees, so `/` redirects there. Every Playwright
 * spec that navigates to `./` is driving a RETURNING learner — its subject is
 * Today, the path, a lesson or a game — so `playwright.config.ts` seeds this into
 * `localStorage` for the whole suite and onboarding gets its own coverage from
 * the vitest suite plus a spec of its own.
 *
 * WHY IT IS SHARED RATHER THAN WRITTEN TWICE. The shape is zustand's persist
 * envelope, which is an implementation detail of a library, and a seed that
 * silently stopped matching it would not fail: the store would fall back to its
 * defaults, the redirect would fire, and every spec would fail somewhere else
 * with a message about Today. `store.test.ts` hydrates the real store from this
 * exact value, so the coupling is checked rather than assumed.
 */
export const ONBOARDED_KEY = 'chessapp-onboarding';

export const ONBOARDED_VALUE = JSON.stringify({
  state: {
    why: 'for_fun',
    // "New to chess", so no assessment is owed and Today offers no placement
    // test — the state the specs were written against.
    level: 'new',
    dailyGoal: 10,
    answeredAt: '2026-01-01T00:00:00.000Z',
    placedUnit: null,
  },
  version: 0,
});

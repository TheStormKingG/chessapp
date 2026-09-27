import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/data/db';
import { emptyProgress, localDay, useProgress, type Progress } from '@/data';
import { useProfileSeen } from '@/profile';
import { TodayScreen } from '@/screens/TodayScreen';

/**
 * F-EN-8, which is F-HM-6:
 *
 * > "After two consecutive losses in bot games the home screen suggests a
 * > cool-down (a lesson or puzzles) before the next game. The suggestion can be
 * > dismissed and is not shown more than once a day."
 *
 * The banner SHIPPED BEFORE THIS FILE, in `screens/TodayScreen.tsx`, and nothing
 * exercised it: the only reference to `chessapp.coolDownDismissed` anywhere in the
 * suite was `app/clearDeviceData.test.ts` asserting that clearing the device
 * removes the key. So the behaviour was untested in both directions — it could
 * have stopped appearing entirely and every test would still have passed.
 *
 * These tests do not change the feature. They record what it does, clause by
 * clause, including the one clause it reads more loosely than F-HM-6 states.
 */

const COPY = /Two losses in a row/i;
const KEY = 'chessapp.coolDownDismissed';

function renderToday(p: Progress) {
  useProgress.setState({ progress: p });
  render(
    <MemoryRouter>
      <TodayScreen />
    </MemoryRouter>,
  );
}

function losses(n: number): Progress {
  return { ...emptyProgress(), consecutiveLosses: n };
}

beforeEach(async () => {
  await db.events.clear();
  localStorage.removeItem(KEY);
  useProfileSeen.setState({ lastSeenReviews: 0 });
});
afterEach(() => {
  cleanup();
});

test('one loss is not two, and two losses bring the suggestion', () => {
  renderToday(losses(1));
  expect(screen.queryByText(COPY)).toBeNull();
  cleanup();
  // The positive control the absence above needs: the same screen with one more
  // loss does show it.
  renderToday(losses(2));
  expect(screen.getByText(COPY)).toBeInTheDocument();
});

test('the counter is bot games only, because nothing else appends game_finished', () => {
  // `Progress.consecutiveLosses` is moved by the `game_finished` arm of
  // `data/reduce.ts`, and `play/useGame.ts` is the only place in `src/` that
  // appends one — an imported game banks `game_reviewed` and never
  // `game_finished` (`import/reviewSource.ts`). So "in bot games" is satisfied by
  // the shape of the log rather than by a filter, which is worth recording because
  // the day something else appends a `game_finished`, this requirement changes
  // silently and no test here would notice.
  renderToday(losses(3));
  expect(screen.getByText(COPY)).toBeInTheDocument();
});

test('the suggestion can be dismissed, and the dismissal is for the day', async () => {
  renderToday(losses(2));
  await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
  expect(screen.queryByText(COPY)).toBeNull();
  expect(localStorage.getItem(KEY)).toBe(localDay(new Date()));

  // It survives leaving the screen and coming back, which is what "for the day"
  // has to mean on a screen the learner opens repeatedly.
  cleanup();
  renderToday(losses(2));
  expect(screen.queryByText(COPY)).toBeNull();
});

test("yesterday's dismissal does not suppress today's suggestion", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  localStorage.setItem(KEY, localDay(yesterday));
  renderToday(losses(2));
  expect(screen.getByText(COPY)).toBeInTheDocument();
});

test('the suggestion offers the two things F-HM-6 names, and they are reachable beside it', () => {
  renderToday(losses(2));
  const banner = screen.getByText(COPY);
  expect(banner.textContent ?? '').toMatch(/lesson/i);
  // "a lesson or puzzles": the lesson is the screen's own card and the puzzle is
  // the tile directly beneath the banner. The banner itself carries no link —
  // it names them and the destinations are adjacent.
  expect(screen.getByRole('link', { name: /Puzzle/ })).toHaveAttribute('href', '/puzzles/daily');
  expect(banner.closest('[role="status"]')).not.toBeNull();
});

test('UNDISMISSED, the suggestion reappears on every visit that day', () => {
  /*
   * THE CLAUSE THIS READS LOOSELY, recorded rather than asserted as correct.
   *
   * F-HM-6 says the suggestion "is not shown more than once a day". The condition
   * in `TodayScreen.tsx` is `consecutiveLosses >= 2 && dismissedOn !== today`, so
   * what is capped at once a day is the DISMISSAL, not the appearance: a learner
   * who leaves the banner alone sees it again every time they open Today.
   *
   * Whether that is the intended reading is a product decision and not one this
   * test makes. What it does is stop the behaviour changing by accident in either
   * direction, and give the next person the sentence to argue with.
   */
  renderToday(losses(2));
  expect(screen.getByText(COPY)).toBeInTheDocument();
  cleanup();
  renderToday(losses(2));
  expect(screen.getByText(COPY)).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
});

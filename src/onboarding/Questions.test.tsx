import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { coachName } from '@/coach';
import { GoalScreen, LevelScreen, WhyScreen } from './Questions';
import { useOnboarding } from './store';
import { GOAL_OPTIONS, LEVEL_OPTIONS, WHY_OPTIONS } from './types';

/** The three question screens plus a stub for everywhere they can send you. */
function renderFlow(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/onboarding" element={<WhyScreen />} />
        <Route path="/onboarding/level" element={<LevelScreen />} />
        <Route path="/onboarding/goal" element={<GoalScreen />} />
        <Route path="/onboarding/placement" element={<h1>Placement test</h1>} />
        {/* F-IM-5's fourth route. Stubbed like the others: what this file tests is
            where the questions SEND the learner, not what the destination does. */}
        <Route path="/onboarding/import" element={<h1>Import your games</h1>} />
        <Route path="/" element={<h1>Today</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useOnboarding.getState().reset();
});

/* --------------------------------------------------------------- F-ON-1 */

test('the first screen introduces the coach and asks one question with six answers', () => {
  renderFlow('/onboarding');
  expect(screen.getByRole('heading', { name: 'Why chess?' })).toBeInTheDocument();
  // "Introduces the coach": the app's one coach voice, announced as the coach
  // speaking rather than as page text.
  const intro = screen.getByRole('note', { name: `${coachName} says` });
  expect(intro).toHaveTextContent(/your coach/i);
  // F-ON-1 asks for four to six answers and names six.
  expect(WHY_OPTIONS).toHaveLength(6);
  for (const o of WHY_OPTIONS) {
    expect(screen.getByRole('button', { name: new RegExp(o.label, 'i') })).toBeInTheDocument();
  }
  // One question, not two: nothing else on the screen is a fieldset.
  expect(screen.getAllByRole('group')).toHaveLength(1);
});

test('the answer is stored, and it is announced as chosen in more than a colour', async () => {
  renderFlow('/onboarding');
  const option = screen.getByRole('button', { name: /Help a child learn/i });
  // The control's own state, which is what a screen reader reads.
  expect(option).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(option);
  expect(option).toHaveAttribute('aria-pressed', 'true');
  expect(useOnboarding.getState().why).toBe('help_a_child');
  // ...and a glyph, so the choice survives the colour being removed. The
  // positive control is the unchosen option beside it: the tick is on one and
  // not the other, so it is state and not decoration.
  expect(option).toHaveTextContent('✓');
  expect(screen.getByRole('button', { name: /Just curious/i })).not.toHaveTextContent('✓');
});

test('the screen cannot be advanced without an answer, and says so', async () => {
  renderFlow('/onboarding');
  const next = screen.getByRole('button', { name: 'Next' });
  expect(next).toBeDisabled();
  expect(screen.getByText('Choose one to carry on.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Just for fun/i }));
  expect(next).toBeEnabled();
  // The hint goes when it stops being true, rather than sitting under an
  // enabled control.
  expect(screen.queryByText('Choose one to carry on.')).toBeNull();
  await userEvent.click(next);
  expect(screen.getByRole('heading', { name: /How much chess/i })).toBeInTheDocument();
});

/* --------------------------------------------------------------- F-ON-2 */

test('the level screen offers four options and says where each one leads', async () => {
  renderFlow('/onboarding/level');
  expect(LEVEL_OPTIONS).toHaveLength(4);
  for (const o of LEVEL_OPTIONS) {
    expect(screen.getByRole('button', { name: new RegExp(o.label, 'i') })).toBeInTheDocument();
  }
  // The consequence of each answer is on screen before the answer is given.
  expect(screen.getByText(/Start at the very beginning/)).toBeInTheDocument();
  expect(screen.getByText(/five-question check on the rules/)).toBeInTheDocument();
  expect(screen.getAllByText(/placement test finds the right place/)).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: /I play casually/i }));
  expect(useOnboarding.getState().level).toBe('casual');
});

/* --------------------------------------------------------------- F-ON-3 */

test('the goal screen offers 5, 10, 15 and 20 minutes and explains what the answer is for', () => {
  renderFlow('/onboarding/goal');
  expect(GOAL_OPTIONS.map((o) => o.value)).toEqual([5, 10, 15, 20]);
  for (const o of GOAL_OPTIONS) {
    // Anchored: "5 minutes" is a substring of "15 minutes", so an unanchored
    // match finds two buttons and the assertion that looks strictest is the one
    // that cannot run.
    expect(screen.getByRole('button', { name: new RegExp(`^\\s*✓?\\s*${o.value} minutes$`) })).toBeInTheDocument();
  }
  // F-ON-3: "explains that the daily plan will be sized to it".
  expect(screen.getByText(/plan is cut to fit the time you pick/i)).toBeInTheDocument();
});

test('the goal opens on a real default, so the last screen is never a dead end', async () => {
  renderFlow('/onboarding/goal');
  const ten = screen.getByRole('button', { name: /10 minutes/ });
  expect(ten).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Start learning' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: /20 minutes/ }));
  expect(useOnboarding.getState().dailyGoal).toBe(20);
  expect(ten).toHaveAttribute('aria-pressed', 'false');
});

/* ------------------------------------------------- F-ON-2's routing, live */

test('the last screen records the answers and routes on the level given', async () => {
  useOnboarding.getState().setLevel('casual');
  renderFlow('/onboarding/goal');
  expect(useOnboarding.getState().answeredAt).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
  expect(useOnboarding.getState().answeredAt).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Placement test' })).toBeInTheDocument();
});

test('"new to chess" goes straight to the path, with no test in between', async () => {
  useOnboarding.getState().setLevel('new');
  renderFlow('/onboarding/goal');
  await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
  // The other partition, asserted rather than assumed: this answer reaches
  // Today, and the one above reaches the test. A route that always went to
  // Today would satisfy only one of the two.
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Placement test' })).toBeNull();
});

test('"I know the rules" also goes to the assessment route, which runs the rules check', async () => {
  useOnboarding.getState().setLevel('know_rules');
  renderFlow('/onboarding/goal');
  await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
  expect(screen.getByRole('heading', { name: 'Placement test' })).toBeInTheDocument();
});

/*
 * This test previously asserted that "I play online already" landed on the
 * placement test "because import is not built". F-IM-5 is now built, so that
 * premise is gone and the claim it made has genuinely changed rather than merely
 * broken: the learner reaches import first.
 *
 * The placement fallback it used to guard has NOT been dropped — it moved to the
 * far side of the import, where the game count exists, and is asserted in
 * ./importHandoff.test.tsx ("fewer than ten games takes F-ON-2 placement-test
 * fallback"). Both halves of F-ON-2 are therefore still pinned, one at each end.
 */
test('"I play online already" reaches F-IM-5’s import route, not the placement test', async () => {
  useOnboarding.getState().setLevel('plays_online');
  renderFlow('/onboarding/goal');
  await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
  expect(screen.getByRole('heading', { name: 'Import your games' })).toBeInTheDocument();
  // The positive control for the absence: the placement heading IS found by this
  // same query for a 'casual' learner (the test above), so its absence here is the
  // routing decision and not a query that never matches.
  expect(screen.queryByRole('heading', { name: 'Placement test' })).toBeNull();
});

/* ------------------------------------------------------------ the way out */

test.each([
  ['/onboarding', 'Why chess?'],
  ['/onboarding/level', /How much chess/],
  ['/onboarding/goal', /How long a day/],
])('%s can be left, and leaving does not ask the questions again', async (at, heading) => {
  renderFlow(at);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Skip setup' }));
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  // The record is what stops Today sending the learner back here for ever.
  expect(useOnboarding.getState().answeredAt).not.toBeNull();
});

test('nothing in onboarding asks the learner to sign up or sign in (F-ON-4)', async () => {
  for (const at of ['/onboarding', '/onboarding/level', '/onboarding/goal']) {
    const { unmount } = renderFlow(at);
    // The positive control for the absence: the same query shape DOES find the
    // screen's own controls, so a query that matched nothing at all would be
    // caught here rather than passing as a clean bill of health.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3);
    expect(screen.queryByText(/sign up|sign in|create an account|email/i)).toBeNull();
    unmount();
  }
});

test('no screen spends the display-lg role, which the design system reserves for two places', () => {
  for (const at of ['/onboarding', '/onboarding/level', '/onboarding/goal']) {
    const { container, unmount } = renderFlow(at);
    expect(container.querySelector('.t-display-lg')).toBeNull();
    // Non-vacuous: the screen does carry the role below it.
    expect(container.querySelector('.t-display')).not.toBeNull();
    unmount();
  }
});

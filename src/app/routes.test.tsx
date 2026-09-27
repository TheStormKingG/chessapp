import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { emptyProgress, useProgress } from '@/data';
import { useOnboarding } from '@/onboarding/store';
import { AppRoutes } from './routes';


beforeEach(() => {
  useOnboarding.getState().reset();
  useProgress.setState({ progress: emptyProgress() });
});

test('an unknown route renders a not-found message with a way back', () => {
  render(
    <MemoryRouter initialEntries={['/pla']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: /page is not here|not found/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to Today' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to the Path' })).toBeInTheDocument();
  const main = document.querySelector('main');
  expect((main?.textContent ?? '').trim().length).toBeGreaterThan(0);
});

test('a browsable section keeps the tab bar', () => {
  render(
    <MemoryRouter initialEntries={['/puzzles']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
});

// The modal tasks are rendered outside the shell, so the tab bar cannot
// invite a learner to navigate away mid-task (DESIGN-SYSTEM.md B1). Each one
// loads its own content asynchronously, so this asserts on the chrome around
// them — which is the whole of what the chunk changed — and the Playwright
// suite asserts that each one's dismiss control is on screen.
//
// The four puzzle routes join them: solving is one focused task with one way
// out (design spec §5.2). The counterpart is 'a browsable section keeps the
// tab bar' above, which renders /puzzles itself and REQUIRES the navigation —
// without it, putting the whole Puzzles tab inside a modal would satisfy every
// assertion here and destroy the tab.
//
// There is deliberately NO test of route ORDER. React Router 7 ranks by
// specificity, not declaration order, so such a test passes with the routes in
// either position and proves nothing. The review feature's plan claimed
// otherwise and was wrong.
test.each([
  '/lesson/1.1.1',
  '/checkpoint/1.1',
  '/play/game',
  '/puzzles/rated',
  '/puzzles/themed',
  '/puzzles/daily',
  '/puzzles/fix',
])('%s is presented without the tab bar', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  expect(document.querySelector('main')).toBeInTheDocument();
});

/**
 * The same invariant, held AFTER the split chunk has arrived.
 *
 * The four puzzle routes are `React.lazy` (routes.tsx), so the assertions
 * above now run against a suspended tree — they prove the frame survives the
 * WAIT. Nothing proved the frame survives the ARRIVAL, and nothing proved the
 * chunk arrives at all: a lazy import that never resolved would leave a blank
 * modal for ever and every other test here would still pass.
 *
 * The counterpart to the boundary's placement: `Suspense` sits INSIDE
 * `ModalTask`, so moving it outside takes the `<main>` away while the chunk is
 * in flight and fails the cases above instead.
 */
test.each(['/puzzles/rated', '/puzzles/themed', '/puzzles/daily', '/puzzles/fix'])(
  '%s is still a modal task once its lazy chunk has loaded',
  async (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    // Every task in this frame owns its own dismiss control (ModalTask's
    // docblock), so finding one is how a test says "the route is really here".
    //
    // Re-QUERIED inside waitFor rather than held as a handle. `/puzzles/fix`
    // paints its dismiss control, then loads the learner's error log from
    // Dexie and re-renders, which DETACHES the node the first query returned.
    // `await findByRole(...)` then resolves with an element that is no longer
    // in the document by the time the assertion runs, and the failure reads
    // "element could not be found in the document" — which looks like the
    // route never rendered and is the opposite of what happened.
    //
    // Measured at 3-4 failures in every 8 runs, only ever on /puzzles/fix.
    // Raising findByRole's timeout does NOT help, because the wait is not the
    // problem: the element arrives on time and then leaves.
    //
    // The re-render is real product behaviour, not a test artefact — a learner
    // with a slow database sees that same swap — so the test waits for the
    // settled state rather than asserting on the first paint.
    //
    // THE SECOND FAILURE MODE, and it is not the one above. The note above is
    // about a node that ARRIVES and then detaches; raising a timeout cannot
    // help there, and the note says so. This is the case the docblock names as
    // unproven -- the chunk not arriving at all -- and it presents differently:
    // an empty `<main>`, and a failure at about 1.1s.
    //
    // 1.1s is `waitFor`'s OWN default of 1000ms, not the 5s test timeout, which
    // is why raising `testTimeout` changed nothing when I tried it. The budget
    // that matters is this one, and a real dynamic import on a loaded machine
    // does not finish inside a second: these four pass alone and fail once the
    // file shares a worker with most of a 122-file suite.
    //
    // Fifteen seconds is for the import, not for the assertion. If the chunk
    // genuinely never resolves the test still fails, just later -- which is the
    // invariant this block exists to hold.
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /back to puzzles|close/i })).toBeInTheDocument();
      },
      { timeout: 15_000 },
    );
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
  },
);

// The review is the fourth modal task. Like its neighbours it loads its own
// content asynchronously, so this asserts on the chrome: a modal task has no
// tab bar — one focused task, one way out.
test('the review is a modal task, not a shell section', () => {
  render(
    <MemoryRouter initialEntries={['/play/review/g1']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  expect(document.querySelector('main')).toBeInTheDocument();
});

/*
 * Onboarding (PRD 8.1). Two claims, and neither implies the other: a new
 * learner's first screen is the coach's question rather than Today (F-ON-1), and
 * a learner who was already learning before onboarding existed is left alone.
 */
test("a new learner opening the app gets the coach's question, not Today", () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Why chess?' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull();
});

test('a learner who has already done something is never sent back to onboarding', () => {
  // No onboarding record, which is every learner who installed the app before
  // this feature existed — but a log with something in it.
  expect(useOnboarding.getState().answeredAt).toBeNull();
  useProgress.setState({ progress: { ...emptyProgress(), lastEventAt: '2026-01-01T00:00:00.000Z' } });
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Why chess?' })).toBeNull();
});

test('answering the questions is what stops the redirect, whatever the log says', () => {
  useOnboarding.getState().markAnswered();
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
});

test('onboarding is presented without the tab bar, like every other focused task', () => {
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  expect(document.querySelector('main')).toBeInTheDocument();
  // ...and it owns a way out, which is the invariant ModalTask asks every task
  // in its frame to keep.
  expect(screen.getByRole('button', { name: 'Skip setup' })).toBeInTheDocument();
});

test('an unknown onboarding route is the first question rather than a dead end', () => {
  render(
    <MemoryRouter initialEntries={['/onboarding/nope']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Why chess?' })).toBeInTheDocument();
});

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from './routes';

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
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to puzzles|close/i })).toBeInTheDocument();
    });
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

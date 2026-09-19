import { render, screen } from '@testing-library/react';
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

// The three modal tasks are rendered outside the shell, so the tab bar cannot
// invite a learner to navigate away mid-task (DESIGN-SYSTEM.md B1). Each one
// loads its own content asynchronously, so this asserts on the chrome around
// them — which is the whole of what the chunk changed — and the Playwright
// suite asserts that each one's dismiss control is on screen.
test.each(['/lesson/1.1.1', '/checkpoint/1.1', '/play/game'])('%s is presented without the tab bar', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  expect(document.querySelector('main')).toBeInTheDocument();
});

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

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

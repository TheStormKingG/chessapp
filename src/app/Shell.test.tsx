import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Shell } from './Shell';

test('shell shows the five tabs', () => {
  render(
    <MemoryRouter>
      <Shell><div>content</div></Shell>
    </MemoryRouter>,
  );
  for (const label of ['Today', 'Path', 'Puzzles', 'Play', 'Progress']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }
  expect(screen.getByText('content')).toBeInTheDocument();
});

test('only the matching tab is marked current', () => {
  render(
    <MemoryRouter initialEntries={['/puzzles']}>
      <Shell><div>content</div></Shell>
    </MemoryRouter>,
  );
  const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
  expect(current).toHaveLength(1);
  expect(current[0]).toHaveTextContent('Puzzles');
  expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
});

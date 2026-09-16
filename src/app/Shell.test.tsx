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

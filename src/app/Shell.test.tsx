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

// H-2: every tab carries a vector symbol as well as its label. The symbol is
// decoration on top of the label, so it is aria-hidden and the label stays the
// accessible name; and it is never an emoji (hard constraint 8).
test('every tab carries a vector symbol beside a text label it does not replace', () => {
  render(
    <MemoryRouter>
      <Shell><div>content</div></Shell>
    </MemoryRouter>,
  );
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(5);
  for (const a of links) {
    const svg = a.querySelector('svg');
    expect(svg, `${a.textContent ?? ''} has no symbol`).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(a.textContent?.trim()).toBeTruthy();
    // Anything outside Latin-1 here would be an emoji or a glyph font.
    expect(a.textContent ?? '').toMatch(/^[\x20-\x7E]+$/);
  }
});

test('the active tab is the filled symbol, not a recoloured outline', () => {
  render(
    <MemoryRouter initialEntries={['/path']}>
      <Shell><div>content</div></Shell>
    </MemoryRouter>,
  );
  const active = screen.getByRole('link', { name: 'Path' }).querySelector('svg');
  const idle = screen.getByRole('link', { name: 'Today' }).querySelector('svg');
  expect(active?.getAttribute('fill')).toBe('currentColor');
  expect(idle?.getAttribute('fill')).toBe('none');
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

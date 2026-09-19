import { render, screen } from '@testing-library/react';
import { LicencesScreen } from './LicencesScreen';

// We ship `public/data/openings.txt`, derived from lichess-org/chess-openings.
// It is data we redistribute, so it belongs on this screen for the same reason
// every bundled library does: the screen's own promise is that EVERY
// third-party component we ship is listed here with its licence.
test('the bundled opening book is listed with its licence and a resolving link', () => {
  render(<LicencesScreen />);
  const card = screen.getAllByRole('listitem').find((li) => /chess-openings/i.test(li.textContent ?? ''));
  expect(card).toBeDefined();
  expect(card).toHaveTextContent('CC0-1.0');
  expect(card?.querySelector('a')?.getAttribute('href')).toBe('https://github.com/lichess-org/chess-openings');
});

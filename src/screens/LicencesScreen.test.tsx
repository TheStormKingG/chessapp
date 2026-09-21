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

// We ship `public/data/puzzles/*.txt` — 7,909 records derived by
// `scripts/build-puzzles.mjs` from the Lichess puzzle database. That is a
// SECOND Lichess asset, not the opening book above: PRD Appendix D lists the
// opening names and the puzzle dump as separate rows, and the screen's promise
// is that every third-party component we ship is listed with its licence.
test('the bundled puzzle packs are listed with their licence and a resolving link', () => {
  render(<LicencesScreen />);
  const card = screen
    .getAllByRole('listitem')
    .find((li) => /puzzle database/i.test(li.textContent ?? ''));
  expect(card).toBeDefined();
  expect(card).toHaveTextContent('CC0-1.0');
  expect(card?.querySelector('a')?.getAttribute('href')).toBe('https://database.lichess.org/');
});

// The puzzle database is a DIFFERENT entry from the opening book, and the
// count is the cheapest way to say so: a change that renames one into the
// other, or drops either, leaves eleven cards standing only if both are there.
test('the puzzle database and the opening book are two entries, not one', () => {
  render(<LicencesScreen />);
  const cards = screen.getAllByRole('listitem').filter((li) => li.querySelector('h2'));
  expect(cards).toHaveLength(11);
  expect(cards.filter((li) => /lichess/i.test(li.textContent ?? ''))).toHaveLength(2);
});

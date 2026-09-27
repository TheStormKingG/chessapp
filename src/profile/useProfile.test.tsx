import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test } from 'vitest';
import { db } from '@/data/db';
import { useImportSettings } from '@/import/settings';
import { newEvent } from '@/data/events';
import type { ImportedGameRow } from '@/import/types';
import { useProfile } from './useProfile';
import { useProfileSeen } from './seen';
import { aGame } from './testGames';

/**
 * `useProfile` against a real (fake-indexeddb) database.
 *
 * The pure projection is tested in buildProfile.test.ts. What is only testable here
 * is the READ: that the hook reaches all three tables, that an imported game and an
 * in-app game both arrive, and that the bullet switch is honoured through the store
 * rather than only through the option.
 */

function Probe() {
  const { profile, undateable } = useProfile();
  if (profile === null) return <p>loading</p>;
  return (
    <div>
      <p data-testid="games">{profile.games}</p>
      <p data-testid="undateable">{undateable}</p>
      <p data-testid="top">{profile.weaknesses[0]?.theme ?? 'none'}</p>
    </div>
  );
}

function show() {
  return render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
}

function row(over: Partial<ImportedGameRow> & { gameId: string }): ImportedGameRow {
  return {
    source: 'lichess',
    learner: 'w',
    opponent: 'someone',
    result: 'win',
    speed: 'rapid',
    playedAt: '2026-04-04T10:00:00.000Z',
    sans: ['e4'],
    pgn: '1. e4',
    learnerElo: null,
    opponentElo: null,
    importedAt: '2026-09-01T00:00:00.000Z',
    analysis: 'done',
    ...over,
  };
}

beforeEach(async () => {
  await db.reviews.clear();
  await db.imported.clear();
  await db.events.clear();
  useImportSettings.setState({ includeBullet: false });
  useProfileSeen.setState({ lastSeen: null, lastSeenReviews: null });
});

test('an imported game with a review reaches the profile', async () => {
  await db.imported.put(row({ gameId: 'i1' }));
  await db.reviews.put(
    aGame({ gameId: 'i1', moves: [{ label: 'Mistake', drop: 30 }], errors: [{ theme: 'hung_piece', ply: 0 }] }).review,
  );
  show();
  await waitFor(() => {
    expect(screen.getByTestId('games')).toHaveTextContent('1');
  });
  expect(screen.getByTestId('top')).toHaveTextContent('hung_piece');
  expect(screen.getByTestId('undateable')).toHaveTextContent('0');
});

test('an in-app game with a review reaches the profile through the event log', async () => {
  await db.events.bulkAdd([
    newEvent({ type: 'game_started', gameId: 'g1', persona: 'rosa', color: 'w', timeControl: 'untimed', coach: true }),
    newEvent({ type: 'game_finished', gameId: 'g1', result: 'win', moves: 20, hints: 0, takebacks: 0, crowns: 3, pgn: 'e4 e5' }),
  ]);
  await db.reviews.put(aGame({ gameId: 'g1' }).review);
  show();
  await waitFor(() => {
    expect(screen.getByTestId('games')).toHaveTextContent('1');
  });
});

test('a review with no provenance is counted as undateable and left out', async () => {
  await db.reviews.put(aGame({ gameId: 'orphan' }).review);
  show();
  await waitFor(() => {
    expect(screen.getByTestId('undateable')).toHaveTextContent('1');
  });
  expect(screen.getByTestId('games')).toHaveTextContent('0');
});

test('the bullet switch is read from the import settings store', async () => {
  await db.imported.put(row({ gameId: 'b1', speed: 'bullet' }));
  await db.reviews.put(aGame({ gameId: 'b1' }).review);

  const first = show();
  await waitFor(() => {
    expect(screen.getByTestId('games')).toHaveTextContent('0');
  });
  first.unmount();

  // F-IM-2's one switch. Flipping it must change the profile, or the setting is
  // decoration.
  useImportSettings.setState({ includeBullet: true });
  show();
  await waitFor(() => {
    expect(screen.getByTestId('games')).toHaveTextContent('1');
  });
});

test('a game imported but not yet analysed contributes nothing', async () => {
  // F-IM-3: "a game that has been imported but not yet analysed contributes
  // nothing to it, and counting it would overstate the profile's basis".
  await db.imported.put(row({ gameId: 'p1', analysis: 'pending' }));
  show();
  await waitFor(() => {
    expect(screen.getByTestId('games')).toHaveTextContent('0');
  });
  expect(screen.getByTestId('undateable')).toHaveTextContent('0');
});

test('an empty database produces an empty profile rather than a permanent loading state', async () => {
  show();
  await waitFor(() => {
    expect(screen.getByTestId('games')).toHaveTextContent('0');
  });
  expect(screen.queryByText('loading')).toBeNull();
});

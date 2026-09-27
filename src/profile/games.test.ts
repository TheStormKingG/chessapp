import { expect, test } from 'vitest';
import { newEvent, type LearnerEvent } from '@/data/events';
import type { ImportedGameRow } from '@/import/types';
import { profileGamesFrom } from './games';
import { aGame } from './testGames';

const review = (gameId: string) => aGame({ gameId }).review;

function importedRow(over: Partial<ImportedGameRow> & { gameId: string }): ImportedGameRow {
  return {
    source: 'lichess',
    learner: 'w',
    opponent: 'someone',
    result: 'win',
    speed: 'blitz',
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

function startFinish(gameId: string, result: 'win' | 'loss' | 'draw', at: string): LearnerEvent[] {
  const started = newEvent(
    { type: 'game_started', gameId, persona: 'rosa', color: 'w', timeControl: 'untimed', coach: true },
    new Date(at),
  );
  const finished = newEvent(
    { type: 'game_finished', gameId, result, moves: 30, hints: 0, takebacks: 0, crowns: 3, pgn: 'e4 e5' },
    new Date(at),
  );
  return [started, finished];
}

test('an imported game takes its date, result and speed from the imported row', () => {
  const r = profileGamesFrom({
    reviews: [review('imp1')],
    imported: [importedRow({ gameId: 'imp1', playedAt: '2019-07-07T12:00:00.000Z', result: 'loss', speed: 'bullet' })],
    events: [],
  });
  expect(r.undateable).toBe(0);
  expect(r.games).toHaveLength(1);
  expect(r.games[0]).toMatchObject({
    gameId: 'imp1',
    playedAt: '2019-07-07T12:00:00.000Z',
    result: 'loss',
    speed: 'bullet',
  });
});

test('an in-app game takes its date from game_started and its result from game_finished', () => {
  const at = '2026-05-05T09:30:00.000Z';
  const r = profileGamesFrom({
    reviews: [review('own1')],
    imported: [],
    events: startFinish('own1', 'draw', at),
  });
  expect(r.undateable).toBe(0);
  expect(r.games[0]).toMatchObject({ gameId: 'own1', result: 'draw', speed: 'in-app' });
  expect(r.games[0]?.playedAt).toBe(new Date(at).toISOString());
});

test('the date is when the game was PLAYED, never when the review ran', () => {
  // The failure this prevents: an imported 2019 game analysed this morning would
  // sit at the top of the recency ranking, and every number would look ordinary.
  const rev = review('imp2');
  expect(rev.createdAt).not.toBe('2019-01-01T00:00:00.000Z');
  const r = profileGamesFrom({
    reviews: [rev],
    imported: [importedRow({ gameId: 'imp2', playedAt: '2019-01-01T00:00:00.000Z' })],
    events: [],
  });
  expect(r.games[0]?.playedAt).toBe('2019-01-01T00:00:00.000Z');
  expect(r.games[0]?.playedAt).not.toBe(rev.createdAt);
});

test('a review with no imported row and no events is dropped and counted', () => {
  const r = profileGamesFrom({ reviews: [review('orphan')], imported: [], events: [] });
  expect(r.games).toEqual([]);
  expect(r.undateable).toBe(1);
});

test('a half-recorded in-app game is dropped rather than half-guessed', () => {
  // A game that started and never finished has no result. Assuming a draw, or a
  // loss, would put a fabricated result into the openings table.
  const started = newEvent(
    { type: 'game_started', gameId: 'half', persona: 'rosa', color: 'w', timeControl: 'untimed', coach: true },
    new Date('2026-01-01T00:00:00.000Z'),
  );
  const r = profileGamesFrom({ reviews: [review('half')], imported: [], events: [started] });
  expect(r.games).toEqual([]);
  expect(r.undateable).toBe(1);
  // Positive control: adding the finish makes it dateable, so the drop above is
  // about the missing result and not about a broken join.
  const finished = newEvent(
    { type: 'game_finished', gameId: 'half', result: 'win', moves: 4, hints: 0, takebacks: 0, crowns: 3, pgn: 'e4 e5' },
    new Date('2026-01-01T00:05:00.000Z'),
  );
  const r2 = profileGamesFrom({ reviews: [review('half')], imported: [], events: [started, finished] });
  expect(r2.games).toHaveLength(1);
  expect(r2.undateable).toBe(0);
});

test('imported and in-app games come back in one list', () => {
  const r = profileGamesFrom({
    reviews: [review('imp'), review('own')],
    imported: [importedRow({ gameId: 'imp' })],
    events: startFinish('own', 'win', '2026-06-06T00:00:00.000Z'),
  });
  expect(r.games).toHaveLength(2);
  expect(r.games.map((g) => g.speed).sort()).toEqual(['blitz', 'in-app']);
});

test('the imported row wins when a gameId appears on both sides', () => {
  // Not expected, but the row is the more specific record: it carries the source
  // site's own speed and date, and the event log would only have "in-app".
  const r = profileGamesFrom({
    reviews: [review('both')],
    imported: [importedRow({ gameId: 'both', speed: 'rapid', result: 'loss' })],
    events: startFinish('both', 'win', '2026-06-06T00:00:00.000Z'),
  });
  expect(r.games).toHaveLength(1);
  expect(r.games[0]?.speed).toBe('rapid');
  expect(r.games[0]?.result).toBe('loss');
});

test('unrelated events do not become games', () => {
  const noise = [
    newEvent({ type: 'lesson_started', lessonId: '1.1.1' }),
    newEvent({ type: 'puzzle_attempted', puzzleId: 'p1', themes: [], puzzleRating: 800, solved: true, hinted: false, misses: 0, source: 'rated', ms: 900 }),
  ];
  const r = profileGamesFrom({ reviews: [], imported: [], events: noise });
  expect(r.games).toEqual([]);
  expect(r.undateable).toBe(0);
});

test('a game with events but no review is not in the profile', () => {
  // F-IM-3: "a game that has been imported but not yet analysed contributes
  // nothing to it". The reviews list is the denominator, not the event log.
  const r = profileGamesFrom({
    reviews: [],
    imported: [importedRow({ gameId: 'pending', analysis: 'pending' })],
    events: startFinish('unreviewed', 'win', '2026-06-06T00:00:00.000Z'),
  });
  expect(r.games).toEqual([]);
});

import Dexie from 'dexie';
import { newEvent } from './events';

/**
 * §D of the plan: the v3 bump is the one irreversible change in this feature.
 * This exercises it against a throwaway database and asserts the outcome; it
 * does not print a log for somebody to skim.
 */

const NAME = 'chessapp-migration-probe';

async function seedV2() {
  const old = new Dexie(NAME);
  old.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
  old.version(2).stores({ resume: 'lessonId' });
  await old.open();
  await old.table('events').bulkAdd([
    newEvent({ type: 'lesson_started', lessonId: '1.1.1' }),
    newEvent({ type: 'game_finished', gameId: 'g1', result: 'win', moves: 30, hints: 0, takebacks: 0, crowns: 3, pgn: 'e4 e5' }),
  ]);
  await old.table('games').add({
    id: 'g1', pgn: 'e4 e5', fen: 'x', persona: 'rosa', color: 'w',
    startedAt: '2026-09-19T00:00:00.000Z', finishedAt: null, result: null,
  });
  await old.table('resume').add({
    lessonId: '1.1.1', challengeId: 'c1', index: 0, challengeCount: 5,
    results: {}, totalHints: 0, totalMisses: 0, savedAt: '2026-09-19T00:00:00.000Z',
  });
  old.close();
}

function openV3() {
  const next = new Dexie(NAME);
  next.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
  next.version(2).stores({ resume: 'lessonId' });
  next.version(3).stores({ reviews: 'gameId, createdAt' });
  return next;
}

test('the v3 upgrade keeps every v2 row and adds a usable reviews table', async () => {
  await Dexie.delete(NAME);
  await seedV2();

  const next = openV3();
  await next.open();

  // Nothing was lost.
  expect(await next.table('events').count()).toBe(2);
  expect(await next.table('games').count()).toBe(1);
  expect(await next.table('resume').count()).toBe(1);
  expect((await next.table('resume').get('1.1.1'))?.challengeId).toBe('c1');

  // The new table exists and round-trips.
  await next.table('reviews').put({ gameId: 'g1', createdAt: '2026-09-19T00:00:00.000Z', partial: false });
  expect((await next.table('reviews').get('g1'))?.partial).toBe(false);

  // And it is indexed on createdAt, which the summary list will order by.
  expect(await next.table('reviews').orderBy('createdAt').count()).toBe(1);

  next.close();
  await Dexie.delete(NAME);
});

test('opening v3 on a fresh device works with no v2 data at all', async () => {
  await Dexie.delete(NAME);
  const next = openV3();
  await next.open();
  expect(await next.table('reviews').count()).toBe(0);
  expect(await next.table('events').count()).toBe(0);
  next.close();
  await Dexie.delete(NAME);
});

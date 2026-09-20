import Dexie from 'dexie';
import { newEvent } from './events';
import { db } from './db';

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

/**
 * Task 7: the v4 bump, the one irreversible change in the puzzles feature.
 *
 * These two exercise the APP's own upgrade chain — `db` from src/data/db.ts —
 * against the app's own database name, not a schema the test declared itself.
 * The plan's snippet builds its own `new Dexie(...)` with an explicit
 * `version(4)`, which would pass before and after the bump and verify nothing;
 * the plan says as much in its own Step 3, so this is the shape it asks for.
 *
 * They therefore use APP_NAME, which is not the fixed NAME the v3 probes above
 * use, and each deletes it at both ends. No fixture is shared in either
 * direction.
 */
const APP_NAME = 'chessapp';

test('a v3 database with real rows upgrades to v4 through db.ts and keeps every row', async () => {
  await Dexie.delete(APP_NAME);

  // Build a v3 database the way a real client has one: events, a resume row
  // and a review. Then open the app's db and assert nothing was lost.
  const v3 = new Dexie(APP_NAME);
  v3.version(1).stores({ events: 'id, createdAt, synced', games: 'id, startedAt' });
  v3.version(2).stores({ resume: 'lessonId' });
  v3.version(3).stores({ reviews: 'gameId, createdAt' });
  await v3.open();
  const seeded = newEvent({ type: 'lesson_started', lessonId: '1.1.1' });
  await v3.table('events').add(seeded);
  await v3.table('games').add({
    id: 'g1', pgn: 'e4 e5', fen: 'x', persona: 'rosa', color: 'w',
    startedAt: '2026-09-19T00:00:00.000Z', finishedAt: null, result: null,
  });
  await v3.table('resume').add({
    lessonId: '1.1.1', challengeId: 'c1', index: 2, challengeCount: 5,
    results: {}, totalHints: 0, totalMisses: 0, savedAt: '2026-09-19T00:00:00.000Z',
  });
  await v3.table('reviews').add({ gameId: 'g1', createdAt: '2026-09-02T00:00:00.000Z', partial: false });
  v3.close();

  // The upgrade under test is db.ts's own.
  await db.open();

  // Assert outcomes. Do not read output.
  expect(await db.table('events').count()).toBe(1);
  expect(await db.table('games').count()).toBe(1);
  expect(await db.table('resume').count()).toBe(1);
  expect(await db.table('reviews').count()).toBe(1);
  // A round-tripped payload, not just a row count: an upgrade that kept the
  // rows but mangled their contents would still count them.
  const back = await db.events.get(seeded.id);
  expect(back?.payload).toEqual({ type: 'lesson_started', lessonId: '1.1.1' });
  expect(back?.createdAt).toBe(seeded.createdAt);
  expect((await db.table('resume').get('1.1.1'))?.index).toBe(2);
  expect(await db.puzzles.count()).toBe(0);

  db.close();
  await Dexie.delete(APP_NAME);
});

test('the new table accepts and returns a pack row', async () => {
  await Dexie.delete(APP_NAME);
  await db.open();
  await db.puzzles.add({ band: '600-900', fetchedAt: '2026-09-19T00:00:00.000Z', count: 2700 });
  expect((await db.puzzles.get('600-900'))?.count).toBe(2700);
  // Indexed on fetchedAt, which the offline-availability screen will order by.
  expect(await db.puzzles.orderBy('fetchedAt').count()).toBe(1);
  db.close();
  await Dexie.delete(APP_NAME);
});

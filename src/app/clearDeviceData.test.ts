import { clearDeviceData } from './clearDeviceData';
import { db } from '@/data';

test('clearing device data removes the database and every chessapp key in localStorage', async () => {
  localStorage.setItem('chessapp-settings', '{"state":{"textEntry":true}}');
  localStorage.setItem('chessapp.install.dismissedAt', '123');
  localStorage.setItem('chessapp.coolDownDismissed', '2026-09-17');
  localStorage.setItem('unrelated-key', 'keep me');

  await clearDeviceData();

  expect(localStorage.getItem('chessapp-settings')).toBeNull();
  expect(localStorage.getItem('chessapp.install.dismissedAt')).toBeNull();
  expect(localStorage.getItem('chessapp.coolDownDismissed')).toBeNull();
  expect(localStorage.getItem('unrelated-key')).toBe('keep me');
  expect(db.isOpen()).toBe(false);
});

test('imported games and the import settings go with it, which is F-IM-7 deletion clause', async () => {
  /*
   * F-IM-7: "Imported game data belongs to the learner, is stored under their
   * account, and is covered by the same export and deletion rules as everything
   * else (F-AC-4)."
   *
   * Both halves are covered by existing mechanisms rather than by new code — the
   * whole database is deleted, and the import settings key starts with the
   * `chessapp` prefix this file clears by. That is a claim about behaviour, and
   * it is only true until someone stores import state somewhere else, so it is
   * asserted here rather than assumed from reading.
   */
  // The test above ends by deleting the database, and `db` is a module-level
  // singleton shared across this file, so it arrives here closed.
  if (!db.isOpen()) await db.open();
  await db.imported.put({
    gameId: 'cc-1',
    source: 'chess.com',
    learner: 'w',
    opponent: 'Rosa',
    result: 'win',
    speed: 'rapid',
    playedAt: '2026-09-20T00:00:00Z',
    sans: ['e4'],
    pgn: 'x',
    learnerElo: null,
    opponentElo: null,
    importedAt: '2026-09-20T00:00:00Z',
    analysis: 'pending',
  });
  await db.archives.put({ url: 'https://x.test/2026/08', body: '{}', fetchedAt: '2026-09-20T00:00:00Z', complete: true });
  localStorage.setItem('chessapp-import', '{"state":{"accounts":[{"username":"learner_one"}]}}');
  // The positive control: both rows really are there before the clear, so the
  // emptiness afterwards is the deletion and not a table that was never written.
  expect(await db.imported.count()).toBe(1);
  expect(await db.archives.count()).toBe(1);

  await clearDeviceData();

  expect(localStorage.getItem('chessapp-import')).toBeNull();
  expect(db.isOpen()).toBe(false);
  // Reopening yields an empty database rather than the rows above.
  await db.open();
  expect(await db.imported.count()).toBe(0);
  expect(await db.archives.count()).toBe(0);
});

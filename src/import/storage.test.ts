import { db } from '@/data/db';
import {
  FOREGROUND_COUNT,
  profileBasis,
  runBackgroundAnalysis,
  runForegroundAnalysis,
  type GameAnalyser,
} from './analysisQueue';
import {
  allImported,
  countAnalysed,
  countPendingAnalysis,
  deleteAllImported,
  importedById,
  markAnalysis,
  pendingAnalysis,
  readArchive,
  storeImported,
  writeArchive,
} from './storage';
import type { ImportedGame } from './types';

beforeEach(async () => {
  await db.imported.clear();
  await db.archives.clear();
});

function game(gameId: string, playedAt: string, over: Partial<ImportedGame> = {}): ImportedGame {
  return {
    gameId,
    source: 'chess.com',
    learner: 'w',
    opponent: 'Rosa',
    result: 'win',
    speed: 'rapid',
    playedAt,
    sans: ['e4', 'e5'],
    pgn: '[White "me"]\n\n1. e4 e5 1-0',
    learnerElo: 800,
    opponentElo: 810,
    ...over,
  };
}

describe('storeImported', () => {
  test('stores games as pending analysis', async () => {
    const r = await storeImported([game('a', '2026-09-20T00:00:00Z')]);
    expect(r).toEqual({ added: 1, alreadyHeld: 0 });
    const row = await importedById('a');
    expect(row?.analysis).toBe('pending');
    expect(row?.opponent).toBe('Rosa');
  });

  test('a re-import adds nothing and reports what was already held', async () => {
    await storeImported([game('a', '2026-09-20T00:00:00Z'), game('b', '2026-09-19T00:00:00Z')]);
    const again = await storeImported([game('a', '2026-09-20T00:00:00Z'), game('b', '2026-09-19T00:00:00Z')]);
    expect(again).toEqual({ added: 0, alreadyHeld: 2 });
    expect(await db.imported.count()).toBe(2);
  });

  test('a re-import does not reset the analysis state of a game already analysed', async () => {
    // This is what makes F-IM-7's "a re-import costs nothing" true. A bulkPut here
    // would silently turn every re-import into a full re-analysis.
    await storeImported([game('a', '2026-09-20T00:00:00Z')]);
    await markAnalysis('a', 'done');
    await storeImported([game('a', '2026-09-20T00:00:00Z')]);
    expect((await importedById('a'))?.analysis).toBe('done');
  });

  test('a duplicate inside one import is counted once', async () => {
    const r = await storeImported([game('a', '2026-09-20T00:00:00Z'), game('a', '2026-09-20T00:00:00Z')]);
    expect(r).toEqual({ added: 1, alreadyHeld: 1 });
  });

  test('storing nothing is not an error', async () => {
    expect(await storeImported([])).toEqual({ added: 0, alreadyHeld: 0 });
  });

  test('a partly-new import adds only the new games', async () => {
    await storeImported([game('a', '2026-09-20T00:00:00Z')]);
    const r = await storeImported([game('a', '2026-09-20T00:00:00Z'), game('b', '2026-09-21T00:00:00Z')]);
    expect(r).toEqual({ added: 1, alreadyHeld: 1 });
    expect(await db.imported.count()).toBe(2);
  });
});

describe('listing and queries', () => {
  test('allImported is newest first', async () => {
    await storeImported([
      game('old', '2026-01-01T00:00:00Z'),
      game('new', '2026-09-30T00:00:00Z'),
      game('mid', '2026-05-05T00:00:00Z'),
    ]);
    expect((await allImported()).map((g) => g.gameId)).toEqual(['new', 'mid', 'old']);
  });

  test('pendingAnalysis is newest first and respects its limit', async () => {
    await storeImported([
      game('a', '2026-09-01T00:00:00Z'),
      game('b', '2026-09-03T00:00:00Z'),
      game('c', '2026-09-02T00:00:00Z'),
    ]);
    expect((await pendingAnalysis(2)).map((g) => g.gameId)).toEqual(['b', 'c']);
  });

  test('an analysed game leaves the pending queue', async () => {
    await storeImported([game('a', '2026-09-01T00:00:00Z'), game('b', '2026-09-02T00:00:00Z')]);
    await markAnalysis('b', 'done');
    expect((await pendingAnalysis(10)).map((g) => g.gameId)).toEqual(['a']);
    expect(await countAnalysed()).toBe(1);
    expect(await countPendingAnalysis()).toBe(1);
  });

  test('a failed game also leaves the pending queue, so it is not retried for ever', async () => {
    await storeImported([game('a', '2026-09-01T00:00:00Z')]);
    await markAnalysis('a', 'failed');
    expect(await pendingAnalysis(10)).toEqual([]);
    expect(await countAnalysed()).toBe(0);
    // Positive control: the same query DOES return a pending row, so the empty
    // answer above is the state change and not a broken query.
    await storeImported([game('b', '2026-09-02T00:00:00Z')]);
    expect((await pendingAnalysis(10)).map((g) => g.gameId)).toEqual(['b']);
  });

  test('deleteAllImported removes games and cached archives, for F-AC-4', async () => {
    await storeImported([game('a', '2026-09-01T00:00:00Z')]);
    await writeArchive('https://x.test/2026/08', '{}', true);
    await deleteAllImported();
    expect(await db.imported.count()).toBe(0);
    expect(await db.archives.count()).toBe(0);
  });
});

describe('archive cache', () => {
  test('a complete month round-trips', async () => {
    await writeArchive('https://x.test/2026/08', '{"games":[]}', true);
    expect(await readArchive('https://x.test/2026/08')).toBe('{"games":[]}');
  });

  test('an INCOMPLETE month is never served from the cache', async () => {
    // Serving the current month from cache is how a cache stops F-IM-4's daily
    // check from ever seeing a new game.
    await writeArchive('https://x.test/2026/09', '{"games":[]}', false);
    expect(await readArchive('https://x.test/2026/09')).toBeNull();
    // Positive control: the row IS there, so null is the completeness rule and
    // not a failed write.
    expect(await db.archives.get('https://x.test/2026/09')).not.toBeUndefined();
  });

  test('an absent archive reads as null', async () => {
    expect(await readArchive('https://x.test/never')).toBeNull();
  });
});

describe('the analysis queue', () => {
  /** Records the order games were handed to it and reports a fixed outcome. */
  function analyser(outcome: 'done' | 'failed' = 'done') {
    const seen: string[] = [];
    const fn: GameAnalyser = (row, onPositions) => {
      seen.push(row.gameId);
      onPositions(1, 2);
      onPositions(2, 2);
      return Promise.resolve(outcome);
    };
    return { fn, seen };
  }

  async function seed(n: number) {
    await storeImported(
      Array.from({ length: n }, (_, i) => game(`g${String(i)}`, `2026-09-${String(30 - i).padStart(2, '0')}T00:00:00Z`)),
    );
  }

  test('the foreground pass takes exactly the ten most recent, newest first', async () => {
    await seed(15);
    const a = analyser();
    const out = await runForegroundAnalysis({ analyser: a.fn });
    expect(out).toEqual({ analysed: 10, failed: 0, stopped: false });
    expect(a.seen).toEqual(['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9']);
    expect(FOREGROUND_COUNT).toBe(10);
    expect(await countPendingAnalysis()).toBe(5);
  });

  test('fewer than ten games analyses all of them and does not wait for ten', async () => {
    await seed(3);
    const a = analyser();
    const out = await runForegroundAnalysis({ analyser: a.fn });
    expect(out.analysed).toBe(3);
    expect(a.seen).toHaveLength(3);
  });

  test('the background pass finishes what the foreground pass left', async () => {
    await seed(13);
    await runForegroundAnalysis({ analyser: analyser().fn });
    const b = analyser();
    const out = await runBackgroundAnalysis({ analyser: b.fn });
    expect(out.analysed).toBe(3);
    expect(b.seen).toEqual(['g10', 'g11', 'g12']);
    expect(await countPendingAnalysis()).toBe(0);
  });

  test('a background pass resumes on a later visit, because the state is in the database', async () => {
    await seed(5);
    // First "visit": stops after two games.
    let n = 0;
    await runBackgroundAnalysis({
      analyser: analyser().fn,
      shouldContinue: () => {
        n += 1;
        return n <= 2;
      },
    });
    expect(await countAnalysed()).toBe(2);
    // Second "visit": a brand new run with no memory of the first.
    const b = analyser();
    const out = await runBackgroundAnalysis({ analyser: b.fn });
    expect(out.analysed).toBe(3);
    expect(b.seen).toEqual(['g2', 'g3', 'g4']);
    expect(await countPendingAnalysis()).toBe(0);
  });

  test('a stopped run reports that it stopped and analyses no further game', async () => {
    await seed(5);
    const a = analyser();
    const out = await runBackgroundAnalysis({ analyser: a.fn, shouldContinue: () => false });
    expect(out).toEqual({ analysed: 0, failed: 0, stopped: true });
    expect(a.seen).toEqual([]);
    // Positive control: the same seeded database WITHOUT the stop analyses games,
    // so the empty result is the stop and not an empty queue.
    const b = analyser();
    await runBackgroundAnalysis({ analyser: b.fn });
    expect(b.seen).toHaveLength(5);
  });

  test('an analyser that throws marks the game failed and the queue moves on', async () => {
    await seed(3);
    let calls = 0;
    const out = await runBackgroundAnalysis({
      analyser: (row) => {
        calls += 1;
        if (row.gameId === 'g1') throw new Error('engine gone');
        return Promise.resolve('done');
      },
    });
    expect(calls).toBe(3);
    expect(out).toEqual({ analysed: 2, failed: 1, stopped: false });
    expect((await importedById('g1'))?.analysis).toBe('failed');
    // Nothing is left pending, so the failing game is not retried on every visit.
    expect(await countPendingAnalysis()).toBe(0);
  });

  test('a failing analyser cannot spin: the run is bounded by what was pending', async () => {
    await seed(4);
    let calls = 0;
    const out = await runBackgroundAnalysis({
      analyser: () => {
        calls += 1;
        return Promise.resolve('failed');
      },
    });
    expect(calls).toBe(4);
    expect(out.failed).toBe(4);
  });

  test('an empty queue is a no-op', async () => {
    const a = analyser();
    expect(await runBackgroundAnalysis({ analyser: a.fn })).toEqual({ analysed: 0, failed: 0, stopped: false });
    expect(a.seen).toEqual([]);
  });

  test('per-position progress reaches the caller, which is F-IM-3 progress bar', async () => {
    await seed(1);
    const seen: [number, number][] = [];
    await runForegroundAnalysis({
      analyser: analyser().fn,
      onPositions: (d, t) => seen.push([d, t]),
    });
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  test('per-game progress counts completions against this run total', async () => {
    await seed(3);
    const seen: [number, number][] = [];
    await runBackgroundAnalysis({
      analyser: analyser().fn,
      onGameDone: (done, total) => seen.push([done, total]),
    });
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  test('the profile basis counts only analysed games, never merely imported ones', async () => {
    await seed(12);
    await runForegroundAnalysis({ analyser: analyser().fn });
    expect(await profileBasis()).toEqual({ imported: 12, analysed: 10, pending: 2 });
  });

  test('a failed game is in neither the analysed count nor the pending count', async () => {
    await seed(2);
    await runBackgroundAnalysis({ analyser: analyser('failed').fn });
    expect(await profileBasis()).toEqual({ imported: 2, analysed: 0, pending: 0 });
  });
});

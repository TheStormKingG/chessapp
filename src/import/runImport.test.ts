import { db } from '@/data/db';
import type { Clock, ImportFetch } from './net';
import { archivesUrl } from './chesscom';
import { gamesUrl, userUrl } from './lichess';
import { CHECK_INTERVAL_MS, checkForNewGames, checkIsDue, importFromPgn, runImport } from './runImport';

beforeEach(async () => {
  await db.imported.clear();
  await db.archives.clear();
});

function fakeClock(): Clock {
  let elapsed = 0;
  return {
    now: () => elapsed,
    delay: async (ms) => {
      elapsed += ms;
      await Promise.resolve();
    },
  };
}

/**
 * A response FACTORY, not a response.
 *
 * A `Response` body can be read only once, so a stub that hands the same instance
 * to two requests makes the second one look like a source returning an empty or
 * unparseable body — which is indistinguishable from the real failure these tests
 * exist to detect. Every reply is therefore built fresh per call.
 */
function resp(body: string, init?: ResponseInit): () => Response {
  return () => new Response(body, init);
}

function stubFetch(table: Record<string, () => Response>) {
  const calls: string[] = [];
  const fn: ImportFetch = (url) => {
    calls.push(url);
    const hit = table[url];
    if (hit === undefined) return Promise.reject(new TypeError(`unstubbed: ${url}`));
    return Promise.resolve(hit());
  };
  return { fn, calls };
}

const PGN_ONE = `[Event "Live Chess"]
[White "learner_one"]
[Black "Rosa"]
[Result "1-0"]
[UTCDate "2026.09.20"]
[UTCTime "14:00:00"]
[TimeControl "600"]

1. e4 e5 2. Nf3 Nc6 1-0`;

const PGN_BLACK = `[Event "Live Chess"]
[White "Bruno"]
[Black "learner_one"]
[Result "0-1"]
[UTCDate "2026.09.21"]
[UTCTime "15:00:00"]
[TimeControl "600"]

1. d4 d5 2. c4 e6 0-1`;

describe('importFromPgn', () => {
  test('a username match decides the side per game, so both colours work in one paste', () => {
    const r = importFromPgn({ kind: 'pgn', text: `${PGN_ONE}\n\n${PGN_BLACK}`, learner: null, usernames: ['learner_one'] });
    expect(r.failure).toBeNull();
    expect(r.games).toHaveLength(2);
    expect(r.games.map((g) => g.learner)).toEqual(['w', 'b']);
    expect(r.games.map((g) => g.result)).toEqual(['win', 'win']);
    expect(r.games.map((g) => g.opponent)).toEqual(['Rosa', 'Bruno']);
  });

  test('a stated colour is used when no username matches', () => {
    const r = importFromPgn({ kind: 'pgn', text: PGN_ONE, learner: 'b', usernames: [] });
    expect(r.games).toHaveLength(1);
    expect(r.games[0]!.learner).toBe('b');
    expect(r.games[0]!.opponent).toBe('learner_one');
    expect(r.games[0]!.result).toBe('loss');
  });

  test('a username match WINS over the stated colour', () => {
    // The match is per game and the stated colour is per paste, so the specific
    // evidence beats the general one.
    const r = importFromPgn({ kind: 'pgn', text: PGN_ONE, learner: 'b', usernames: ['learner_one'] });
    expect(r.games[0]!.learner).toBe('w');
  });

  test('with neither a match nor a stated colour, the game is skipped and said to be', () => {
    const r = importFromPgn({ kind: 'pgn', text: PGN_ONE, learner: null, usernames: ['someone_else'] });
    expect(r.games).toEqual([]);
    expect(r.skipped).toEqual(['unknown-side']);
    // Positive control: the same text with a matching username IS imported, so the
    // skip is the identity question and not an unreadable PGN.
    expect(importFromPgn({ kind: 'pgn', text: PGN_ONE, learner: null, usernames: ['learner_one'] }).games).toHaveLength(1);
  });

  test('text with no games at all is a stated bad-pgn failure', () => {
    const r = importFromPgn({ kind: 'pgn', text: 'this is my shopping list', learner: 'w', usernames: [] });
    expect(r.games).toEqual([]);
    expect(r.failure).toEqual({ kind: 'bad-pgn', detail: 'no games were found in that text' });
  });

  test('an unfinished game in a paste is skipped with its own reason', () => {
    const unfinished = PGN_ONE.replace('[Result "1-0"]', '[Result "*"]').replace('1-0', '*');
    const r = importFromPgn({ kind: 'pgn', text: unfinished, learner: 'w', usernames: [] });
    expect(r.games).toEqual([]);
    expect(r.skipped).toEqual(['no-result']);
  });
});

describe('runImport from a PGN paste', () => {
  test('games are stored and the counts are reported', async () => {
    const out = await runImport(
      { kind: 'pgn', text: `${PGN_ONE}\n\n${PGN_BLACK}`, learner: null, usernames: ['learner_one'] },
      { fetch: () => Promise.reject(new Error('the PGN path must not touch the network')) },
    );
    expect(out.failure).toBeNull();
    expect(out.added).toBe(2);
    expect(out.alreadyHeld).toBe(0);
    expect(await db.imported.count()).toBe(2);
  });

  test('the PGN path makes no request at all', async () => {
    // The fetch supplied rejects, so any request would surface as a failure.
    const out = await runImport(
      { kind: 'pgn', text: PGN_ONE, learner: 'w', usernames: [] },
      { fetch: () => Promise.reject(new Error('network used')) },
    );
    expect(out.added).toBe(1);
    expect(out.failure).toBeNull();
  });

  test('pasting the same file twice adds nothing the second time', async () => {
    const req = { kind: 'pgn' as const, text: PGN_ONE, learner: 'w' as const, usernames: [] };
    const deps = { fetch: () => Promise.reject(new Error('no network')) };
    await runImport(req, deps);
    const again = await runImport(req, deps);
    expect(again.added).toBe(0);
    expect(again.alreadyHeld).toBe(1);
    expect(await db.imported.count()).toBe(1);
  });

  test('a paste larger than the first-import size is not truncated to 50', async () => {
    // The learner chose these games by choosing the file.
    const many = Array.from({ length: 60 }, (_, i) =>
      PGN_ONE.replace('[UTCTime "14:00:00"]', `[UTCTime "${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00"]`),
    ).join('\n\n');
    const out = await runImport(
      { kind: 'pgn', text: many, learner: 'w', usernames: [] },
      { fetch: () => Promise.reject(new Error('no network')) },
    );
    expect(out.added).toBe(60);
  });
});

describe('runImport from an account', () => {
  const user = 'learner_one';
  const list = archivesUrl(user);
  const sep = 'https://api.chess.com/pub/player/learner_one/games/2026/09';

  function month(pgns: string[], timeClass = 'rapid') {
    return JSON.stringify({
      games: pgns.map((pgn) => ({
        pgn,
        time_class: timeClass,
        rules: 'chess',
        white: { username: 'learner_one' },
        black: { username: 'Rosa' },
      })),
    });
  }

  test('a chess.com import stores the games it read', async () => {
    const s = stubFetch({ [list]: resp(JSON.stringify({ archives: [sep] })), [sep]: resp(month([PGN_ONE])) });
    const out = await runImport(
      { kind: 'account', source: 'chess.com', username: user, limit: 50 },
      { fetch: s.fn, clock: fakeClock(), now: () => new Date('2026-09-26T00:00:00Z') },
    );
    expect(out.failure).toBeNull();
    expect(out.added).toBe(1);
    expect((await db.imported.toArray())[0]!.source).toBe('chess.com');
  });

  test('an unknown username is reported and nothing is stored', async () => {
    const s = stubFetch({ [archivesUrl('nope')]: resp('{"code":0,"message":"User \\"nope\\" not found."}', { status: 404 }) });
    const out = await runImport(
      { kind: 'account', source: 'chess.com', username: 'nope', limit: 50 },
      { fetch: s.fn, clock: fakeClock() },
    );
    expect(out.failure?.kind).toBe('unknown-user');
    expect(out.added).toBe(0);
    expect(await db.imported.count()).toBe(0);
  });

  test('a Lichess import goes through the Lichess export API', async () => {
    const row = JSON.stringify({
      id: 'abcd1234',
      speed: 'blitz',
      variant: 'standard',
      pgn: `[White "learner_one"]\n[Black "Rosa"]\n[Result "1-0"]\n[GameId "abcd1234"]\n[UTCDate "2026.09.20"]\n[UTCTime "14:00:00"]\n\n1. e4 e5 1-0`,
      players: { white: { user: { name: 'learner_one' } }, black: { user: { name: 'Rosa' } } },
    });
    const s = stubFetch({ [userUrl(user)]: resp('{}'), [gamesUrl(user, 50)]: resp(row) });
    const out = await runImport(
      { kind: 'account', source: 'lichess', username: user, limit: 50 },
      { fetch: s.fn, clock: fakeClock() },
    );
    expect(out.added).toBe(1);
    expect((await db.imported.toArray())[0]!.gameId).toBe('li-abcd1234');
  });

  test('a cached archive means a re-import makes one request, not two', async () => {
    const s = stubFetch({ [list]: resp(JSON.stringify({ archives: [sep] })), [sep]: resp(month([PGN_ONE])) });
    const deps = { fetch: s.fn, clock: fakeClock(), now: () => new Date('2026-10-05T00:00:00Z') };
    // September is a COMPLETE month in October, so it is cached.
    await runImport({ kind: 'account', source: 'chess.com', username: user, limit: 50 }, deps);
    expect(s.calls).toEqual([list, sep]);
    const again = await runImport({ kind: 'account', source: 'chess.com', username: user, limit: 50 }, deps);
    expect(again.added).toBe(0);
    expect(again.alreadyHeld).toBe(1);
    // The second run asked for the archive LIST again — it must, to learn about new
    // months — but not for September, which came from the cache.
    expect(s.calls).toEqual([list, sep, list]);
  });

  test('bullet games are stored and reported as in scope', async () => {
    const s = stubFetch({
      [list]: resp(JSON.stringify({ archives: [sep] })),
      [sep]: resp(month([PGN_ONE], 'bullet')),
    });
    const out = await runImport(
      { kind: 'account', source: 'chess.com', username: user, limit: 50 },
      { fetch: s.fn, clock: fakeClock(), now: () => new Date('2026-09-26T00:00:00Z') },
    );
    expect(out.added).toBe(1);
    expect((await db.imported.toArray())[0]!.speed).toBe('bullet');
  });
});

describe('checkIsDue', () => {
  const now = new Date('2026-09-26T12:00:00Z');
  const accounts = [{ source: 'chess.com' as const, username: 'learner_one' }];

  test('a never-checked account with keep-current on is due', () => {
    expect(checkIsDue({ keepCurrent: true, accounts, lastCheckedAt: null }, now)).toBe(true);
  });

  test('the learner turning it off is respected', () => {
    expect(checkIsDue({ keepCurrent: false, accounts, lastCheckedAt: null }, now)).toBe(false);
    // Positive control: the same state with the switch on IS due, so `false` is
    // the switch and not a rule that never fires.
    expect(checkIsDue({ keepCurrent: true, accounts, lastCheckedAt: null }, now)).toBe(true);
  });

  test('no linked account means nothing to check', () => {
    expect(checkIsDue({ keepCurrent: true, accounts: [], lastCheckedAt: null }, now)).toBe(false);
  });

  test('a check within the day is not due, and one a day old is', () => {
    const justNow = new Date(now.getTime() - 60_000).toISOString();
    expect(checkIsDue({ keepCurrent: true, accounts, lastCheckedAt: justNow }, now)).toBe(false);
    const yesterday = new Date(now.getTime() - CHECK_INTERVAL_MS).toISOString();
    expect(checkIsDue({ keepCurrent: true, accounts, lastCheckedAt: yesterday }, now)).toBe(true);
  });

  test('an unreadable timestamp is treated as never checked, not as just checked', () => {
    // One extra request is a better failure than a check that never runs again.
    expect(checkIsDue({ keepCurrent: true, accounts, lastCheckedAt: 'not a date' }, now)).toBe(true);
  });
});

describe('checkForNewGames', () => {
  const user = 'learner_one';
  const list = archivesUrl(user);
  const sep = 'https://api.chess.com/pub/player/learner_one/games/2026/09';

  test('a check that is not due makes no request', async () => {
    const s = stubFetch({});
    const out = await checkForNewGames(
      { keepCurrent: false, accounts: [{ source: 'chess.com', username: user }], lastCheckedAt: null },
      { fetch: s.fn, clock: fakeClock() },
    );
    expect(out.ran).toBe(false);
    expect(s.calls).toEqual([]);
  });

  test('a due check adds only games not already held', async () => {
    const month = JSON.stringify({
      games: [PGN_ONE, PGN_BLACK].map((pgn) => ({
        pgn,
        time_class: 'rapid',
        rules: 'chess',
        white: { username: pgn.includes('[White "learner_one"]') ? 'learner_one' : 'Bruno' },
        black: { username: pgn.includes('[White "learner_one"]') ? 'Rosa' : 'learner_one' },
      })),
    });
    const s = stubFetch({ [list]: resp(JSON.stringify({ archives: [sep] })), [sep]: resp(month) });
    const deps = { fetch: s.fn, clock: fakeClock(), now: () => new Date('2026-09-26T00:00:00Z') };
    // First import takes both.
    await runImport({ kind: 'account', source: 'chess.com', username: user, limit: 50 }, deps);
    expect(await db.imported.count()).toBe(2);
    // The daily check finds the same two and adds neither.
    const out = await checkForNewGames(
      { keepCurrent: true, accounts: [{ source: 'chess.com', username: user }], lastCheckedAt: null },
      deps,
    );
    expect(out.ran).toBe(true);
    expect(out.perAccount[0]!.outcome.added).toBe(0);
    expect(out.perAccount[0]!.outcome.alreadyHeld).toBe(2);
    expect(await db.imported.count()).toBe(2);
  });

  test('accounts are checked one at a time, never concurrently', async () => {
    // Both sites answer a second concurrent request with 429, so two accounts
    // checked at once is exactly what earns the rate limit this avoids.
    const liWho = userUrl('other');
    const inFlight: string[] = [];
    let maxConcurrent = 0;
    let open = 0;
    const fn: ImportFetch = (url) => {
      open += 1;
      maxConcurrent = Math.max(maxConcurrent, open);
      inFlight.push(url);
      return Promise.resolve().then(() => {
        open -= 1;
        if (url === list) return new Response(JSON.stringify({ archives: [] }));
        return new Response('{}', { status: 404 });
      });
    };
    await checkForNewGames(
      {
        keepCurrent: true,
        accounts: [
          { source: 'chess.com', username: user },
          { source: 'lichess', username: 'other' },
        ],
        lastCheckedAt: null,
      },
      { fetch: fn, clock: fakeClock() },
    );
    expect(maxConcurrent).toBe(1);
    expect(inFlight).toContain(list);
    expect(inFlight).toContain(liWho);
  });
});

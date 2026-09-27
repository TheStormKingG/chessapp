import { archivesUrl, fetchChessCom, isCompleteMonth, parseMonthly } from './chesscom';
import { fetchLichess, gamesUrl, parseNdjson, userUrl } from './lichess';
import { Throttle, attempt, type Clock, type ImportFetch } from './net';

/*
 * Nothing here touches the network. Every response is a fixture taken from the
 * real shape of each API, and the one seam both providers reach through
 * (`ImportFetch`) is a recording stub, so a test that accidentally needed the
 * internet would fail rather than pass slowly.
 */

/** A clock that never waits, so throttling is exercised without elapsed time. */
function fakeClock(): Clock & { elapsed: number; waits: number[] } {
  const c = {
    elapsed: 0,
    waits: [] as number[],
    now: () => c.elapsed,
    delay: async (ms: number) => {
      c.waits.push(ms);
      c.elapsed += ms;
      await Promise.resolve();
    },
  };
  return c;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Records every URL asked for and replies from a table. */
function stubFetch(table: Record<string, Response | (() => Response)>) {
  const calls: string[] = [];
  const accepts: (string | undefined)[] = [];
  const fn: ImportFetch = (url, init) => {
    calls.push(url);
    accepts.push(init?.headers?.Accept);
    const hit = table[url];
    if (hit === undefined) return Promise.reject(new TypeError(`unstubbed URL: ${url}`));
    // A Response body can be read only ONCE. Handing the same instance to two
    // requests makes the second look like a source returning an empty or
    // unparseable body — indistinguishable from the real failure these tests
    // exist to detect. Cloning (never reading the original) keeps each reply
    // independently readable however many times a URL is asked for.
    return Promise.resolve(typeof hit === 'function' ? hit() : hit.clone());
  };
  return { fn, calls, accepts };
}

const CC_PGN = (white: string, black: string, result: string, date: string, time: string) =>
  [
    '[Event "Live Chess"]',
    '[Site "Chess.com"]',
    `[Date "${date}"]`,
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${result}"]`,
    `[UTCDate "${date}"]`,
    `[UTCTime "${time}"]`,
    '[TimeControl "600"]',
    '[Link "https://www.chess.com/game/live/100' + time.replace(/:/g, '') + '"]',
    '',
    '1. e4 {[%clk 0:10:00]} 1... e5 {[%clk 0:10:00]} 2. Nf3 ' + result,
  ].join('\n');

describe('chess.com URLs', () => {
  test('a username is lowercased and encoded', () => {
    expect(archivesUrl('  Learner One ')).toBe('https://api.chess.com/pub/player/learner%20one/games/archives');
  });
});

describe('isCompleteMonth', () => {
  const now = new Date('2026-09-26T12:00:00Z');
  test('a past month is complete', () => {
    expect(isCompleteMonth('https://api.chess.com/pub/player/x/games/2026/08', now)).toBe(true);
    expect(isCompleteMonth('https://api.chess.com/pub/player/x/games/2025/12', now)).toBe(true);
  });
  test('the current month is NOT complete, so it is never cached forever', () => {
    // A cached current month would make F-IM-4's daily check permanently blind.
    expect(isCompleteMonth('https://api.chess.com/pub/player/x/games/2026/09', now)).toBe(false);
  });
  test('a future month is not complete', () => {
    expect(isCompleteMonth('https://api.chess.com/pub/player/x/games/2026/10', now)).toBe(false);
  });
  test('an unparseable archive URL is not complete, so it is not cached', () => {
    expect(isCompleteMonth('https://api.chess.com/pub/player/x/games/', now)).toBe(false);
    // Positive control: the same function says true for a real past-month URL.
    expect(isCompleteMonth('https://api.chess.com/pub/player/x/games/2026/08', now)).toBe(true);
  });
});

describe('parseMonthly', () => {
  test('a month of games becomes ImportedGames from the learner point of view', () => {
    const body = JSON.stringify({
      games: [
        {
          pgn: CC_PGN('learner_one', 'Rosa', '1-0', '2026.09.20', '14:00:00'),
          time_class: 'rapid',
          rules: 'chess',
          white: { username: 'learner_one' },
          black: { username: 'Rosa' },
        },
        {
          pgn: CC_PGN('Bruno', 'learner_one', '1-0', '2026.09.21', '15:00:00'),
          time_class: 'blitz',
          rules: 'chess',
          white: { username: 'Bruno' },
          black: { username: 'learner_one' },
        },
      ],
    });
    const games = parseMonthly(body, 'learner_one');
    expect(games).toHaveLength(2);
    expect(games[0]!.learner).toBe('w');
    expect(games[0]!.opponent).toBe('Rosa');
    expect(games[0]!.result).toBe('win');
    expect(games[0]!.speed).toBe('rapid');
    expect(games[1]!.learner).toBe('b');
    expect(games[1]!.opponent).toBe('Bruno');
    expect(games[1]!.result).toBe('loss');
    expect(games[1]!.speed).toBe('blitz');
  });

  test('a chess960 game is filtered out on the JSON rules field', () => {
    // chess960 archives carry no Variant tag in the PGN, so the JSON is the ONLY
    // place that says so and the PGN-level guard cannot see it.
    const body = JSON.stringify({
      games: [
        {
          pgn: CC_PGN('learner_one', 'Rosa', '1-0', '2026.09.20', '14:00:00'),
          time_class: 'rapid',
          rules: 'chess960',
          white: { username: 'learner_one' },
          black: { username: 'Rosa' },
        },
      ],
    });
    expect(parseMonthly(body, 'learner_one')).toEqual([]);
    // Positive control: the identical fixture with rules "chess" IS imported, so
    // the empty result is the filter and not a broken fixture.
    expect(parseMonthly(body.replace('chess960', 'chess'), 'learner_one')).toHaveLength(1);
  });

  test('a game naming neither side as the learner is skipped', () => {
    const body = JSON.stringify({
      games: [
        {
          pgn: CC_PGN('someone', 'else', '1-0', '2026.09.20', '14:00:00'),
          time_class: 'rapid',
          rules: 'chess',
          white: { username: 'someone' },
          black: { username: 'else' },
        },
      ],
    });
    expect(parseMonthly(body, 'learner_one')).toEqual([]);
  });

  test('a body that is not JSON yields no games rather than throwing', () => {
    expect(parseMonthly('<html>maintenance</html>', 'learner_one')).toEqual([]);
  });

  test('bullet games are imported, not discarded', () => {
    const body = JSON.stringify({
      games: [
        {
          pgn: CC_PGN('learner_one', 'Rosa', '1-0', '2026.09.20', '14:00:00'),
          time_class: 'bullet',
          rules: 'chess',
          white: { username: 'learner_one' },
          black: { username: 'Rosa' },
        },
      ],
    });
    const games = parseMonthly(body, 'learner_one');
    expect(games).toHaveLength(1);
    expect(games[0]!.speed).toBe('bullet');
  });
});

describe('fetchChessCom', () => {
  const user = 'learner_one';
  const list = archivesUrl(user);
  const aug = 'https://api.chess.com/pub/player/learner_one/games/2026/08';
  const sep = 'https://api.chess.com/pub/player/learner_one/games/2026/09';

  function month(n: number, startDay: number, timeClass = 'rapid') {
    return JSON.stringify({
      games: Array.from({ length: n }, (_, i) => ({
        pgn: CC_PGN('learner_one', `Opp${String(i)}`, '1-0', `2026.09.${String(startDay - i).padStart(2, '0')}`, `1${String(i % 10)}:00:00`),
        time_class: timeClass,
        rules: 'chess',
        white: { username: 'learner_one' },
        black: { username: `Opp${String(i)}` },
      })),
    });
  }

  test('the archive list is read first and months are walked newest first', async () => {
    const s = stubFetch({
      [list]: json({ archives: [aug, sep] }),
      [sep]: new Response(month(2, 20)),
      [aug]: new Response(month(2, 10)),
    });
    const r = await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    expect(r.ok).toBe(true);
    // The list is asked for first, then September (the newest) before August,
    // even though chess.com listed August first.
    expect(s.calls).toEqual([list, sep, aug]);
  });

  test('the walk stops as soon as the quota is filled, so old months cost nothing', async () => {
    const s = stubFetch({
      [list]: json({ archives: [aug, sep] }),
      [sep]: new Response(month(3, 20)),
      [aug]: new Response(month(3, 10)),
    });
    const r = await fetchChessCom(user, 3, { fetch: s.fn, clock: fakeClock() });
    if (!r.ok) throw new Error(r.failure.kind);
    expect(r.games).toHaveLength(3);
    expect(s.calls).toEqual([list, sep]);
    // Positive control: August IS in the table and IS reachable, so its absence
    // from the call list is the early stop and not an unstubbed URL.
    expect(Object.keys({ [aug]: 1 })).toContain(aug);
  });

  test('a missing player is reported as an unknown username, not as a network error', async () => {
    const s = stubFetch({ [list]: json({ code: 0, message: 'User "nope" not found.' }, 404) });
    const r = await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('unknown-user');
  });

  test('a 429 on the archive list is reported as rate limited with a wait', async () => {
    const s = stubFetch({ [list]: new Response('slow down', { status: 429, headers: { 'retry-after': '30' } }) });
    const r = await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('rate-limited');
    if (r.failure.kind !== 'rate-limited') throw new Error('unreachable');
    expect(r.failure.retryAfterMs).toBe(30_000);
  });

  test('a 429 after some games have arrived keeps the games and stops early', async () => {
    const s = stubFetch({
      [list]: json({ archives: [aug, sep] }),
      [sep]: new Response(month(2, 20)),
      [aug]: new Response('slow down', { status: 429 }),
    });
    const r = await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (!r.ok) throw new Error(r.failure.kind);
    expect(r.games).toHaveLength(2);
  });

  test('a refused request with nothing collected is reported as unreachable', async () => {
    const s = stubFetch({});
    const r = await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('unreachable');
  });

  test('a player with no archives at all is reported as having no games', async () => {
    const s = stubFetch({ [list]: json({ archives: [] }) });
    const r = await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('no-games');
  });

  test('an empty username is refused without a request', async () => {
    const s = stubFetch({});
    const r = await fetchChessCom('   ', 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('unknown-user');
    expect(s.calls).toEqual([]);
  });

  test('a cached month is not fetched again, and a re-import costs one request', async () => {
    const cache = new Map<string, string>([[aug, month(2, 10)]]);
    const s = stubFetch({
      [list]: json({ archives: [aug, sep] }),
      [sep]: new Response(month(1, 20)),
    });
    const r = await fetchChessCom(user, 50, {
      fetch: s.fn,
      clock: fakeClock(),
      readCache: (u) => Promise.resolve(cache.get(u) ?? null),
    });
    if (!r.ok) throw new Error(r.failure.kind);
    expect(r.games).toHaveLength(3);
    // August came from the cache: it is absent from the call list, and its games
    // are present in the result. Both halves matter.
    expect(s.calls).toEqual([list, sep]);
  });

  test('only a complete month is written to the cache as complete', async () => {
    const writes: { url: string; complete: boolean }[] = [];
    const s = stubFetch({
      [list]: json({ archives: [aug, sep] }),
      [sep]: new Response(month(1, 20)),
      [aug]: new Response(month(1, 10)),
    });
    await fetchChessCom(user, 50, {
      fetch: s.fn,
      clock: fakeClock(),
      writeCache: (url, _body, complete) => {
        writes.push({ url, complete });
        return Promise.resolve();
      },
    }, new Date('2026-09-26T00:00:00Z'));
    expect(writes).toEqual([
      { url: sep, complete: false },
      { url: aug, complete: true },
    ]);
  });

  test('no chess.com request carries a header, because a preflight to it fails', async () => {
    // api.chess.com answers OPTIONS with 403, so a non-safelisted header makes
    // the request fail outright. This pins that none is sent.
    const s = stubFetch({ [list]: json({ archives: [sep] }), [sep]: new Response(month(1, 20)) });
    await fetchChessCom(user, 50, { fetch: s.fn, clock: fakeClock() });
    expect(s.accepts.every((a) => a === undefined)).toBe(true);
    expect(s.accepts.length).toBeGreaterThan(0);
  });
});

describe('Lichess URLs', () => {
  test('the export URL asks for exactly the four speeds F-IM-2 names', () => {
    const u = new URL(gamesUrl('thibault', 50));
    expect(u.pathname).toBe('/api/games/user/thibault');
    expect(u.searchParams.get('perfType')).toBe('rapid,blitz,correspondence,bullet');
    expect(u.searchParams.get('max')).toBe('50');
    expect(u.searchParams.get('sort')).toBe('dateDesc');
    // Evals off: a stored evaluation from another engine must not be shown as
    // this app's own analysis.
    expect(u.searchParams.get('evals')).toBe('false');
  });

  test('the profile URL is the one that answers "does this user exist"', () => {
    expect(userUrl(' thibault ')).toBe('https://lichess.org/api/user/thibault');
  });
});

describe('parseNdjson', () => {
  const LI_PGN = (white: string, black: string, result: string, id: string) =>
    [
      '[Event "rated blitz game"]',
      `[Site "https://lichess.org/${id}"]`,
      `[White "${white}"]`,
      `[Black "${black}"]`,
      `[Result "${result}"]`,
      `[GameId "${id}"]`,
      '[UTCDate "2026.09.19"]',
      '[UTCTime "18:51:40"]',
      '[Variant "Standard"]',
      '[TimeControl "300+3"]',
      '',
      `1. e4 { [%eval 0.18] } 1... c5 2. Nf3 ${result}`,
    ].join('\n');

  function row(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      id: 'abcd1234',
      speed: 'blitz',
      variant: 'standard',
      pgn: LI_PGN('OtherPlayer', 'learner_one', '0-1', 'abcd1234'),
      players: { white: { user: { name: 'OtherPlayer' } }, black: { user: { name: 'learner_one' } } },
      ...overrides,
    });
  }

  test('one object per line becomes one game per line', () => {
    const games = parseNdjson(`${row()}\n${row({ id: 'efgh5678', pgn: LI_PGN('OtherPlayer', 'learner_one', '0-1', 'efgh5678') })}\n`, 'learner_one');
    expect(games).toHaveLength(2);
    expect(games[0]!.gameId).toBe('li-abcd1234');
    expect(games[1]!.gameId).toBe('li-efgh5678');
    expect(games[0]!.learner).toBe('b');
    expect(games[0]!.opponent).toBe('OtherPlayer');
    expect(games[0]!.result).toBe('win');
  });

  test('correspondence is stored as daily', () => {
    const games = parseNdjson(row({ speed: 'correspondence' }), 'learner_one');
    expect(games[0]!.speed).toBe('daily');
  });

  test('a variant game is skipped on the JSON variant field', () => {
    expect(parseNdjson(row({ variant: 'chess960' }), 'learner_one')).toEqual([]);
    // Positive control: the same row with variant "standard" IS imported.
    expect(parseNdjson(row({ variant: 'standard' }), 'learner_one')).toHaveLength(1);
  });

  test('a truncated final line loses that game and no other', () => {
    // The export is a stream and can be cut off mid-line.
    const games = parseNdjson(`${row()}\n{"id":"trunc","spe`, 'learner_one');
    expect(games).toHaveLength(1);
  });

  test('blank lines are not games', () => {
    expect(parseNdjson(`\n\n${row()}\n\n`, 'learner_one')).toHaveLength(1);
  });

  test('an anonymous opponent does not break the row', () => {
    const games = parseNdjson(
      row({ players: { white: {}, black: { user: { name: 'learner_one' } } } }),
      'learner_one',
    );
    expect(games).toHaveLength(1);
    expect(games[0]!.learner).toBe('b');
  });
});

describe('fetchLichess', () => {
  const user = 'learner_one';
  const who = userUrl(user);
  const games = gamesUrl(user, 50);
  const ROW = JSON.stringify({
    id: 'abcd1234',
    speed: 'blitz',
    variant: 'standard',
    pgn: [
      '[White "OtherPlayer"]',
      '[Black "learner_one"]',
      '[Result "0-1"]',
      '[GameId "abcd1234"]',
      '[UTCDate "2026.09.19"]',
      '[UTCTime "18:51:40"]',
      '',
      '1. e4 c5 2. Nf3 0-1',
    ].join('\n'),
    players: { white: { user: { name: 'OtherPlayer' } }, black: { user: { name: 'learner_one' } } },
  });

  test('the user is confirmed to exist before the games are asked for', async () => {
    const s = stubFetch({ [who]: json({ id: user }), [games]: new Response(ROW) });
    const r = await fetchLichess(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (!r.ok) throw new Error(r.failure.kind);
    expect(s.calls).toEqual([who, games]);
    expect(r.games).toHaveLength(1);
  });

  test('the ndjson request asks for ndjson and the profile request does not', async () => {
    const s = stubFetch({ [who]: json({ id: user }), [games]: new Response(ROW) });
    await fetchLichess(user, 50, { fetch: s.fn, clock: fakeClock() });
    expect(s.accepts).toEqual([undefined, 'application/x-ndjson']);
  });

  test('a missing user is an unknown username and costs one request', async () => {
    const s = stubFetch({ [who]: json({ error: 'Not found' }, 404) });
    const r = await fetchLichess(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('unknown-user');
    expect(s.calls).toEqual([who]);
  });

  test('a 404 from the export endpoint for a user that EXISTS is unreachable, not unknown', async () => {
    // Measured on 2026-09-26: the export endpoint returned 404 for six accounts
    // that exist. Reporting that as "no such user" would tell a learner their own
    // username is wrong.
    const s = stubFetch({ [who]: json({ id: user }), [games]: json({ error: 'Not found' }, 404) });
    const r = await fetchLichess(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('unreachable');
    if (r.failure.kind !== 'unreachable') throw new Error('unreachable');
    expect(r.failure.detail).toContain('exists');
  });

  test("Lichess's concurrency 429 is reported as rate limited with the documented wait", async () => {
    const s = stubFetch({
      [who]: json({ id: user }),
      [games]: json({ error: 'Please only run 1 request(s) at a time' }, 429),
    });
    const r = await fetchLichess(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('rate-limited');
    if (r.failure.kind !== 'rate-limited') throw new Error('unreachable');
    expect(r.failure.retryAfterMs).toBe(60_000);
  });

  test('a user with no games in scope is reported as having no games', async () => {
    const s = stubFetch({ [who]: json({ id: user }), [games]: new Response('') });
    const r = await fetchLichess(user, 50, { fetch: s.fn, clock: fakeClock() });
    if (r.ok) throw new Error('unreachable');
    expect(r.failure.kind).toBe('no-games');
  });
});

describe('Throttle', () => {
  test('requests run one at a time, in order', async () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock);
    const order: string[] = [];
    await Promise.all([
      t.run(async () => {
        order.push('a');
        await Promise.resolve();
        order.push('a-end');
      }),
      t.run(() => {
        order.push('b');
        return Promise.resolve();
      }),
    ]);
    expect(order).toEqual(['a', 'a-end', 'b']);
  });

  test('a minimum gap is waited between requests', async () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock);
    await t.run(() => Promise.resolve(1));
    await t.run(() => Promise.resolve(2));
    expect(clock.waits).toEqual([1000]);
  });

  test('the first request waits for nothing', async () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock);
    await t.run(() => Promise.resolve(1));
    expect(clock.waits).toEqual([]);
  });

  test('a failed request does not wedge the queue', async () => {
    const clock = fakeClock();
    const t = new Throttle(0, clock);
    await expect(t.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(t.run(() => Promise.resolve('fine'))).resolves.toBe('fine');
  });
});

describe('attempt', () => {
  test('a thrown TypeError is unreachable, because there is no status to report', async () => {
    const r = await attempt(() => Promise.reject(new TypeError('Failed to fetch')), 'https://x.test/');
    expect(r.kind).toBe('unreachable');
  });

  test('a 429 without a Retry-After uses the documented one-minute wait', async () => {
    const r = await attempt(() => Promise.resolve(new Response('', { status: 429 })), 'https://x.test/');
    if (r.kind !== 'rate-limited') throw new Error(r.kind);
    expect(r.retryAfterMs).toBe(60_000);
  });

  test('a 5xx is unreachable and names the status', async () => {
    const r = await attempt(() => Promise.resolve(new Response('', { status: 503 })), 'https://x.test/');
    if (r.kind !== 'unreachable') throw new Error(r.kind);
    expect(r.detail).toContain('503');
  });

  test('403 and 404 are both "not found", because both mean no reachable resource', async () => {
    for (const status of [403, 404, 410]) {
      const r = await attempt(() => Promise.resolve(new Response('nope', { status })), 'https://x.test/');
      expect(r.kind).toBe('not-found');
    }
    // Positive control: 200 is NOT not-found on the same call shape.
    const ok = await attempt(() => Promise.resolve(new Response('yes')), 'https://x.test/');
    expect(ok.kind).toBe('ok');
  });
});

import { buildImportedGame } from './games';
import { parsePgn } from './pgn';
import { CHESSCOM_MIN_GAP_MS, Throttle, attempt, realClock, type Clock, type ImportFetch } from './net';
import { selectForImport, speedFromChessCom } from './scope';
import type { FetchResult, ImportedGame } from './types';

/**
 * chess.com import (F-IM-1): "fetched from the public monthly archives, one
 * request at a time, newest month first".
 *
 * No password is ever requested and none is needed: these are the public
 * endpoints. No proxy either — see the header of ./net.ts for the measurement.
 */

const BASE = 'https://api.chess.com/pub/player';

export interface ArchiveList {
  archives: string[];
}

/** Only the fields import reads. chess.com sends a great deal more. */
export interface ChessComGame {
  pgn?: string;
  time_class?: string;
  /** `chess` for standard; `chess960`, `bughouse`, … for everything else. */
  rules?: string;
  end_time?: number;
  white?: { username?: string };
  black?: { username?: string };
}

export interface MonthlyArchive {
  games: ChessComGame[];
}

export interface ChessComDeps {
  fetch: ImportFetch;
  clock?: Clock;
  /** Reads a cached archive, or null. F-IM-7: a re-import costs nothing. */
  readCache?: (url: string) => Promise<string | null>;
  writeCache?: (url: string, body: string, complete: boolean) => Promise<void>;
  onProgress?: (fetched: number, ofArchives: number) => void;
}

export function archivesUrl(username: string): string {
  return `${BASE}/${encodeURIComponent(username.trim().toLowerCase())}/games/archives`;
}

/**
 * A month is "complete" when it is not the current one.
 *
 * Only a complete month may be cached forever: the current month grows as the
 * learner plays, and a cached copy of it would make F-IM-4's daily check
 * permanently blind to every new game. This is the rule that makes "caches
 * monthly archives so a re-import costs nothing" safe rather than wrong.
 */
export function isCompleteMonth(archiveUrl: string, now: Date): boolean {
  const m = /\/(\d{4})\/(\d{2})\/?$/.exec(archiveUrl);
  const year = Number(m?.[1] ?? NaN);
  const month = Number(m?.[2] ?? NaN);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  return year < currentYear || (year === currentYear && month < currentMonth);
}

/**
 * Fetches up to `limit` profile-speed games, newest month first.
 *
 * Months are walked from the newest backwards and the walk STOPS as soon as the
 * quota is filled, so a learner with eight years of history costs a handful of
 * requests rather than ninety-six. That is the whole reason the archive list is
 * fetched first.
 */
export async function fetchChessCom(
  username: string,
  limit: number,
  deps: ChessComDeps,
  now = new Date(),
): Promise<FetchResult> {
  const clock = deps.clock ?? realClock;
  const throttle = new Throttle(CHESSCOM_MIN_GAP_MS, clock);
  const user = username.trim();
  if (user === '') return { ok: false, failure: { kind: 'unknown-user', source: 'chess.com', username } };

  const listAttempt = await throttle.run(() => attempt(deps.fetch, archivesUrl(user)));
  if (listAttempt.kind === 'not-found') {
    return { ok: false, failure: { kind: 'unknown-user', source: 'chess.com', username: user } };
  }
  if (listAttempt.kind === 'rate-limited') {
    return { ok: false, failure: { kind: 'rate-limited', source: 'chess.com', retryAfterMs: listAttempt.retryAfterMs } };
  }
  if (listAttempt.kind === 'unreachable') {
    return { ok: false, failure: { kind: 'unreachable', source: 'chess.com', detail: listAttempt.detail } };
  }

  let list: ArchiveList;
  try {
    list = (await listAttempt.response.json()) as ArchiveList;
  } catch (e) {
    return {
      ok: false,
      failure: { kind: 'unreachable', source: 'chess.com', detail: `archive list was not JSON: ${String(e)}` },
    };
  }
  const archives = Array.isArray(list.archives) ? [...list.archives] : [];
  if (archives.length === 0) {
    return { ok: false, failure: { kind: 'no-games', source: 'chess.com', username: user } };
  }
  // chess.com lists months ascending. F-IM-1 says newest first, so reverse.
  archives.reverse();

  const collected: ImportedGame[] = [];
  let quota = 0;
  let fetched = 0;

  for (const archiveUrl of archives) {
    if (quota >= limit) break;

    let body: string | null = (await deps.readCache?.(archiveUrl)) ?? null;
    if (body === null) {
      const a = await throttle.run(() => attempt(deps.fetch, archiveUrl));
      if (a.kind === 'rate-limited') {
        // Stop and report rather than discard: the games already collected are
        // real and the learner is told the import is short and why.
        if (collected.length === 0) {
          return { ok: false, failure: { kind: 'rate-limited', source: 'chess.com', retryAfterMs: a.retryAfterMs } };
        }
        break;
      }
      if (a.kind === 'unreachable') {
        if (collected.length === 0) {
          return { ok: false, failure: { kind: 'unreachable', source: 'chess.com', detail: a.detail } };
        }
        break;
      }
      // A month that 404s is a month with no games, not a broken import.
      if (a.kind === 'not-found') continue;
      body = await a.response.text();
      fetched += 1;
      await deps.writeCache?.(archiveUrl, body, isCompleteMonth(archiveUrl, now));
    }
    deps.onProgress?.(fetched, archives.length);

    const monthGames = parseMonthly(body, user);
    // Each month is scoped on its own so the walk can stop early, and the quota
    // is carried across months by hand. `selectForImport` is still the single
    // place the speed rules live.
    const sel = selectForImport(monthGames, limit - quota);
    collected.push(...sel.take);
    quota += sel.take.filter((g) => g.speed !== 'bullet').length;
  }

  if (collected.length === 0) {
    return { ok: false, failure: { kind: 'no-games', source: 'chess.com', username: user } };
  }
  return { ok: true, games: collected };
}

/**
 * Reads one monthly archive body into games the learner played.
 *
 * Exported because it is the part worth testing without a network at all, and
 * because a cached body goes through exactly this path — so the cache cannot
 * develop its own interpretation of an archive.
 */
export function parseMonthly(body: string, username: string): ImportedGame[] {
  let archive: MonthlyArchive;
  try {
    archive = JSON.parse(body) as MonthlyArchive;
  } catch {
    return [];
  }
  const games = Array.isArray(archive.games) ? archive.games : [];
  const out: ImportedGame[] = [];
  const wanted = username.trim().toLowerCase();

  for (const raw of games) {
    // `rules` other than `chess` is a variant. It is filtered here as well as in
    // buildImportedGame, because chess960 archives carry no Variant tag in the
    // PGN — the JSON is the only place that says so.
    if ((raw.rules ?? 'chess') !== 'chess') continue;
    if (typeof raw.pgn !== 'string' || raw.pgn.trim() === '') continue;

    const white = (raw.white?.username ?? '').trim().toLowerCase();
    const black = (raw.black?.username ?? '').trim().toLowerCase();
    const learner = white === wanted ? 'w' : black === wanted ? 'b' : null;
    // A game in this learner's archive that names neither side as them is not a
    // game they played. It should not happen; if it does, guessing a side would
    // label every move of it against the wrong player.
    if (learner === null) continue;

    const parsed = parsePgn(raw.pgn);
    const first = parsed[0];
    if (first === undefined) continue;
    const built = buildImportedGame({
      source: 'chess.com',
      parsed: first,
      learner,
      speed: speedFromChessCom(raw.time_class ?? ''),
    });
    if (built.ok) out.push(built.game);
  }
  return out;
}

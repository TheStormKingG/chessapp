import { buildImportedGame } from './games';
import { parsePgn } from './pgn';
import { LICHESS_MIN_GAP_MS, Throttle, attempt, realClock, type Clock, type ImportFetch } from './net';
import { speedFromLichess } from './scope';
import type { FetchResult, ImportedGame } from './types';

/**
 * Lichess import (F-IM-1): "Lichess games are fetched through the Lichess export
 * API". Note that F-IM-1 does NOT route these through the proxy, and they do not
 * need to be — see the header of ./net.ts.
 */

const API = 'https://lichess.org/api';

/** Only the fields import reads. */
export interface LichessGame {
  id?: string;
  speed?: string;
  createdAt?: number;
  pgn?: string;
  variant?: string;
  players?: {
    white?: { user?: { name?: string }; rating?: number };
    black?: { user?: { name?: string }; rating?: number };
  };
}

export interface LichessDeps {
  fetch: ImportFetch;
  clock?: Clock;
  onProgress?: (games: number) => void;
}

export function userUrl(username: string): string {
  return `${API}/user/${encodeURIComponent(username.trim())}`;
}

/**
 * The export URL.
 *
 * `perfType` asks for exactly F-IM-2's four classes, so classical, ultraBullet
 * and every variant pool are never transferred at all. `clocks` and `evals` are
 * off because the review re-analyses from scratch and a stored evaluation from
 * someone else's engine is not something this app should show as its own.
 */
export function gamesUrl(username: string, max: number): string {
  const params = new URLSearchParams({
    max: String(max),
    perfType: 'rapid,blitz,correspondence,bullet',
    pgnInJson: 'true',
    tags: 'true',
    clocks: 'false',
    evals: 'false',
    sort: 'dateDesc',
  });
  return `${API}/games/user/${encodeURIComponent(username.trim())}?${params.toString()}`;
}

/**
 * Fetches up to `limit` games, newest first.
 *
 * The user is confirmed to EXIST before the games are asked for, which is two
 * requests where one would usually do. The reason is measured rather than
 * defensive: on 2026-09-26 `/api/games/user/{u}` returned 404 `{"error":"Not
 * found"}` for six accounts that certainly exist, while `/api/user/{u}` returned
 * 200 for the same names and `/game/export/{id}` returned a real PGN. A 404 from
 * the export endpoint therefore cannot be reported as "no such user" — doing so
 * would tell a learner their own username does not exist. Asking the question
 * that has a reliable answer first is what keeps F-ER-4 honest.
 */
export async function fetchLichess(username: string, limit: number, deps: LichessDeps): Promise<FetchResult> {
  const clock = deps.clock ?? realClock;
  const throttle = new Throttle(LICHESS_MIN_GAP_MS, clock);
  const user = username.trim();
  if (user === '') return { ok: false, failure: { kind: 'unknown-user', source: 'lichess', username } };

  const who = await throttle.run(() => attempt(deps.fetch, userUrl(user)));
  if (who.kind === 'not-found') {
    return { ok: false, failure: { kind: 'unknown-user', source: 'lichess', username: user } };
  }
  if (who.kind === 'rate-limited') {
    return { ok: false, failure: { kind: 'rate-limited', source: 'lichess', retryAfterMs: who.retryAfterMs } };
  }
  if (who.kind === 'unreachable') {
    return { ok: false, failure: { kind: 'unreachable', source: 'lichess', detail: who.detail } };
  }

  const games = await throttle.run(() => attempt(deps.fetch, gamesUrl(user, limit), 'application/x-ndjson'));
  if (games.kind === 'rate-limited') {
    return { ok: false, failure: { kind: 'rate-limited', source: 'lichess', retryAfterMs: games.retryAfterMs } };
  }
  if (games.kind === 'unreachable') {
    return { ok: false, failure: { kind: 'unreachable', source: 'lichess', detail: games.detail } };
  }
  if (games.kind === 'not-found') {
    // The user exists — that was just established — so this is the export
    // endpoint being unavailable, and it is reported as exactly that.
    return {
      ok: false,
      failure: {
        kind: 'unreachable',
        source: 'lichess',
        detail: 'the Lichess export API answered "not found" for an account that exists',
      },
    };
  }

  const body = await games.response.text();
  const parsed = parseNdjson(body, user);
  deps.onProgress?.(parsed.length);
  if (parsed.length === 0) {
    return { ok: false, failure: { kind: 'no-games', source: 'lichess', username: user } };
  }
  return { ok: true, games: parsed };
}

/**
 * Reads an ndjson export body.
 *
 * One JSON object per line. A single unreadable line is skipped rather than
 * failing the import: the response is a stream that can be cut off mid-line, and
 * losing every game because the last one arrived half-written would be worse than
 * losing that one game.
 */
export function parseNdjson(body: string, username: string): ImportedGame[] {
  const out: ImportedGame[] = [];
  const wanted = username.trim().toLowerCase();

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let raw: LichessGame;
    try {
      raw = JSON.parse(trimmed) as LichessGame;
    } catch {
      continue;
    }
    if (typeof raw.pgn !== 'string' || raw.pgn.trim() === '') continue;
    if ((raw.variant ?? 'standard') !== 'standard') continue;

    const white = (raw.players?.white?.user?.name ?? '').trim().toLowerCase();
    const black = (raw.players?.black?.user?.name ?? '').trim().toLowerCase();
    const learner = white === wanted ? 'w' : black === wanted ? 'b' : null;
    if (learner === null) continue;

    const games = parsePgn(raw.pgn);
    const first = games[0];
    if (first === undefined) continue;
    const built = buildImportedGame({
      source: 'lichess',
      parsed: first,
      learner,
      speed: speedFromLichess(raw.speed ?? ''),
    });
    if (built.ok) out.push(built.game);
  }
  return out;
}

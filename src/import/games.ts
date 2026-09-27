import type { Color } from '@/rules';
import { positionsOf } from '@/review';
import { tagValue, type ParsedGame } from './pgn';
import { speedFromTimeControl } from './scope';
import type { ImportSource, ImportedGame, Speed } from './types';

/**
 * Turning a `ParsedGame` into an `ImportedGame`: identity, the learner's side,
 * the result from their point of view, and the checks that decide whether the
 * game can be reviewed at all.
 */

/** Why a parsed game cannot become an imported one. Each is shown to the learner. */
export type RejectReason =
  | 'no-result' // still in progress, or an abandoned game with `*`
  | 'not-standard' // a variant, or a game that does not start from the standard position
  | 'unknown-side' // no username matched either player
  | 'does-not-replay' // the move list is not a legal game
  | 'unparsed-tokens'; // the movetext held something this build could not read

export type BuildResult =
  | { ok: true; game: ImportedGame }
  | { ok: false; reason: RejectReason; detail: string };

/**
 * A deterministic 64-bit digest, as 16 hex characters.
 *
 * Two independent 32-bit functions rather than one, because a single 32-bit hash
 * over a few hundred games has a birthday collision probability around one in
 * 10^5 — small, but the consequence is one game silently overwriting another's
 * review, which is unobservable. `crypto.subtle.digest` would be better and is
 * async; this is called while building a list and must not be.
 */
function digest(s: string): string {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    fnv = (fnv ^ c) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
    djb = (Math.imul(djb, 33) ^ c) >>> 0;
  }
  return fnv.toString(16).padStart(8, '0') + djb.toString(16).padStart(8, '0');
}

/**
 * A stable id for a game, so that re-importing costs nothing (F-IM-7) and the
 * daily check adds only what is new (F-IM-4).
 *
 * The site's own id is used where there is one, because it is stable under
 * anything the site later changes about the PGN. A pasted file has no id, so the
 * id is a digest of the things that identify the game — the players, when it was
 * played and the moves. It is prefixed by source so two sites cannot collide,
 * and it contains no colon, because it travels in the `/play/review/:gameId`
 * path and a colon there has to be percent-encoded by every caller that builds
 * the link.
 */
export function gameIdOf(source: ImportSource, game: ParsedGame): string {
  if (source === 'chess.com') {
    const link = tagValue(game, 'Link');
    const fromLink = link === null ? null : /\/(\d+)\s*$/.exec(link.trim())?.[1];
    if (fromLink !== null && fromLink !== undefined) return `cc-${fromLink}`;
  }
  if (source === 'lichess') {
    const id = tagValue(game, 'GameId');
    if (id !== null && id.trim() !== '') return `li-${id.trim()}`;
    const site = tagValue(game, 'Site');
    const fromSite = site === null ? null : /lichess\.org\/([A-Za-z0-9]{8})/.exec(site)?.[1];
    if (fromSite !== null && fromSite !== undefined) return `li-${fromSite}`;
  }
  const parts = [
    tagValue(game, 'White') ?? '',
    tagValue(game, 'Black') ?? '',
    tagValue(game, 'UTCDate') ?? tagValue(game, 'Date') ?? '',
    tagValue(game, 'UTCTime') ?? '',
    game.sans.join(' '),
  ].join('|');
  return `pgn-${digest(parts)}`;
}

/**
 * Which side the learner played, by matching the names they have given us.
 *
 * `null` means "cannot tell", which is a real answer a PGN paste produces often:
 * a file downloaded from a site carries two names and nothing says which is the
 * person holding the phone. The screen asks. Guessing white would mis-label
 * every move of every black game, which is the same reason
 * `src/review/gameSource.ts` refuses a game with no `game_started`.
 */
export function learnerColorOf(game: ParsedGame, usernames: readonly string[]): Color | null {
  const wanted = usernames.map((u) => u.trim().toLowerCase()).filter((u) => u !== '');
  if (wanted.length === 0) return null;
  const white = (tagValue(game, 'White') ?? '').trim().toLowerCase();
  const black = (tagValue(game, 'Black') ?? '').trim().toLowerCase();
  const isWhite = white !== '' && wanted.includes(white);
  const isBlack = black !== '' && wanted.includes(black);
  // Both sides matching is a learner who played themselves, or two accounts they
  // own. There is no learner's point of view in that game, so there is no result
  // to report and no side to label.
  if (isWhite === isBlack) return null;
  return isWhite ? 'w' : 'b';
}

/** The result as the learner experienced it, so reading it needs no colour. */
export function resultFor(game: ParsedGame, learner: Color): 'win' | 'loss' | 'draw' | null {
  const raw = (tagValue(game, 'Result') ?? game.termination ?? '').trim();
  if (raw === '1-0') return learner === 'w' ? 'win' : 'loss';
  if (raw === '0-1') return learner === 'b' ? 'win' : 'loss';
  if (raw === '1/2-1/2') return 'draw';
  return null;
}

/**
 * ISO 8601 for the moment the game was played.
 *
 * PGN dates are `2026.09.19`, which is not ISO, so `new Date()` on one is
 * implementation-defined. The conversion is done by hand for that reason.
 * A date with no time becomes midnight UTC, which is a real ordering key and is
 * never silently "now" — sorting imported games by the time of the import would
 * put F-IM-3's "ten most recent" in the wrong order.
 */
export function playedAtOf(game: ParsedGame): string | null {
  const date = (tagValue(game, 'UTCDate') ?? tagValue(game, 'Date') ?? '').trim();
  const m = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/.exec(date);
  if (!m) return null;
  const time = (tagValue(game, 'UTCTime') ?? '').trim();
  const t = /^(\d{2}):(\d{2}):(\d{2})$/.test(time) ? time : '00:00:00';
  return `${m[1]}-${m[2]}-${m[3]}T${t}Z`;
}

function eloOf(game: ParsedGame, tag: string): number | null {
  const raw = tagValue(game, tag);
  if (raw === null) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Whether this game can be replayed from the standard start position.
 *
 * `positionsOf` in src/review/gameSource.ts documents that it is sound only
 * because every game the app records began at START_FEN. An imported game need
 * not have: chess.com and Lichess both export Chess960 and other variants, and
 * both mark a non-standard start with `SetUp "1"` and a `FEN` tag. Such a game
 * replayed from the standard position either throws or — worse — replays into a
 * different, legal game and is reviewed as if the learner had played it.
 *
 * So the FEN and SetUp tags are refused outright, and `Variant` must be absent
 * or Standard. This is a hard technical constraint, not a product preference.
 */
export function isStandardFromStart(game: ParsedGame): boolean {
  const variant = (tagValue(game, 'Variant') ?? '').trim().toLowerCase();
  if (variant !== '' && variant !== 'standard') return false;
  if (tagValue(game, 'FEN') !== null) return false;
  const setUp = (tagValue(game, 'SetUp') ?? '').trim();
  if (setUp !== '' && setUp !== '0') return false;
  return true;
}

export interface BuildArgs {
  source: ImportSource;
  parsed: ParsedGame;
  /** The side the learner played. Callers that cannot tell must ask first. */
  learner: Color;
  /**
   * The speed, when the source stated it. Required rather than defaulted: both
   * providers HAVE a class field, and a default would let a provider that forgot
   * to pass it produce a plausible `blitz` for every game it imported. A pasted
   * file passes `null` and gets the TimeControl estimate, which is a decision the
   * caller makes visibly.
   */
  speed: Speed | null;
}

/**
 * The single place a `ParsedGame` becomes an `ImportedGame`, or is refused.
 *
 * Every refusal is a stated reason rather than a dropped game, because the
 * screen tells the learner how many games it skipped and why — a silent drop
 * reads as a source that returned fewer games than it has.
 */
export function buildImportedGame({ source, parsed, learner, speed }: BuildArgs): BuildResult {
  if (parsed.unparsed.length > 0) {
    return {
      ok: false,
      reason: 'unparsed-tokens',
      detail: `movetext held ${String(parsed.unparsed.length)} token(s) this build cannot read: ${parsed.unparsed
        .slice(0, 3)
        .join(' ')}`,
    };
  }
  if (!isStandardFromStart(parsed)) {
    const variant = tagValue(parsed, 'Variant');
    return {
      ok: false,
      reason: 'not-standard',
      detail: variant !== null ? `variant: ${variant}` : 'does not start from the standard position',
    };
  }
  const result = resultFor(parsed, learner);
  if (result === null) {
    return { ok: false, reason: 'no-result', detail: `result: ${tagValue(parsed, 'Result') ?? '(none)'}` };
  }
  try {
    positionsOf(parsed.sans);
  } catch (e) {
    return { ok: false, reason: 'does-not-replay', detail: e instanceof Error ? e.message : String(e) };
  }

  const white = tagValue(parsed, 'White') ?? 'Unknown';
  const black = tagValue(parsed, 'Black') ?? 'Unknown';
  const learnerIsWhite = learner === 'w';
  return {
    ok: true,
    game: {
      gameId: gameIdOf(source, parsed),
      source,
      learner,
      opponent: learnerIsWhite ? black : white,
      result,
      speed: speed ?? speedFromTimeControl(tagValue(parsed, 'TimeControl')),
      // A game with no readable date sorts as the epoch rather than as "now", so
      // it lands at the END of "ten most recent" instead of displacing a game
      // whose date we know.
      playedAt: playedAtOf(parsed) ?? '1970-01-01T00:00:00Z',
      sans: parsed.sans,
      pgn: parsed.raw,
      learnerElo: eloOf(parsed, learnerIsWhite ? 'WhiteElo' : 'BlackElo'),
      opponentElo: eloOf(parsed, learnerIsWhite ? 'BlackElo' : 'WhiteElo'),
    },
  };
}

import type { Color } from '@/rules';
import { fetchChessCom } from './chesscom';
import { buildImportedGame, learnerColorOf, type RejectReason } from './games';
import { fetchLichess } from './lichess';
import { realClock, type Clock, type ImportFetch } from './net';
import { parsePgn } from './pgn';
import { FIRST_IMPORT_SIZE, selectForImport } from './scope';
import { countImported, readArchive, storeImported, writeArchive } from './storage';
import type { FetchResult, ImportFailure, ImportSource, ImportedGame } from './types';

/**
 * One import, start to finish: ask a source, apply F-IM-2's scope, store what is
 * new, and report honestly what happened to everything else.
 *
 * The event is appended by the caller rather than here, so that this function has
 * no dependency on the store and can be tested against a fake Dexie alone.
 */

export type ImportRequest =
  | { kind: 'account'; source: Exclude<ImportSource, 'pgn'>; username: string; limit: number }
  | {
      kind: 'pgn';
      text: string;
      /**
       * The side the learner played, when they have told us.
       *
       * It is consulted only for games whose tags do not already name a known
       * username, so a multi-game paste in which the learner played both colours
       * resolves per game rather than being forced onto one colour. A single game
       * from an unknown account is where this is actually used.
       */
      learner: Color | null;
      /** Usernames already known, tried against each game's White and Black tags. */
      usernames: readonly string[];
    };

/** Why games the source returned did not become imported games. */
export type SkipReason = RejectReason | 'out-of-scope' | 'over-limit' | 'unknown-side';

export interface ImportOutcome {
  added: number;
  alreadyHeld: number;
  /** One entry per distinct reason, so the screen can say what it skipped and why. */
  skipped: { reason: SkipReason; count: number }[];
  /** Non-null when the source could not be read at all. F-ER-4. */
  failure: ImportFailure | null;
}

function tally(reasons: readonly SkipReason[]): { reason: SkipReason; count: number }[] {
  const counts = new Map<SkipReason, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}

export interface RunImportDeps {
  fetch: ImportFetch;
  clock?: Clock;
  /** Progress while archives are being read, for the screen. */
  onProgress?: (fetched: number, total: number) => void;
  now?: () => Date;
}

/** Reads a PGN paste. No network is touched on this path at all. */
export function importFromPgn(req: Extract<ImportRequest, { kind: 'pgn' }>): {
  games: ImportedGame[];
  skipped: SkipReason[];
  failure: ImportFailure | null;
} {
  const parsed = parsePgn(req.text);
  if (parsed.length === 0) {
    return {
      games: [],
      skipped: [],
      failure: { kind: 'bad-pgn', detail: 'no games were found in that text' },
    };
  }
  const games: ImportedGame[] = [];
  const skipped: SkipReason[] = [];
  for (const p of parsed) {
    // A username match is preferred over the learner's stated colour, because it
    // is per game and the stated colour is per paste.
    const learner = learnerColorOf(p, req.usernames) ?? req.learner;
    if (learner === null) {
      skipped.push('unknown-side');
      continue;
    }
    const built = buildImportedGame({ source: 'pgn', parsed: p, learner, speed: null });
    if (built.ok) games.push(built.game);
    else skipped.push(built.reason);
  }
  return { games, skipped, failure: null };
}

/**
 * Runs an import and stores the result.
 *
 * The scope rules are applied to a PGN paste as well as to an account import. A
 * learner who pastes a file of 900 bullet games gets F-IM-2's answer to that, and
 * not a different one because the games arrived by a different door.
 */
export async function runImport(req: ImportRequest, deps: RunImportDeps): Promise<ImportOutcome> {
  const now = deps.now ?? (() => new Date());
  const clock = deps.clock ?? realClock;
  let candidates: ImportedGame[] = [];
  const skipped: SkipReason[] = [];
  let limit = FIRST_IMPORT_SIZE;

  if (req.kind === 'pgn') {
    const read = importFromPgn(req);
    if (read.failure) return { added: 0, alreadyHeld: 0, skipped: tally(read.skipped), failure: read.failure };
    candidates = read.games;
    skipped.push(...read.skipped);
    // A paste is bounded by what was pasted, not by the 50-game first import: the
    // learner has already chosen the games by choosing the file.
    limit = Math.max(candidates.length, FIRST_IMPORT_SIZE);
  } else {
    limit = req.limit;
    const result: FetchResult =
      req.source === 'chess.com'
        ? await fetchChessCom(
            req.username,
            limit,
            {
              fetch: deps.fetch,
              clock,
              readCache: readArchive,
              writeCache: (url, body, complete) => writeArchive(url, body, complete, now()),
              onProgress: deps.onProgress,
            },
            now(),
          )
        : await fetchLichess(req.username, limit, { fetch: deps.fetch, clock });
    if (!result.ok) return { added: 0, alreadyHeld: 0, skipped: [], failure: result.failure };
    candidates = result.games;
  }

  const sel = selectForImport(candidates, limit);
  skipped.push(...sel.outOfScope.map((): SkipReason => 'out-of-scope'));
  skipped.push(...sel.overLimit.map((): SkipReason => 'over-limit'));

  const { added, alreadyHeld } = await storeImported(sel.take, now());
  return { added, alreadyHeld, skipped: tally(skipped), failure: null };
}

/**
 * F-IM-4, "Keeping it current".
 *
 * > "Once a username is entered, the app checks for new games each time it opens
 * > and on a daily job when the learner is signed in, and adds them to the
 * > profile. The learner can turn this off."
 *
 * The on-open check is this function. The "daily job when the learner is signed
 * in" is NOT here and cannot be: a job that runs while the app is closed needs
 * something running when the app is closed, and this app is a static PWA whose
 * only backend is Supabase auth and sync. What this gives instead is honest and
 * is most of the value — a check on every open, rate-limited to once a day so that
 * opening the app five times costs one check rather than five.
 *
 * `alreadyHeld` does the de-duplication: the newest 50 are asked for, the ones
 * already stored are recognised by their stable id, and only genuinely new games
 * are added. That is why this needs no "since" cursor to get right.
 */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface KeepCurrentState {
  keepCurrent: boolean;
  accounts: readonly { source: Exclude<ImportSource, 'pgn'>; username: string }[];
  lastCheckedAt: string | null;
}

/** Whether the on-open check is due. Separated out so the rule is testable alone. */
export function checkIsDue(state: KeepCurrentState, now: Date): boolean {
  if (!state.keepCurrent) return false;
  if (state.accounts.length === 0) return false;
  if (state.lastCheckedAt === null) return true;
  const last = Date.parse(state.lastCheckedAt);
  // An unparseable timestamp is treated as "never checked" rather than as "just
  // checked": the failure mode of the first is one extra request, and of the
  // second is a check that never runs again.
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= CHECK_INTERVAL_MS;
}

export interface CheckOutcome {
  ran: boolean;
  perAccount: { source: Exclude<ImportSource, 'pgn'>; username: string; outcome: ImportOutcome }[];
}

/**
 * Checks every linked account for new games, if a check is due.
 *
 * Accounts are checked in series, never in parallel: both sites ask for one
 * request at a time, and two accounts checked at once is exactly the pattern that
 * earns the 429 this feature is supposed to avoid.
 */
export async function checkForNewGames(state: KeepCurrentState, deps: RunImportDeps): Promise<CheckOutcome> {
  const now = deps.now ?? (() => new Date());
  if (!checkIsDue(state, now())) return { ran: false, perAccount: [] };

  const held = await countImported();
  // Asking for the newest 50 is enough to find what is new since yesterday, and
  // is bounded — asking for `held + 50` would re-read the learner's whole history
  // on every check.
  const limit = Math.min(FIRST_IMPORT_SIZE, Math.max(FIRST_IMPORT_SIZE, held));
  const perAccount: CheckOutcome['perAccount'] = [];
  for (const account of state.accounts) {
    const outcome = await runImport(
      { kind: 'account', source: account.source, username: account.username, limit },
      deps,
    );
    perAccount.push({ source: account.source, username: account.username, outcome });
  }
  return { ran: true, perAccount };
}

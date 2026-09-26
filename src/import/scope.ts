import type { Speed } from './types';

/**
 * F-IM-2, "Scope of an import", as pure functions.
 *
 * > "The first import takes the most recent 50 games in rapid, blitz and daily.
 * > The learner can ask for more in batches of 50 up to 500. Bullet games are
 * > imported but excluded from the profile by default, because the research
 * > shows their errors are clock-driven rather than skill-driven, and the
 * > learner can include them with one switch."
 *
 * Nothing in this file fetches, stores or knows where a game came from, so all of
 * it is testable without a network, a database or an engine — which is why it is
 * separate from the providers that feed it.
 */

/** F-IM-2: "the most recent 50 games". */
export const FIRST_IMPORT_SIZE = 50;
/** F-IM-2: "in batches of 50". */
export const BATCH_SIZE = 50;
/** F-IM-2: "up to 500". */
export const MAX_IMPORT_SIZE = 500;

/**
 * The speeds that count toward the 50.
 *
 * F-IM-2 names three for the quota ("50 games in rapid, blitz and daily") and
 * then says bullet is imported anyway. Both clauses are honoured rather than one
 * being read as overriding the other: the quota counts the three, and bullet
 * games met while filling it are kept (see `selectForImport`). The alternative
 * reading — 50 games across all four — would let a run of bullet games consume
 * a quota the same sentence says is about the other three.
 */
export const PROFILE_SPEEDS: readonly Speed[] = ['rapid', 'blitz', 'daily'];

/** Every speed import will store. `other` is stored by nothing, ever. */
export const IMPORTED_SPEEDS: readonly Speed[] = [...PROFILE_SPEEDS, 'bullet'];

/**
 * The total to aim for after the learner asks for one more batch.
 *
 * `null` means there is nothing more to ask for. The result is clamped to
 * MAX_IMPORT_SIZE rather than stepped past it, so a learner holding 480 games
 * asks for 20 more and not for 30 they cannot have.
 */
export function nextBatchLimit(alreadyImported: number): number | null {
  if (alreadyImported >= MAX_IMPORT_SIZE) return null;
  if (alreadyImported <= 0) return FIRST_IMPORT_SIZE;
  return Math.min(alreadyImported + BATCH_SIZE, MAX_IMPORT_SIZE);
}

/** chess.com's `time_class`, which is exactly F-IM-2's vocabulary bar one. */
export function speedFromChessCom(timeClass: string): Speed {
  switch (timeClass) {
    case 'rapid':
      return 'rapid';
    case 'blitz':
      return 'blitz';
    case 'bullet':
      return 'bullet';
    case 'daily':
      return 'daily';
    default:
      return 'other';
  }
}

/**
 * Lichess's `speed`.
 *
 * `correspondence` is Lichess's name for what chess.com calls daily, so it maps
 * onto `daily`. `classical` and `ultraBullet` map to `other`: F-IM-2 names four
 * classes and neither is one of them, and filing a 30-minute classical game
 * under `rapid` would put a game the requirement never asked for into the
 * profile, where it would be indistinguishable from one it did.
 */
export function speedFromLichess(speed: string): Speed {
  switch (speed) {
    case 'rapid':
      return 'rapid';
    case 'blitz':
      return 'blitz';
    case 'bullet':
      return 'bullet';
    case 'correspondence':
      return 'daily';
    default:
      return 'other';
  }
}

/**
 * Best-effort speed from a PGN `TimeControl` tag, for a pasted file where no
 * site told us the class.
 *
 * The boundaries are Lichess's, on estimated duration (base + 40 increments).
 * This is an ESTIMATE and is used only when there is no explicit class: both
 * providers supply one and neither goes through here. A learner pasting a file
 * can always be shown what it decided.
 */
export function speedFromTimeControl(tc: string | null): Speed {
  if (tc === null) return 'other';
  const trimmed = tc.trim();
  // "1/86400" is one move per N seconds: correspondence, which F-IM-2 calls daily.
  if (/^\d+\/\d+$/.test(trimmed)) return 'daily';
  // "-" is an unlimited game. Real, and none of F-IM-2's four classes.
  if (trimmed === '-' || trimmed === '') return 'other';
  const m = /^(\d+)(?:\+(\d+))?$/.exec(trimmed);
  if (!m) return 'other';
  const base = Number(m[1] ?? NaN);
  const inc = Number(m[2] ?? 0);
  if (!Number.isFinite(base)) return 'other';
  const estimate = base + 40 * inc;
  if (estimate < 30) return 'other'; // ultraBullet
  if (estimate < 180) return 'bullet';
  if (estimate < 480) return 'blitz';
  if (estimate < 1500) return 'rapid';
  return 'other'; // classical
}

/** The least a candidate has to be for the scope rules to sort it. */
export interface Scopeable {
  speed: Speed;
  /** ISO 8601. */
  playedAt: string;
}

export interface Selection<T> {
  /** Newest first: what to store. */
  take: T[];
  /** Out of scope by speed. Never stored, and the count is worth telling the learner. */
  outOfScope: T[];
  /** In scope, but past the limit. The next batch starts here. */
  overLimit: T[];
}

/**
 * Applies F-IM-2's quota to a candidate list.
 *
 * `limit` counts PROFILE_SPEEDS games only. Bullet games newer than the oldest
 * game taken come along; bullet games older than it do not, because the import
 * has a horizon and a bullet game beyond it is simply not part of this import.
 *
 * The input need not be sorted. Sorting here rather than trusting the caller is
 * deliberate: chess.com returns each month ascending inside a list of months
 * that must be walked descending, and a quota applied to a mis-sorted list
 * silently takes the learner's OLDEST 50 games while looking entirely correct.
 */
export function selectForImport<T extends Scopeable>(candidates: readonly T[], limit: number): Selection<T> {
  const outOfScope: T[] = [];
  const inScope: T[] = [];
  for (const c of candidates) {
    if (IMPORTED_SPEEDS.includes(c.speed)) inScope.push(c);
    else outOfScope.push(c);
  }
  // Newest first. Ties keep their relative input order, which for a provider
  // walking one month at a time is the order the site listed them in.
  const sorted = [...inScope].sort((a, b) => b.playedAt.localeCompare(a.playedAt));

  const take: T[] = [];
  const overLimit: T[] = [];
  let quota = 0;
  for (const g of sorted) {
    const countsTowardQuota = PROFILE_SPEEDS.includes(g.speed);
    if (countsTowardQuota && quota >= limit) {
      overLimit.push(g);
      continue;
    }
    if (!countsTowardQuota && quota >= limit) {
      // The quota is full, so the horizon is closed and this bullet game is past
      // it. Without this the tail of every import would be every bullet game the
      // learner has ever played.
      overLimit.push(g);
      continue;
    }
    if (countsTowardQuota) quota += 1;
    take.push(g);
  }
  return { take, outOfScope, overLimit };
}

/**
 * F-IM-2's switch: which stored games the profile rests on.
 *
 * Bullet is excluded by default and included by the switch. `other` is never
 * here to begin with — `selectForImport` does not store it — but the filter
 * states it anyway, so this function is correct on any list it is handed rather
 * than only on one that has already been through the selector.
 */
export function profileGames<T extends { speed: Speed }>(games: readonly T[], includeBullet: boolean): T[] {
  return games.filter((g) => {
    if (g.speed === 'other') return false;
    if (g.speed === 'bullet') return includeBullet;
    return true;
  });
}

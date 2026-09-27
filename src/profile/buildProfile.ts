import { NO_BAND_STATS, bucketFor, type BandStatsSource } from './bandStats';
import { measureGame, totalsOf } from './metrics';
import { comparisonAvailability, confidenceOf } from './sampleSize';
import { skillBreakdowns } from './skills';
import { topStrengths } from './strengths';
import { topWeaknesses } from './weaknesses';
import { whatChanged } from './whatChanged';
import type { Profile, ProfileGame } from './types';
/* `@/vision/bests`, not `@/vision` — see the note in skills.ts. */
import { NO_BESTS, type VisionBests } from '@/vision/bests';

/**
 * The profile, assembled. PRD §8.14 F-SW-1 … F-SW-8.
 *
 * A pure function of the games handed to it — no Dexie, no store, no fetch, no
 * clock. That is what makes the whole feature testable at every boundary without
 * a screen, and it is what src/data/ means by a projection: the append-only log
 * and the derived review cache stay the only stores, and this re-derives on read.
 *
 * ── THE ORDER OF OPERATIONS MATTERS IN ONE PLACE ─────────────────────────────
 *
 * `games` must arrive NEWEST FIRST, because the index is the recency rank that
 * F-SW-3's weighting and F-SW-7's windows both read. This function sorts, rather
 * than trusting the caller: a caller that handed over Dexie's natural order would
 * produce a profile whose recency weighting was exactly inverted, every number
 * plausible, and nothing to notice it by. Sorting here costs one pass over at most
 * five hundred games and removes the whole failure mode.
 */

export interface BuildProfileOptions {
  /**
   * The learner's GAME rating, for F-SW-5's band. Null is the shipped value and
   * the correct one: the app has a puzzle rating, which is a different scale, and
   * F-AC-5 gates an imported game's own Elo behind the learner confirming the
   * account is theirs. See bandStats.ts.
   */
  rating?: number | null;
  /** Defaults to `NO_BAND_STATS`, which has nothing. See bandStats.ts. */
  source?: BandStatsSource;
  /**
   * F-IM-2: "Bullet games are imported but excluded from the profile by default,
   * because the research shows their errors are clock-driven rather than
   * skill-driven, and the learner can include them with one switch."
   */
  includeBullet?: boolean;
  /**
   * F-PG-1's "vision trainer scores", for the Board vision skill.
   *
   * Defaults to `NO_BESTS` — all three modes at zero — which is a learner who has
   * not opened the trainer, and renders as absent rather than as a measured zero.
   * A default rather than a required field so every existing caller and every
   * test that builds a profile from games alone keeps working unchanged.
   */
  visionBests?: VisionBests;
}

export function buildProfile(games: readonly ProfileGame[], options: BuildProfileOptions = {}): Profile {
  const source = options.source ?? NO_BAND_STATS;
  const included = (options.includeBullet ?? false) ? [...games] : games.filter((g) => g.speed !== 'bullet');
  // Newest first. Ties broken by gameId so the order is total: two games imported
  // with the same timestamp — chess.com's daily games carry a date and no time —
  // would otherwise sort differently between renders and move a weakness up or
  // down the list for no reason.
  const ordered = [...included].sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.gameId.localeCompare(b.gameId));

  const measured = ordered.map(measureGame);
  const totals = totalsOf(measured);
  const confidence = confidenceOf(measured.length);
  const comparisons = comparisonAvailability(measured.length, source.hasData);
  const bucket = bucketFor(options.rating ?? null);

  const shared = {
    bucket,
    source,
    comparisonsAllowed: comparisons.shown,
    early: comparisons.shown && comparisons.label === 'early',
  };
  const visionBests = options.visionBests ?? NO_BESTS;

  return {
    games: measured.length,
    confidence,
    comparisons,
    strengths: topStrengths({ totals, games: measured, ...shared }),
    weaknesses: topWeaknesses({ games: ordered, ...shared }),
    skills: skillBreakdowns({ totals, games: measured, ...shared, visionBests }),
    changed: whatChanged(measured),
    gameIds: measured.map((g) => g.gameId),
  };
}

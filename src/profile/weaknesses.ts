import { THEME_LESSON, type Theme } from '@/review/errorLog';
import { costOf, expectedScoreLostFromDrop, type Occurrence } from './cost';
import { drillFor, lessonFor, THEME_NAME } from './themes';
import type { ProfileGame, TypicalForLevel, Weakness } from './types';
import { comparisonFor, type BandMetric, type BandStatsSource, type Bucket } from './bandStats';
import { ratePerGame } from './metrics';

/**
 * F-SW-3, "Weaknesses, ranked by cost", verbatim:
 *
 * > "Beneath the strengths sit the three weaknesses that cost the most, ranked by
 * > how often they occur multiplied by how much expected score they lose, with
 * > recent games weighted more heavily. Each shows a plain name ('Knight forks
 * > against you'), a count ('9 times in 20 games'), the typical-for-level flag
 * > ('most players at your level miss this too' or 'unusual for your level'), and
 * > the lesson and drill that fix it."
 *
 * Four of the five things each weakness shows are built here. The fifth — the
 * typical-for-level flag — is the F-SW-5 dependency and is `{ known: false }`
 * with the shipped band-statistics source. See bandStats.ts, and see
 * `typicalForLevel` below for why `ErrorEntry.typical` is NOT that flag.
 *
 * ── PAIRING AN ERROR WITH WHAT IT COST ───────────────────────────────────────
 *
 * The ranking needs, per occurrence, how much expected score it lost. An
 * `ErrorEntry` carries its ply and the game it came from; a `ReviewedMove` carries
 * the `drop`. So the two are joined on `ply` within one review, which is exact —
 * `errorsFrom` builds each entry FROM a move, and `ply` is that move's index.
 *
 * A join that missed would be the quiet failure here: an unmatched error would
 * contribute a zero loss and its theme would rank last however often it happened.
 * So an unmatched error is counted, and the count is asserted to be zero by the
 * test suite rather than assumed. It is a fact about the data, not a fallback.
 */

export const TOP_WEAKNESSES = 3;

/** How many occurrences were paired with the move that caused them, and how many were not. */
export interface JoinAudit {
  matched: number;
  unmatched: number;
}

/** The per-game-rate metric each theme is compared on, for F-SW-5's flag. */
const THEME_METRIC: Record<Theme, BandMetric | null> = {
  hung_piece: 'hungPiecesPerGame',
  missed_capture: 'missedFreePiecesPerGame',
  missed_mate: 'missedMatesPerGame',
  ignored_threat: 'ignoredThreatsPerGame',
  // No metric: "mistakes we could not classify" is not a category any population
  // statistic could be mined for, because the classification is this app's own
  // tagger and its coverage will change. A comparison here would be meaningless
  // even with the data, so it is absent by construction rather than by absence.
  unclassified: null,
};

export interface WeaknessContext {
  /** Newest game first. The index IS the recency rank — see recency.ts. */
  games: readonly ProfileGame[];
  bucket: Bucket | null;
  source: BandStatsSource;
  comparisonsAllowed: boolean;
  early: boolean;
}

/**
 * F-SW-3's flag.
 *
 * NOT `ErrorEntry.typical`. src/review/errorLog.ts documents that field as a
 * deliberate SUBSTITUTE — "a statement about the curriculum, never about other
 * learners" — recording whether the section the learner is in teaches the theme.
 * Presenting it as "most players at your level miss this too" would put a claim
 * about other people's chess in front of the learner on the strength of a field
 * whose own comment says it is not one. So the flag is derived only from band
 * statistics, and is `{ known: false }` when there are none.
 *
 * The threshold for "unusual": the learner's rate is more than a third away from
 * the population's, in either direction. Coarse on purpose, for the reason
 * bandStats.ts gives about wording — a learner's twelve games do not support a
 * finer claim than that.
 */
function typicalForLevel(ctx: WeaknessContext, theme: Theme, ratePerGameValue: number | null): TypicalForLevel {
  const metric = THEME_METRIC[theme];
  if (metric === null || ratePerGameValue === null || !ctx.comparisonsAllowed || ctx.bucket === null) {
    return { known: false };
  }
  // `comparisonFor` is asked FIRST, and it owns every gate on the source — no
  // data, no statistic for this metric, no bucket. An earlier draft repeated the
  // `hasData` check here, and a mutation run showed the repeat could be deleted
  // without a single test noticing: it was unreachable behind the same gate one
  // layer down. A guard no test can distinguish from its absence is not a guard,
  // so there is one, here, and the population is read only after it has passed.
  const wording = comparisonFor({
    metric,
    learner: ratePerGameValue,
    bucket: ctx.bucket,
    source: ctx.source,
    early: ctx.early,
  });
  if (wording === null) return { known: false };
  const population = ctx.source.typicalFor(ctx.bucket, metric);
  if (population === null) return { known: false };
  // Within a third of the population either way is "typical at your level".
  const typical = population === 0 ? ratePerGameValue === 0 : Math.abs(ratePerGameValue / population - 1) <= 1 / 3;
  return { known: true, typical, wording };
}

/**
 * Every theme, ranked by F-SW-3's cost, costliest first.
 *
 * Themes with no occurrences are dropped: a weakness that never happened is not a
 * weakness, and padding the list to three would put a made-up problem in front of
 * a learner who does not have it. Fewer than three is a real answer.
 */
export function rankWeaknesses(ctx: WeaknessContext): { weaknesses: Weakness[]; join: JoinAudit } {
  const occurrences = new Map<Theme, Occurrence[]>();
  const gamesWith = new Map<Theme, Set<string>>();
  const join: JoinAudit = { matched: 0, unmatched: 0 };

  ctx.games.forEach((game, rank) => {
    // One lookup table per game rather than a scan per error: a 500-game history
    // with eighty moves each would otherwise be a quadratic walk on every render
    // of the Progress tab.
    const dropByPly = new Map<number, number>();
    for (const m of game.review.moves) {
      if (m.mover === game.review.learner) dropByPly.set(m.ply, m.drop);
    }
    for (const e of game.review.errors) {
      const theme = Object.prototype.hasOwnProperty.call(THEME_LESSON, e.theme) ? (e.theme as Theme) : 'unclassified';
      const drop = dropByPly.get(e.ply);
      if (drop === undefined) join.unmatched += 1;
      else join.matched += 1;
      const list = occurrences.get(theme) ?? [];
      list.push({ gameRank: rank, expectedScoreLost: expectedScoreLostFromDrop(drop ?? 0) });
      occurrences.set(theme, list);
      const seen = gamesWith.get(theme) ?? new Set<string>();
      seen.add(game.gameId);
      gamesWith.set(theme, seen);
    }
  });

  const weaknesses: Weakness[] = [];
  for (const [theme, list] of occurrences) {
    const c = costOf(list);
    if (c.occurrences === 0) continue;
    const lesson = lessonFor(theme);
    weaknesses.push({
      theme,
      name: THEME_NAME[theme],
      occurrences: c.occurrences,
      games: gamesWith.get(theme)?.size ?? 0,
      cost: c.cost,
      weightedOccurrences: c.weightedOccurrences,
      meanExpectedScoreLost: c.meanExpectedScoreLost,
      typicalForLevel: typicalForLevel(ctx, theme, ratePerGame(c.occurrences, ctx.games.length)),
      lessonId: lesson?.id ?? null,
      lessonTitle: lesson?.title ?? null,
      drill: drillFor(theme),
    });
  }

  // Cost first; ties broken by raw occurrences and then by name, so the order is
  // deterministic. Two themes CAN tie exactly — the all-zero-drop case, where
  // every error was a Miss the engine scored at no loss — and Map iteration order
  // would otherwise decide which weakness a learner is told to fix first.
  weaknesses.sort((a, b) => b.cost - a.cost || b.occurrences - a.occurrences || a.name.localeCompare(b.name));
  return { weaknesses, join };
}

/** F-SW-3's "three weaknesses that cost the most". */
export function topWeaknesses(ctx: WeaknessContext): Weakness[] {
  return rankWeaknesses(ctx).weaknesses.slice(0, TOP_WEAKNESSES);
}

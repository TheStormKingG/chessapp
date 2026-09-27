import { comparisonFor, type BandMetric, type BandStatsSource, type Bucket } from './bandStats';
import { openingLines, ratePerGame, type GameMetrics, type Totals } from './metrics';
import type { Phase } from '@/review/types';
import type { Theme } from '@/review/errorLog';
import type { Strength } from './types';

/**
 * F-SW-2, "Strengths first", verbatim:
 *
 * > "The profile opens with three things the learner does well, chosen from
 * > patterns they find more often than typical players at their level, phases in
 * > which their accuracy is above their band, openings they score well in, and
 * > habit rules they keep. The research on mastery goals says learners who see
 * > what they can do keep going, so strengths are never an afterthought."
 *
 * ── FOUR SOURCES, TWO OF WHICH NEED THE BAND DATA ────────────────────────────
 *
 * Two of the four are comparisons against other players and cannot be made
 * without the rating-bucketed statistics F-SW-5 needs (bandStats.ts). They are
 * built here anyway, behind the same seam as everything else, and they produce
 * nothing with the shipped source.
 *
 * Two are self-contained and ship working:
 *
 *  - **Openings they score well in.** A line with enough games and a score above
 *    a stated bar. Entirely the learner's own record.
 *  - **Habit rules they keep.** A theme that has NOT occurred across a run of
 *    games. This is the honest version of F-PG-1's habit score, which does not
 *    exist: "you have not left a piece free to take in your last fourteen games"
 *    is a count, it is checkable by scrolling the game list, and the habit it
 *    names is the one the curriculum teaches under that theme's lesson.
 *
 * And one substitute, worded so it cannot be mistaken for a band comparison:
 *
 *  - **The learner's strongest phase**, stated against their OWN other phases.
 *    F-SW-2 asks for "phases in which their accuracy is above their band"; this is
 *    "above your own other phases", which is a different and smaller claim. The
 *    sentence says which it is, in words, so no learner reads it as a statement
 *    about other players.
 *
 * ── WHY THERE CAN BE FEWER THAN THREE ────────────────────────────────────────
 *
 * F-SW-2 says three. A learner with two demonstrable strengths gets two. Padding
 * to three means inventing one, and a strength a learner does not have is worse
 * than a short list: it is the same false claim as a fabricated comparison, told
 * in a friendlier voice, and it devalues the two that are real.
 */

export const TOP_STRENGTHS = 3;

/**
 * The shortest run over which "you have not done X" means anything.
 *
 * Deliberately below F-SW-6's ten-game comparison floor, because this is a COUNT
 * and not a comparison — F-SW-6's floor governs comparisons. Five is the point at
 * which a clean run stops being indistinguishable from "it did not come up": with
 * two or three games a learner who never reached a middlegame has a clean sheet on
 * every middlegame theme.
 */
export const CLEAN_RUN_MIN_GAMES = 5;

/** The fewest games in one opening line before its score means anything. */
export const LINE_MIN_GAMES = 3;

/** Score out of one — the bar for "an opening they score well in". */
export const GOOD_LINE_SCORE = 0.6;

/** How many accuracy points one phase must beat the others by to be "strongest". */
export const PHASE_GAP_POINTS = 5;

const PHASE_NAME: Record<Phase, string> = {
  opening: 'opening',
  middlegame: 'middlegame',
  endgame: 'endgame',
};

/** The band metric each theme would be compared on, for the two band-fed sources. */
const THEME_METRIC: Record<Theme, BandMetric | null> = {
  hung_piece: 'hungPiecesPerGame',
  missed_capture: 'missedFreePiecesPerGame',
  missed_mate: 'missedMatesPerGame',
  ignored_threat: 'ignoredThreatsPerGame',
  unclassified: null,
};

const PHASE_METRIC: Record<Phase, BandMetric> = {
  opening: 'accuracyOpening',
  middlegame: 'accuracyMiddlegame',
  endgame: 'accuracyEndgame',
};

export interface StrengthContext {
  totals: Totals;
  games: readonly GameMetrics[];
  bucket: Bucket | null;
  source: BandStatsSource;
  comparisonsAllowed: boolean;
  early: boolean;
}

/** A candidate with the rank it competes at. Higher wins. */
interface Candidate extends Strength {
  rank: number;
}

/**
 * F-SW-2's first source: patterns the learner avoids more than their band does.
 *
 * Produces nothing without band statistics, which is the shipped state.
 */
function bandPatterns(ctx: StrengthContext): Candidate[] {
  const out: Candidate[] = [];
  if (!ctx.comparisonsAllowed) return out;
  for (const [theme, metric] of Object.entries(THEME_METRIC) as [Theme, BandMetric | null][]) {
    if (metric === null) continue;
    const rate = ratePerGame(ctx.totals.themeCounts[theme], ctx.totals.games);
    if (rate === null) continue;
    const population = ctx.bucket === null || !ctx.source.hasData ? null : ctx.source.typicalFor(ctx.bucket, metric);
    if (population === null || population === 0) continue;
    // A strength, not merely a difference: clearly below the population.
    if (rate / population > 0.7) continue;
    const wording = comparisonFor({ metric, learner: rate, bucket: ctx.bucket, source: ctx.source, early: ctx.early });
    if (wording === null) continue;
    out.push({
      id: `band-${theme}`,
      kind: 'pattern',
      text: wording,
      evidence: { theme, ratePerGame: rate, typicalForBand: population, games: ctx.totals.games },
      rank: 100,
    });
  }
  return out;
}

/** F-SW-2's second source: a phase the learner plays better than their band. */
function bandPhases(ctx: StrengthContext): Candidate[] {
  const out: Candidate[] = [];
  if (!ctx.comparisonsAllowed) return out;
  for (const phase of ['opening', 'middlegame', 'endgame'] as Phase[]) {
    const mine = ctx.totals.accuracyByPhase[phase];
    if (mine === null) continue;
    const metric = PHASE_METRIC[phase];
    const population = ctx.bucket === null || !ctx.source.hasData ? null : ctx.source.typicalFor(ctx.bucket, metric);
    if (population === null || mine - population < PHASE_GAP_POINTS) continue;
    const wording = comparisonFor({ metric, learner: mine, bucket: ctx.bucket, source: ctx.source, early: ctx.early });
    if (wording === null) continue;
    out.push({
      id: `band-phase-${phase}`,
      kind: 'phase',
      text: wording,
      evidence: { phase, accuracy: mine, typicalForBand: population },
      rank: 95,
    });
  }
  return out;
}

/** F-SW-2's fourth source: a habit rule kept, stated as a clean run. */
function cleanHabits(ctx: StrengthContext): Candidate[] {
  const out: Candidate[] = [];
  const n = ctx.totals.games;
  if (n < CLEAN_RUN_MIN_GAMES) return out;
  const HABIT_TEXT: Partial<Record<Theme, string>> = {
    hung_piece: 'You have not left a piece free to take',
    missed_capture: 'You have not missed free material',
    missed_mate: 'You have not missed a mate in one',
    ignored_threat: 'You have answered every threat your opponent made',
  };
  for (const [theme, lead] of Object.entries(HABIT_TEXT) as [Theme, string][]) {
    if (ctx.totals.themeCounts[theme] !== 0) continue;
    out.push({
      id: `clean-${theme}`,
      kind: 'habit',
      text: `${lead} in your last ${String(n)} ${n === 1 ? 'game' : 'games'}.`,
      evidence: { theme, occurrences: 0, games: n },
      rank: 80,
    });
  }
  return out;
}

/** F-SW-2's third source: an opening the learner scores well in. */
function goodOpenings(ctx: StrengthContext): Candidate[] {
  const out: Candidate[] = [];
  for (const line of openingLines(ctx.games)) {
    if (line.games < LINE_MIN_GAMES) continue;
    const score = (line.wins + line.draws * 0.5) / line.games;
    if (score < GOOD_LINE_SCORE) continue;
    const side = line.colour === 'w' ? 'White' : 'Black';
    out.push({
      id: `line-${line.colour}-${line.name}`,
      kind: 'opening',
      // The record is stated rather than the score, so the learner can check it.
      text: `You score well in the ${line.name} as ${side}: ${String(line.wins)} won, ${String(line.draws)} drawn, ${String(line.losses)} lost.`,
      evidence: {
        opening: line.name,
        colour: side,
        games: line.games,
        wins: line.wins,
        draws: line.draws,
        losses: line.losses,
      },
      // Ranked by how well they score, so the best line wins among lines.
      rank: 60 + score * 10,
    });
  }
  return out;
}

/**
 * The self-relative phase substitute.
 *
 * Worded as "your strongest phase" and never as a comparison with anyone. It is
 * suppressed when a band-fed phase strength exists, so the learner never sees a
 * weaker claim about the same phase beside the stronger one.
 */
function strongestOwnPhase(ctx: StrengthContext): Candidate[] {
  const measured = (['opening', 'middlegame', 'endgame'] as Phase[])
    .map((p) => ({ p, a: ctx.totals.accuracyByPhase[p] }))
    .filter((x): x is { p: Phase; a: number } => x.a !== null)
    .sort((x, y) => y.a - x.a);
  const best = measured[0];
  const next = measured[1];
  if (!best || !next || best.a - next.a < PHASE_GAP_POINTS) return [];
  return [
    {
      id: `own-phase-${best.p}`,
      kind: 'phase',
      text: `Your ${PHASE_NAME[best.p]} is your most accurate phase: ${String(best.a)}% against ${String(next.a)}% in the ${PHASE_NAME[next.p]}. This compares your phases with each other, not with other players.`,
      evidence: { phase: best.p, accuracy: best.a, nextPhase: next.p, nextAccuracy: next.a },
      rank: 50,
    },
  ];
}

/** F-SW-2's three, or fewer when fewer are real. */
export function topStrengths(ctx: StrengthContext): Strength[] {
  const band = [...bandPatterns(ctx), ...bandPhases(ctx)];
  const own = band.some((c) => c.kind === 'phase') ? [] : strongestOwnPhase(ctx);
  const all = [...band, ...cleanHabits(ctx), ...goodOpenings(ctx), ...own];
  all.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
  return all.slice(0, TOP_STRENGTHS).map(({ rank: _rank, ...s }) => s);
}

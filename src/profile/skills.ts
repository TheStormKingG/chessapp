import { comparisonFor, type BandMetric, type BandStatsSource, type Bucket } from './bandStats';
import { openingLines, ratePerGame, type GameMetrics, type Totals } from './metrics';
import { SKILL_IDS, SKILL_TITLE, type DetailRow, type Measure, type SkillBreakdown, type SkillId } from './types';
/*
 * From `@/vision/bests`, NOT from `@/vision`. The barrel re-exports the census and
 * the trainer, so it pulls chess.js and a board; `bests.ts` is zustand plus a
 * type. `useProfile` is on the Progress tab's static graph, so the difference is
 * the difference between the shell paying for the vision trainer and not.
 */
import { MODE_TITLE, VISION_MODES, type VisionMode } from '@/vision/types';
import { modesAttempted, type VisionBests } from '@/vision/bests';

/**
 * F-SW-4, "The detail behind each skill", verbatim:
 *
 * > "Tapping a skill opens its breakdown. Tactics shows each pattern with found,
 * > missed and allowed counts. Endgames shows accuracy by ending type and
 * > conversions of winning positions. Openings shows the learner's five most
 * > played lines as White and Black with results, accuracy, and the move at which
 * > they usually leave the book, plus what players at their level play there.
 * > Board vision shows pieces left hanging and free pieces missed per game.
 * > Thinking and habits shows the habit score trend, moves made in under ten
 * > seconds, and blunders in winning positions. Strategy shows accuracy in quiet
 * > positions and in positions with no forcing moves."
 *
 * ── WHAT IS BUILT AND WHAT IS DECLARED MISSING ───────────────────────────────
 *
 * Eleven of the fourteen things that sentence asks for are computed from records
 * the review layer already banks. Three cannot be, and each one's `notMeasured`
 * entry names the missing record rather than the missing feature, so a reader can
 * check the claim:
 *
 *  1. Tactics' per-pattern FOUND counts. The review tags mistakes with the pattern
 *     they involve; a correct move is not tagged at all. So "how many forks you
 *     saw" has no record behind it, while "how many you missed" does.
 *  2. Endgames by ENDING TYPE. Nothing in src/ classifies an ending as a rook
 *     ending or a pawn ending.
 *  3. Habits' HABIT SCORE and moves under ten seconds. No habit checklist is
 *     scored anywhere in the app, and `ErrorEntry.clockMs` is null for every game
 *     in this release (src/review/errorLog.ts states why), so neither has a value
 *     to trend.
 *
 * And F-SW-4's own band comparison — "what players at their level play there" —
 * is the F-SW-5 dependency, handled the same way everything else in this feature
 * handles it: the mechanism is wired, the source has no data, the comparison is
 * absent. See bandStats.ts.
 *
 * ── THE HEADLINE IS A ROW, NOT A COMPOSITE ───────────────────────────────────
 *
 * F-PG-1 asks for "a mastery percentage" per skill. This module's headline for
 * each skill is its FIRST ROW, unchanged — never a weighted blend of the rows.
 * A blend would need weights the PRD does not give, would be unfalsifiable by the
 * learner, and is exactly the invented metric the Progress screen's own header
 * comment refuses. The consequence is that two of the six headlines are per-game
 * rates rather than percentages, which is why `Measure` carries its unit.
 */

export interface SkillContext {
  totals: Totals;
  games: readonly GameMetrics[];
  bucket: Bucket | null;
  source: BandStatsSource;
  /** F-SW-6: are comparisons permitted at this sample size at all. */
  comparisonsAllowed: boolean;
  /** F-SW-6: do the permitted comparisons carry the "early" caveat. */
  early: boolean;
  /**
   * F-PG-1's "vision trainer scores", for Board vision.
   *
   * A device-local setting rather than a game record (src/vision/bests.ts says
   * why), so it arrives as an option on `buildProfile` rather than being derived
   * from the `games` above. All-zero is the state of a learner who has not opened
   * the trainer, and it renders as absent rather than as a measured zero.
   */
  visionBests: VisionBests;
}

/** A row whose value is a per-game rate. */
function rateRow(
  ctx: SkillContext,
  label: string,
  total: number,
  metric: BandMetric | null,
): DetailRow {
  const value = ratePerGame(total, ctx.totals.games);
  const measure: Measure =
    value === null ? { kind: 'absent', reason: 'No analysed games yet.' } : { kind: 'rate', value, per: 'game' };
  return { label, measure, comparison: compare(ctx, metric, value) };
}

/** A row whose value is already a percentage. */
function percentRow(
  ctx: SkillContext,
  label: string,
  value: number | null,
  metric: BandMetric | null,
  absentReason: string,
): DetailRow {
  const measure: Measure = value === null ? { kind: 'absent', reason: absentReason } : { kind: 'percent', value };
  return { label, measure, comparison: compare(ctx, metric, value) };
}

/**
 * A row that states a plain total over the window rather than a rate.
 *
 * `comparison` is always null and always will be: a total over the learner's own
 * window is not comparable with a population statistic without dividing it by
 * something, and the thing it would be divided by (how many chances there were)
 * is precisely what is not recorded.
 */
function countRow(label: string, total: number): DetailRow {
  return { label, measure: { kind: 'count', value: total }, comparison: null };
}

/**
 * One place where every gate on a comparison is applied.
 *
 * Three ways to get null, and all three must be checked here rather than at the
 * call sites: no value of the learner's own to compare, F-SW-6's sample floor, and
 * `comparisonFor`'s own gates (no rating bucket, no source data, no statistic for
 * this metric). Spreading them across fourteen rows is how one row eventually
 * shows a comparison the other thirteen are suppressing.
 */
function compare(ctx: SkillContext, metric: BandMetric | null, learner: number | null): string | null {
  if (metric === null || learner === null || !ctx.comparisonsAllowed) return null;
  return comparisonFor({ metric, learner, bucket: ctx.bucket, source: ctx.source, early: ctx.early });
}

const NO_GAMES = 'No analysed games yet.';

/**
 * F-PG-1: "Board vision (hanging pieces per game, vision trainer scores)".
 *
 * The second half of that used to be a `notMeasured` entry reading "There is no
 * vision trainer in the app yet, so there are no scores to include." F-PR-2 built
 * the trainer, so the entry is gone and the scores are rows — which is the whole
 * of what wiring it meant.
 *
 * A mode never played contributes an ABSENT row with its reason, not a zero:
 * `stars`-style, the distinction between "you scored nothing" and "you have not
 * tried this" is one the rest of src/profile keeps carefully and this keeps too.
 * The headline stays the FIRST row (see the module header) — hanging pieces per
 * game — because a per-round trainer score is not a mastery percentage and
 * promoting it would change what the skill's headline means.
 */
function boardVision(ctx: SkillContext): SkillBreakdown {
  const rows = [
    rateRow(ctx, 'Pieces left free to take, per game', ctx.totals.themeCounts.hung_piece, 'hungPiecesPerGame'),
    rateRow(ctx, 'Free pieces missed, per game', ctx.totals.themeCounts.missed_capture, 'missedFreePiecesPerGame'),
  ];
  for (const mode of VISION_MODES) rows.push(visionRow(ctx, mode));
  return breakdown('boardVision', rows, notMeasuredForVision(ctx.visionBests));
}

/** One vision mode's personal best, or its absence with the reason. */
function visionRow(ctx: SkillContext, mode: VisionMode): DetailRow {
  const best = ctx.visionBests[mode];
  const measure: Measure =
    best > 0
      ? { kind: 'count', value: best }
      : { kind: 'absent', reason: 'You have not played this vision-trainer mode yet.' };
  // No comparison: F-SW-5's band statistics are over GAMES, and there is no
  // population of vision-trainer scores to compare a learner against — see
  // bandStats.ts for what would have to exist.
  return { label: `Vision trainer, ${MODE_TITLE[mode].toLowerCase()} — best in 30 seconds`, measure, comparison: null };
}

/**
 * What Board vision still cannot report.
 *
 * Empty once all three trainer modes have been played, which is correct and is
 * the point: this skill's two game measures are both computed, so a learner who
 * has used the trainer has nothing absent from it. buildProfile.test.ts asserts
 * the SET of skills still declares something rather than requiring every skill to
 * — a universal that was only ever true because the trainer did not exist.
 */
function notMeasuredForVision(bests: VisionBests): string[] {
  const played = modesAttempted(bests);
  if (played === VISION_MODES.length) return [];
  return [
    `Vision-trainer scores for ${String(VISION_MODES.length - played)} of the ${String(VISION_MODES.length)} modes (F-PG-1). Those modes have not been played on this device, so there is no score to include. The trainer is in Practice.`,
  ];
}

function tactics(ctx: SkillContext): SkillBreakdown {
  const t = ctx.totals;
  const rows = [
    // Missed: the learner failed to take something that was there.
    rateRow(ctx, 'Free material missed, per game', t.themeCounts.missed_capture, 'missedFreePiecesPerGame'),
    rateRow(ctx, 'Mate in one missed, per game', t.themeCounts.missed_mate, 'missedMatesPerGame'),
    // Allowed: the learner let the opponent have something.
    rateRow(ctx, 'Threats ignored, per game', t.themeCounts.ignored_threat, 'ignoredThreatsPerGame'),
    countRow('Strong moves you found, in total', t.strongMovesFound),
  ];
  return breakdown('tactics', rows, [
    'Found counts per pattern (F-SW-4). The analysis tags a mistake with the pattern it involves; a correct move is not tagged, so there is no record of a fork you did see. The total above is the count of strong moves the review picked out, which is not the same thing.',
    'Twelve of the sixteen motifs in PRD §10.3 — forks and pins among them — are not tagged yet, so they cannot be counted. src/review/errorLog.ts refuses to guess a pattern, and so does this.',
  ]);
}

function endgames(ctx: SkillContext): SkillBreakdown {
  const t = ctx.totals;
  const converted =
    t.winningPositions === 0 ? null : Number(((t.winningPositionsWon / t.winningPositions) * 100).toFixed(1));
  const rows = [
    percentRow(
      ctx,
      'Endgame accuracy',
      t.accuracyByPhase.endgame,
      'accuracyEndgame',
      t.games === 0 ? NO_GAMES : 'None of these games reached an endgame.',
    ),
    percentRow(
      ctx,
      `Winning positions converted (${String(t.winningPositionsWon)} of ${String(t.winningPositions)})`,
      converted,
      'wonFromWinningPercent',
      t.games === 0 ? NO_GAMES : 'You have not been in a winning position in these games.',
    ),
  ];
  return breakdown('endgames', rows, [
    'Accuracy by ending type (F-SW-4). Nothing in the app classifies an ending as a rook ending, a pawn ending or any other type, so accuracy cannot be split by type. The single endgame accuracy above is what the phase definition in src/review/phase.ts supports.',
  ]);
}

function openings(ctx: SkillContext): SkillBreakdown {
  const rows: DetailRow[] = [
    percentRow(
      ctx,
      'Opening accuracy',
      ctx.totals.accuracyByPhase.opening,
      'accuracyOpening',
      ctx.totals.games === 0 ? NO_GAMES : 'No non-book opening moves in these games.',
    ),
  ];
  // F-SW-4's five lines per colour, each as one row so that every number on the
  // screen is a sentence a screen reader reads out in order.
  for (const line of openingLines(ctx.games)) {
    const side = line.colour === 'w' ? 'White' : 'Black';
    const book =
      line.leavesBookAtMove === null
        ? 'never left the book'
        : `usually leaves the book at move ${String(line.leavesBookAtMove)}`;
    rows.push(
      percentRow(
        ctx,
        `${line.name} as ${side} — ${String(line.games)} ${line.games === 1 ? 'game' : 'games'}, ${String(line.wins)} won, ${String(line.draws)} drawn, ${String(line.losses)} lost, ${book}`,
        line.accuracy,
        'accuracyOpening',
        'No non-book opening moves in this line.',
      ),
    );
  }
  return breakdown('openings', rows, [
    'What players at your level play in these lines (F-SW-4). This needs the rating-bucketed statistics F-SW-5 describes, and no such statistics exist in the app — see src/profile/bandStats.ts for exactly what would have to be mined.',
    'Lines are named by the opening book, which is fetched when a review runs and is absent offline. A game with no name is left out rather than pooled, so this list can be shorter than your history.',
  ]);
}

function strategy(ctx: SkillContext): SkillBreakdown {
  const t = ctx.totals;
  const rows = [
    percentRow(
      ctx,
      'Accuracy when no forcing move was on the table',
      t.accuracyNoForcingMove,
      'accuracyQuiet',
      t.games === 0 ? NO_GAMES : 'Every position in these games had a capture or a check in it.',
    ),
    percentRow(
      ctx,
      'Middlegame accuracy',
      t.accuracyByPhase.middlegame,
      'accuracyMiddlegame',
      t.games === 0 ? NO_GAMES : 'None of these games reached a middlegame.',
    ),
  ];
  return breakdown('strategy', rows, [
    'F-SW-4 asks for "quiet positions" and "positions with no forcing moves" separately. One measure serves both, because what a review banks per move is the move you played and the engine\'s best move — and nothing in that distinguishes the two phrasings. A position counts as having no forcing move when neither of those two was a capture or a check, so the count leans towards calling a position quiet rather than away from it.',
  ]);
}

function habits(ctx: SkillContext): SkillBreakdown {
  const t = ctx.totals;
  const rows = [
    rateRow(ctx, 'Blunders in winning positions, per game', t.blundersWhenWinning, 'blundersWhenWinningPerGame'),
    rateRow(ctx, 'Blunders, per game', t.blunders, 'blundersPerGame'),
    rateRow(ctx, 'Mistakes, per game', t.mistakes, 'mistakesPerGame'),
  ];
  return breakdown('habits', rows, [
    'The habit-score trend (F-PG-1, F-SW-4). Nothing in the app scores a game against a habit checklist, so there is no score and no trend. The blunder-in-a-winning-position count above is the one habit measure the review does support.',
    'Moves made in under ten seconds (F-SW-4). Per-move clock time is never persisted — src/review/errorLog.ts records clockMs as null for every game in this release — so there is nothing to count.',
  ]);
}

/** Assembles a breakdown and takes the headline from the first row. */
function breakdown(id: SkillId, rows: DetailRow[], notMeasured: string[]): SkillBreakdown {
  const first = rows[0];
  return {
    id,
    title: SKILL_TITLE[id],
    headline: first ? first.measure : { kind: 'absent', reason: NO_GAMES },
    rows,
    notMeasured,
  };
}

const BUILDERS: Record<SkillId, (ctx: SkillContext) => SkillBreakdown> = {
  boardVision,
  tactics,
  endgames,
  openings,
  strategy,
  habits,
};

/**
 * All six, in F-PG-1's order.
 *
 * Driven by `SKILL_IDS` rather than by this module's own object-key order, so the
 * order is declared once, in types.ts, beside the requirement it comes from.
 */
export function skillBreakdowns(ctx: SkillContext): SkillBreakdown[] {
  return SKILL_IDS.map((id) => BUILDERS[id](ctx));
}

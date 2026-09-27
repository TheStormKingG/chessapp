/**
 * F-SW-5, "Compared with your level", verbatim:
 *
 * > "Every number in the profile sits beside the typical value for the learner's
 * > band, taken from the rating-bucketed mistake statistics mined from the Lichess
 * > database (section 9.1). The comparison is worded, never just a number ('you
 * > hang pieces about half as often as most 800s')."
 *
 * ══ THE DATA THIS NEEDS DOES NOT EXIST IN THIS REPOSITORY ════════════════════
 *
 * Nothing here invents it. This module is the SEAM: the mechanism that turns a
 * band statistic into the sentence F-SW-5 asks for, plus a source interface with
 * exactly one implementation — `NO_BAND_STATS`, which has no statistics and says
 * so. With that source every comparison in the profile is ABSENT. Not zero, not
 * neutral, not "about the same": absent, and the screen says why.
 *
 * That is F-SW-6's own mode extended one step. F-SW-6 already says "Below ten
 * games it shows only counts and no comparisons", so counts-without-comparisons
 * is a shipped state of this feature, specified, designed and rendered. Missing
 * band data lands the profile in the same state for a different reason.
 *
 * Why not a plausible default. A sentence like "most players at your level miss
 * this too" is a claim about other people's chess, shown to a learner about their
 * own. It is the one kind of statement they cannot check from inside the app, and
 * F-CO-4 forbids stating what nothing verified. An absent comparison costs the
 * learner one sentence; a fabricated one costs them their reason to believe the
 * rest of the screen.
 *
 * What `src/review/bands.ts` is, since the name collides: PRD Appendix C's
 * move-LABEL thresholds — how big a win-per-cent drop counts as a Mistake for a
 * learner in Section 1 versus Section 4. It is a property of the curriculum, not
 * a measurement of any population, and it answers no part of F-SW-5.
 *
 * ── THE REQUIREMENT, PRECISELY ───────────────────────────────────────────────
 *
 * To fill `BandStatsSource` with real data, a mining pass over the Lichess
 * database (PRD §9.1) must produce, for each bucket and each metric in
 * `BAND_METRICS` below, the population's typical per-game value:
 *
 *   • Buckets. 100-point rating buckets — F-SW-5's own example is "most 800s",
 *     which is a 100-point bucket named by its floor. Below 400 and 2000-and-up
 *     as open-ended end buckets. See `bucketFor`.
 *   • Pool. Rapid, blitz and daily, separated, because F-IM-2 excludes bullet
 *     from the profile on the finding that its errors are clock-driven, and a
 *     blended statistic would smuggle that back in. Bullet may be mined but must
 *     be a fourth, separately keyed set.
 *   • Statistic. The MEDIAN per-game value, not the mean: every one of these
 *     metrics is a count with a long right tail, and "typical" in F-SW-5's
 *     sentence is the typical player rather than the average of a skewed
 *     distribution.
 *   • Definitions. Each metric must be mined with the SAME definition the app
 *     uses, which is not a matter of naming it the same. `hungPiecesPerGame` here
 *     means what `classify()` in src/review/errorLog.ts counts: a move by the
 *     learner, labelled Mistake, Blunder or Miss by Appendix C at the learner's
 *     band, after which `hangingPieces` reports more free pieces than before it.
 *     A mining pass that counted every hanging piece, or used a different
 *     engine depth, or a fixed label threshold instead of a banded one, would
 *     produce a number that is not comparable with the learner's own and would
 *     make every comparison wrong in a way no test here can see.
 *   • Sample floor. A bucket with fewer than some stated number of games must
 *     report no statistic rather than a noisy one, exactly as the learner's own
 *     side of the comparison is gated by F-SW-6.
 *   • Shape. A static asset under `public/data/`, fetched and cached like the
 *     opening book and the puzzle packs, so an offline profile compares or
 *     abstains rather than waiting on a network call.
 *
 * Until that asset exists, `NO_BAND_STATS` is the honest source and it is the one
 * wired in. `bandStats.test.ts` exercises the mechanism against a fake source, so
 * the day the asset lands the wiring is one line and is already tested.
 */

/**
 * Every metric the profile would compare. This list IS the data requirement: a
 * mining pass that produces these keys fills the feature, and one that produces
 * different keys does not.
 *
 * `perGame` metrics are counts divided by games; `percent` metrics are already
 * 0–100 and are compared as levels rather than as ratios (see `wordComparison`).
 */
export const BAND_METRICS = {
  hungPiecesPerGame: { unit: 'perGame', noun: 'hang pieces' },
  missedFreePiecesPerGame: { unit: 'perGame', noun: 'miss free pieces' },
  missedMatesPerGame: { unit: 'perGame', noun: 'miss mate in one' },
  ignoredThreatsPerGame: { unit: 'perGame', noun: 'ignore a threat' },
  blundersPerGame: { unit: 'perGame', noun: 'blunder' },
  mistakesPerGame: { unit: 'perGame', noun: 'make a mistake' },
  blundersWhenWinningPerGame: { unit: 'perGame', noun: 'blunder in a winning position' },
  accuracyOpening: { unit: 'percent', noun: 'opening accuracy' },
  accuracyMiddlegame: { unit: 'percent', noun: 'middlegame accuracy' },
  accuracyEndgame: { unit: 'percent', noun: 'endgame accuracy' },
  accuracyQuiet: { unit: 'percent', noun: 'accuracy in quiet positions' },
  leftBookAtMove: { unit: 'perGame', noun: 'leave the opening book' },
  wonFromWinningPercent: { unit: 'percent', noun: 'conversion of winning positions' },
} as const;

export type BandMetric = keyof typeof BAND_METRICS;

/** A bucket named by its floor. 800 means "most 800s" in F-SW-5's sentence. */
export interface Bucket {
  floor: number;
  /** How F-SW-5's sentence names the population: "most 800s". */
  name: string;
}

export const BUCKET_WIDTH = 100;
export const LOWEST_BUCKET = 400;
export const HIGHEST_BUCKET = 2000;

/**
 * The bucket a rating falls in, or null when there is no rating to bucket.
 *
 * Null is a real and currently UNIVERSAL answer. The app has no game-rating
 * estimate: `Progress.puzzleRating` is a puzzle rating and comparing a learner's
 * puzzle rating against a population's over-the-board mistake rates would be two
 * different scales pretending to be one. F-AC-5 gates the only other candidate —
 * an imported game's own Elo — behind the learner confirming the account is
 * theirs, which is a deliberate second reason this is null today.
 */
export function bucketFor(rating: number | null): Bucket | null {
  if (rating === null || !Number.isFinite(rating)) return null;
  const floor =
    rating < LOWEST_BUCKET
      ? LOWEST_BUCKET - BUCKET_WIDTH
      : Math.min(HIGHEST_BUCKET, Math.floor(rating / BUCKET_WIDTH) * BUCKET_WIDTH);
  return { floor, name: `${String(floor)}s` };
}

/**
 * Where a typical value comes from.
 *
 * One method, returning null freely. Returning null per metric rather than per
 * source matters: a mining pass will land some metrics before others, and a
 * source that had to answer all thirteen or none would delay every comparison
 * until the last one was mined.
 */
export interface BandStatsSource {
  /** True when this source can answer anything at all. */
  readonly hasData: boolean;
  /** The population's typical per-game value, or null. */
  typicalFor(bucket: Bucket, metric: BandMetric): number | null;
}

/**
 * The shipped source. It has nothing, and it says so.
 *
 * This is not a stub awaiting removal — it is the correct source until the mining
 * pass described above has run, and it is what makes every comparison in the
 * profile absent rather than wrong.
 */
export const NO_BAND_STATS: BandStatsSource = {
  hasData: false,
  typicalFor: () => null,
};

/**
 * F-SW-5's wording. "The comparison is worded, never just a number."
 *
 * The buckets are ratios of the learner's rate to the population's, and they are
 * deliberately coarse. A statistic mined from a population and a learner's
 * twelve games do not justify "1.34 times as often"; they justify "less often",
 * and the coarseness is the honesty. This is also the accessibility requirement
 * doing real work rather than being retrofitted: a sentence carries the comparison
 * with no colour, no arrow and no position on a bar, so it survives being read
 * aloud and it survives forced colours.
 *
 * Direction is NOT baked in. This function does not know whether more is worse:
 * `better` is supplied by the caller from the metric, so that "you blunder less
 * often" and "your endgame accuracy is higher" are both produced by one wording
 * table and neither is praised or scolded by accident.
 */
export interface ComparisonInput {
  /** What is being compared, phrased to follow "you": "hang pieces". */
  noun: string;
  learner: number;
  typical: number;
  /** How the population is named: "800s". */
  bucketName: string;
  /** F-SW-6's caveat, when the sample is between ten and thirty games. */
  early: boolean;
}

/** Ratio bands, coarsest honest description of each. */
const RATIO_WORDS: { upTo: number; words: string }[] = [
  { upTo: 0.4, words: 'far less often than' },
  { upTo: 0.6, words: 'about half as often as' },
  { upTo: 0.85, words: 'less often than' },
  { upTo: 1.15, words: 'about as often as' },
  { upTo: 1.75, words: 'more often than' },
  { upTo: 2.5, words: 'about twice as often as' },
  { upTo: Infinity, words: 'far more often than' },
];

function ratioWords(ratio: number): string {
  for (const band of RATIO_WORDS) if (ratio <= band.upTo) return band.words;
  // Unreachable: the last band's bound is Infinity. Kept so the function has a
  // total return type without a non-null assertion on the array read.
  return 'far more often than';
}

/**
 * The comparison sentence for a per-game RATE.
 *
 * A typical value of zero has no ratio, so it is worded as a level rather than
 * as a multiple — "you hang pieces more often than most 800s do" is true and
 * checkable when the population's median is zero, and "infinitely more often"
 * is not a sentence.
 */
export function wordRateComparison(input: ComparisonInput): string {
  const tail = `most ${input.bucketName}`;
  const caveat = input.early ? ' (early — this is on few games)' : '';
  if (input.typical === 0) {
    return input.learner === 0
      ? `You ${input.noun} about as often as ${tail}.${caveat}`
      : `You ${input.noun} more often than ${tail}.${caveat}`;
  }
  if (input.learner === 0) return `You do not ${input.noun} at all, unlike ${tail}.${caveat}`;
  return `You ${input.noun} ${ratioWords(input.learner / input.typical)} ${tail}.${caveat}`;
}

/**
 * The comparison sentence for a PERCENTAGE.
 *
 * A ratio of two percentages is meaningless to a reader — 60% is not "twice as
 * accurate" as 30% — so percentages are compared by difference, in points, and
 * worded on the same coarse scale.
 */
export function wordPercentComparison(input: ComparisonInput): string {
  const tail = `most ${input.bucketName}`;
  const caveat = input.early ? ' (early — this is on few games)' : '';
  const delta = input.learner - input.typical;
  const words =
    delta >= 10
      ? 'well above'
      : delta >= 3
        ? 'above'
        : delta > -3
          ? 'about the same as'
          : delta > -10
            ? 'below'
            : 'well below';
  return `Your ${input.noun} is ${words} ${tail}.${caveat}`;
}

/** Dispatches on the metric's declared unit, so no caller has to remember it. */
export function wordComparison(metric: BandMetric, input: Omit<ComparisonInput, 'noun'>): string {
  const spec = BAND_METRICS[metric];
  const full: ComparisonInput = { ...input, noun: spec.noun };
  return spec.unit === 'percent' ? wordPercentComparison(full) : wordRateComparison(full);
}

/**
 * The whole comparison step, in one call, for a caller that has a learner value
 * and may or may not have anything to compare it to.
 *
 * Null out is the absent comparison. Every gate that can produce it is checked
 * here so no screen has to remember the list: no bucket (no rating), no source
 * data, no statistic for this metric.
 */
export function comparisonFor(args: {
  metric: BandMetric;
  learner: number;
  bucket: Bucket | null;
  source: BandStatsSource;
  early: boolean;
}): string | null {
  if (args.bucket === null || !args.source.hasData) return null;
  const typical = args.source.typicalFor(args.bucket, args.metric);
  if (typical === null) return null;
  return wordComparison(args.metric, {
    learner: args.learner,
    typical,
    bucketName: args.bucket.name,
    early: args.early,
  });
}

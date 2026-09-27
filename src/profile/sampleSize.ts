import type { ComparisonAvailability, SampleConfidence } from './types';

/**
 * F-SW-6, "Confidence and sample size", verbatim:
 *
 * > "The profile shows how many games it is built on. Below ten games it shows
 * > only counts and no comparisons. From ten games it shows comparisons labelled
 * > 'early'. From thirty games the labels drop. The research shows three or four
 * > recurring patterns appear within about twenty games, so the profile is
 * > designed to be useful early without over-claiming."
 *
 * This is the spine of the whole feature, and it is a pure function of one
 * integer, so it is tested directly at every boundary rather than through a
 * screen. Both thresholds are inclusive lower bounds — "from ten games", "from
 * thirty games" — which is why the tests pin 9/10 and 29/30 and not 10/11.
 */

/** "From ten games it shows comparisons." */
export const COMPARISON_MIN_GAMES = 10;

/** "From thirty games the labels drop." */
export const LABEL_DROP_GAMES = 30;

/**
 * F-SW-6's rule, and nothing else.
 *
 * Deliberately takes only the game count. Whether a comparison has anything to
 * compare AGAINST is a different question with a different answer and a
 * different remedy (F-SW-5, and see `comparisonAvailability` below). Folding the
 * two into one function would make the sample-size rule untestable on its own,
 * and it is the rule most likely to be got wrong.
 *
 * A negative count is clamped rather than thrown on: the caller derives it from
 * an array length, so a negative is impossible today, and a future caller who
 * subtracts two counts should get "no comparisons" rather than an exception on
 * the Progress tab.
 */
export function confidenceOf(games: number): SampleConfidence {
  const n = Math.max(0, Math.floor(games));
  if (n < COMPARISON_MIN_GAMES) return { games: n, comparisons: false, label: null };
  if (n < LABEL_DROP_GAMES) return { games: n, comparisons: true, label: 'early' };
  return { games: n, comparisons: true, label: null };
}

/**
 * Whether a comparison can be shown, which needs a big enough sample AND
 * statistics to compare against.
 *
 * F-SW-6 defines the honest mode for one missing ingredient: "Below ten games it
 * shows only counts and no comparisons." This extends the same mode to the other
 * missing ingredient. No rating-bucketed mistake statistics exist in this
 * repository (bandStats.ts records the requirement), so with the shipped source
 * every comparison is ABSENT rather than wrong, at every sample size.
 *
 * The two reasons are distinguished because they are owed to the learner
 * differently: one is fixed by playing, the other cannot be fixed by the learner
 * at all, and a screen that said "play ten more games" while the real cause was
 * missing reference data would be telling them to do something that will not work.
 */
export function comparisonAvailability(games: number, hasBandStats: boolean): ComparisonAvailability {
  const c = confidenceOf(games);
  if (!c.comparisons) return { shown: false, reason: 'too-few-games' };
  if (!hasBandStats) return { shown: false, reason: 'no-band-data' };
  return { shown: true, label: c.label };
}

/**
 * F-SW-3's "with recent games weighted more heavily".
 *
 * ── THE CURVE IS A DECISION, NOT A READING ───────────────────────────────────
 *
 * The PRD says recent games count for more and does not say by how much. So the
 * curve below is chosen, and the choice is stated here rather than buried in an
 * arithmetic expression, because a reader who disagrees with it must be able to
 * find it and change one number.
 *
 * **Exponential decay over game RANK, half-life ten games.**
 *
 *     weight(rank) = 0.5 ** (rank / 10)      rank 0 = most recent game
 *
 * Four reasons, each of which rules out an alternative:
 *
 * 1. **Ten, because the PRD's own unit of "now" is twenty games.** F-SW-7
 *    compares "the last 20 games with the 20 before"; F-SW-6 says "three or four
 *    recurring patterns appear within about twenty games". A ten-game half-life
 *    gives the most recent twenty games 1 − 0.5² = 75% of the total weight of an
 *    unbounded history. That reproduces the PRD's own statement about what
 *    counts as current without importing its hard edge.
 *
 * 2. **Exponential rather than a step at game 20.** A step is what F-SW-7
 *    literally describes, and it is wrong for a RANKING: the twenty-first game
 *    would leave the window overnight and the order of the top three weaknesses
 *    could invert on a game the learner did not play. F-SW-7 is a comparison of
 *    two stated windows, which is a different job, and it keeps its step.
 *
 * 3. **Rank rather than elapsed time.** Every threshold in F-SW counts games —
 *    ten, twenty, thirty — never days. A learner who plays fifty games in a
 *    weekend and one a month later has fifty-one data points, and a time-decayed
 *    curve would collapse the weekend into a single point and let the stray game
 *    outweigh it.
 *
 * 4. **No cut-off.** Weight tends to zero and is never set to zero, so a game
 *    never stops contributing at an arbitrary index. At rank 100 a game carries
 *    about a thousandth of the newest game's weight, which is negligible without
 *    being a cliff — and the 500-game ceiling of F-IM-2 means the tail is
 *    bounded anyway.
 *
 * The one property worth pinning in a test rather than in prose: `HALF_LIFE_GAMES`
 * games back is worth exactly half, by construction. That is what makes the
 * constant readable as what it says it is.
 */

/** Games back at which a game's weight has halved. See the reasoning above. */
export const HALF_LIFE_GAMES = 10;

/**
 * The weight of the game at `rank`, where rank 0 is the most recent.
 *
 * A negative rank is clamped to 0 rather than producing a weight above 1: the
 * caller derives the rank from an array index, so it cannot be negative today,
 * and a weight above 1 would silently let one game count for more than a whole
 * game — the one direction in which this function can lie about the data.
 */
export function recencyWeight(rank: number): number {
  const r = Math.max(0, rank);
  return Math.pow(0.5, r / HALF_LIFE_GAMES);
}

/**
 * Weights for a list of games ordered newest first.
 *
 * Takes the ORDER as given and does not sort. Sorting here would hide the
 * question of what "recent" is keyed on — it is `playedAt`, decided once in
 * games.ts, so that an imported back-catalogue is ranked by when it was played
 * and not by when it happened to be imported.
 */
export function recencyWeights(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => recencyWeight(i));
}

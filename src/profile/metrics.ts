import { WINNING_WIN_PERCENT } from '@/review/keyMoments';
import { THEME_LESSON, type Theme } from '@/review/errorLog';
import type { Phase, Review, ReviewedMove } from '@/review/types';
import type { ProfileGame } from './types';

/**
 * Everything the profile measures, derived from records the review layer already
 * banked. No engine, no tagger, no network, no new storage.
 *
 * ── THE RULE THIS MODULE FOLLOWS ─────────────────────────────────────────────
 *
 * A number is computed here only when the data it needs is already on a `Review`
 * or on the `ProfileGame` around it. Where F-SW-4 asks for something the records
 * do not contain, this module computes NOTHING and the skill's `notMeasured` list
 * says what is missing and why (see skills.ts). That is the same discipline
 * src/review/errorLog.ts applies to its four-of-sixteen motifs: it is better to
 * have a short screen than a plausible one.
 *
 * Definitions are taken from the review layer wherever it has one. `phase` is
 * `phaseOf`'s, already on every move. Accuracy is `derivedFrom`'s — the mean of
 * per-move accuracies over NON-BOOK moves — restated per phase rather than
 * reinvented. "Winning" is `WINNING_WIN_PERCENT`, imported rather than copied.
 *
 * One thing that is NOT taken from the review layer, on purpose: `Review.counts`
 * counts every move in the game, both sides. Every count here is the learner's
 * own moves only, filtered on `mover === review.learner`. Reading `counts` for a
 * learner's blunders would roughly double them, and a bot's blunders are not the
 * learner's weakness.
 */

/** Per-move accuracy, rounded the way `derivedFrom` rounds a game's accuracy. */
function meanAccuracy(moves: readonly ReviewedMove[]): number | null {
  if (moves.length === 0) return null;
  return Number((moves.reduce((n, m) => n + m.accuracy, 0) / moves.length).toFixed(1));
}

/**
 * Whether a move is FORCING, decided from the notation the review already banked.
 *
 * ── AN APPROXIMATION, AND WHICH WAY IT IS WRONG ──────────────────────────────
 *
 * F-SW-4 asks Strategy for "accuracy in quiet positions and in positions with no
 * forcing moves". A proper answer needs every legal move in the position
 * classified, which means running the tagger over each of eighty positions per
 * game — work the review does not bank and which would have to be redone on every
 * render of the Progress tab.
 *
 * What IS banked is the move played and the engine's best move, in SAN. So a
 * position counts as having no forcing move when NEITHER of those two is a
 * capture or a check. In SAN that is exact and needs no board: `x` is a capture,
 * `+` and `#` are check and mate.
 *
 * The error direction is stated because it decides whether the measure can
 * mislead: a position where a capture existed but was neither played nor best is
 * classified as quiet. So this OVER-counts quiet positions and never
 * under-counts them, and the accuracy it reports is an accuracy over a superset
 * of the quiet positions. It cannot invent a quiet position that had a check in
 * it on either of the two moves a learner would actually consider.
 */
export function isForcing(san: string): boolean {
  return san.includes('x') || san.includes('+') || san.includes('#');
}

/** One game, measured. Every count is the learner's own. */
export interface GameMetrics {
  gameId: string;
  playedAt: string;
  result: 'win' | 'loss' | 'draw';
  learner: 'w' | 'b';
  /** The learner's non-book moves — the denominator every accuracy here uses. */
  ownMoves: number;
  themeCounts: Record<Theme, number>;
  blunders: number;
  mistakes: number;
  misses: number;
  /** F-SW-4, habits: a Blunder played from a position the learner was winning. */
  blundersWhenWinning: number;
  /** F-SW-4, endgames: was the learner ever in a winning position at all. */
  everWinning: boolean;
  accuracyByPhase: Record<Phase, number | null>;
  /** F-SW-4, strategy. See `isForcing` for what this is and is not. */
  accuracyNoForcingMove: number | null;
  noForcingMoves: number;
  /** F-SW-4, openings. Null when the book supplied no name (the offline case). */
  opening: { name: string; leftBookAtPly: number | null } | null;
  /** F-SW-4, tactics: good moves the learner found, per F-RV-4's `found` kind. */
  strongMovesFound: number;
  /** True when the analysis stopped at the 90-second wall (PRD F-RV-1). */
  partial: boolean;
}

const EMPTY_THEMES: Record<Theme, number> = {
  hung_piece: 0,
  missed_capture: 0,
  missed_mate: 0,
  ignored_threat: 0,
  unclassified: 0,
};

/**
 * `ErrorEntry.theme` is typed as a bare `string` on the stored row, so an entry
 * written by an older build — or by a tagger that gains a motif — can carry a
 * theme this module has never heard of.
 *
 * Unknown folds into `unclassified`, which is the same decision
 * src/puzzles/queue.ts makes and for the same reason: the alternative is a count
 * that silently vanishes, and a vanished mistake understates the learner's cost.
 */
function knownTheme(theme: string): Theme {
  return Object.prototype.hasOwnProperty.call(THEME_LESSON, theme) ? (theme as Theme) : 'unclassified';
}

export function measureGame(game: ProfileGame): GameMetrics {
  const r: Review = game.review;
  const own = r.moves.filter((m) => m.mover === r.learner);
  const ownScored = own.filter((m) => !m.book);

  const themeCounts: Record<Theme, number> = { ...EMPTY_THEMES };
  for (const e of r.errors) themeCounts[knownTheme(e.theme)] += 1;

  const byPhase = (p: Phase) => meanAccuracy(ownScored.filter((m) => m.phase === p));
  const quiet = ownScored.filter((m) => !isForcing(m.san) && !isForcing(m.best.san));

  return {
    gameId: game.gameId,
    playedAt: game.playedAt,
    result: game.result,
    learner: r.learner,
    ownMoves: ownScored.length,
    themeCounts,
    blunders: own.filter((m) => m.label === 'Blunder').length,
    mistakes: own.filter((m) => m.label === 'Mistake').length,
    misses: own.filter((m) => m.label === 'Miss').length,
    blundersWhenWinning: own.filter((m) => m.label === 'Blunder' && m.winBefore >= WINNING_WIN_PERCENT).length,
    everWinning: own.some((m) => m.winBefore >= WINNING_WIN_PERCENT),
    accuracyByPhase: { opening: byPhase('opening'), middlegame: byPhase('middlegame'), endgame: byPhase('endgame') },
    accuracyNoForcingMove: meanAccuracy(quiet),
    noForcingMoves: quiet.length,
    opening: r.opening,
    strongMovesFound: r.keyMoments.filter((k) => k.kind === 'found').length,
    partial: r.partial,
  };
}

/** A mean over the games that HAVE the measure, or null when none do. */
export function meanOf<T>(items: readonly T[], read: (t: T) => number | null): number | null {
  const values = items.map(read).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

/** A per-game rate. Zero games is null, never zero: no games is not "none". */
export function ratePerGame(total: number, games: number): number | null {
  if (games === 0) return null;
  return Number((total / games).toFixed(2));
}

/** One opening line the learner has played, as F-SW-4 lists them. */
export interface OpeningLine {
  name: string;
  colour: 'w' | 'b';
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Mean accuracy in the OPENING phase of those games. */
  accuracy: number | null;
  /**
   * The move number at which the learner usually leaves the book — the MEDIAN
   * over the games in this line that left it at all.
   *
   * Median rather than mean: one game that followed a line to move twenty-five
   * would drag a mean well past where the learner typically departs, and F-SW-4's
   * word is "usually". Null when every game in this line stayed in the book.
   */
  leavesBookAtMove: number | null;
}

/** Ply 0 is White's move 1, matching Summary.tsx's `moveNumber`. */
function moveNumber(ply: number): number {
  return Math.floor(ply / 2) + 1;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (upper === undefined) return null;
  if (sorted.length % 2 === 1) return upper;
  return lower === undefined ? upper : (lower + upper) / 2;
}

/**
 * F-SW-4: "the learner's five most played lines as White and Black with results,
 * accuracy, and the move at which they usually leave the book".
 *
 * Five per colour, not five in total: the requirement says "as White and Black",
 * and a learner whose White repertoire is settled and whose Black one is not
 * would otherwise see ten White lines and none of the thing they need.
 *
 * Games with no opening name are omitted rather than pooled into an "Unknown"
 * line. The name comes from the opening book, which is fetched at runtime and is
 * absent offline (`Summary.tsx` documents the same case), so an "Unknown" bucket
 * would be a measure of the learner's network rather than of their openings.
 */
export const LINES_PER_COLOUR = 5;

export function openingLines(games: readonly GameMetrics[]): OpeningLine[] {
  const byKey = new Map<string, GameMetrics[]>();
  for (const g of games) {
    if (g.opening === null) continue;
    const key = `${g.learner}\u0000${g.opening.name}`;
    const list = byKey.get(key);
    if (list) list.push(g);
    else byKey.set(key, [g]);
  }

  const lines: OpeningLine[] = [];
  for (const [, group] of byKey) {
    const first = group[0];
    if (first?.opening === undefined || first.opening === null) continue;
    lines.push({
      name: first.opening.name,
      colour: first.learner,
      games: group.length,
      wins: group.filter((g) => g.result === 'win').length,
      draws: group.filter((g) => g.result === 'draw').length,
      losses: group.filter((g) => g.result === 'loss').length,
      accuracy: meanOf(group, (g) => g.accuracyByPhase.opening),
      leavesBookAtMove: median(
        group
          .map((g) => g.opening?.leftBookAtPly)
          .filter((p): p is number => p !== null && p !== undefined)
          .map(moveNumber),
      ),
    });
  }

  // Most played first; ties broken by name so the order is stable across renders
  // rather than depending on Map insertion order, which depends on game order.
  const rank = (a: OpeningLine, b: OpeningLine) => b.games - a.games || a.name.localeCompare(b.name);
  return [
    ...lines.filter((l) => l.colour === 'w').sort(rank).slice(0, LINES_PER_COLOUR),
    ...lines.filter((l) => l.colour === 'b').sort(rank).slice(0, LINES_PER_COLOUR),
  ];
}

/** Everything the profile aggregates over a window of games. */
export interface Totals {
  games: number;
  themeCounts: Record<Theme, number>;
  /** How many distinct games each theme occurred in. */
  themeGames: Record<Theme, number>;
  blunders: number;
  mistakes: number;
  blundersWhenWinning: number;
  /** Games in which the learner was at some point winning. */
  winningPositions: number;
  /** Of those, how many they went on to win. */
  winningPositionsWon: number;
  accuracyByPhase: Record<Phase, number | null>;
  accuracyNoForcingMove: number | null;
  strongMovesFound: number;
  /** Games whose analysis stopped early, so the counts below them are floors. */
  partialGames: number;
}

export function totalsOf(games: readonly GameMetrics[]): Totals {
  const themeCounts: Record<Theme, number> = { ...EMPTY_THEMES };
  const themeGames: Record<Theme, number> = { ...EMPTY_THEMES };
  for (const g of games) {
    for (const key of Object.keys(themeCounts) as Theme[]) {
      const n = g.themeCounts[key];
      themeCounts[key] += n;
      if (n > 0) themeGames[key] += 1;
    }
  }
  const winning = games.filter((g) => g.everWinning);
  return {
    games: games.length,
    themeCounts,
    themeGames,
    blunders: games.reduce((n, g) => n + g.blunders, 0),
    mistakes: games.reduce((n, g) => n + g.mistakes, 0),
    blundersWhenWinning: games.reduce((n, g) => n + g.blundersWhenWinning, 0),
    winningPositions: winning.length,
    winningPositionsWon: winning.filter((g) => g.result === 'win').length,
    accuracyByPhase: {
      opening: meanOf(games, (g) => g.accuracyByPhase.opening),
      middlegame: meanOf(games, (g) => g.accuracyByPhase.middlegame),
      endgame: meanOf(games, (g) => g.accuracyByPhase.endgame),
    },
    accuracyNoForcingMove: meanOf(games, (g) => g.accuracyNoForcingMove),
    strongMovesFound: games.reduce((n, g) => n + g.strongMovesFound, 0),
    partialGames: games.filter((g) => g.partial).length,
  };
}

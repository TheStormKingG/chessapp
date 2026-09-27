import type { PlayItOut } from '@/lesson/challenges/goal';

/**
 * F-PR-1's drill catalogue.
 *
 * > "A Practice tab lists drills by category, mates (piece checkmates, mate
 * > patterns), motifs (fundamental and advanced), endgames (pawn, rook, minor
 * > piece) and the Section 1 mini-games, each with a goal, a par and stars."
 *
 * ── NOTHING HERE IS A NEW DRILL ──────────────────────────────────────────────
 *
 * Every entry names a `play_it_out` challenge that already exists in `content/`
 * and already runs: `src/lesson/challenges/PlayItOut.tsx` plays the position out
 * against the engine and `goal.ts` decides the outcome from the goal's kind and
 * its move budget. This module is an INDEX over that, so the Practice tab can
 * list them by category without a second drill runner and without a second
 * definition of what a drill is. `content/` is not touched.
 *
 * There are 28 such challenges. That is the whole population, and drills.test.ts
 * asserts it from the content tree in both directions — every indexed entry must
 * exist in content with the par recorded here, and every `play_it_out` in content
 * must be indexed. So a drill added to content and forgotten here fails the
 * suite instead of silently missing from the tab.
 *
 * ── WHY AN INDEX RATHER THAN A CONTENT SCAN AT RUNTIME ───────────────────────
 *
 * The lesson files are 1.5 MB. `import.meta.glob(..., { eager: true })` would
 * put all of it on the graph to read 28 goal budgets out of it — against PRD §11's
 * 300 KiB shell budget, which is why src/lesson/loader.ts globs LAZILY and loads
 * one lesson at a time. The tab needs the par of all 28 at once and the position
 * of none of them, so the 28 pars are recorded here (2 KB) and the position is
 * loaded from content, one lesson, when a learner opens a drill.
 *
 * The test is what makes that safe. It is a staleness guard, not a proof that the
 * numbers were typed correctly on the day: it fails the moment content and this
 * file disagree, whichever of the two moved.
 *
 * ── PAR IS THE CONTENT'S OWN MOVE BUDGET ────────────────────────────────────
 *
 * `goal.moves`, unchanged and not reinterpreted. In `goal.ts` it is a hard
 * budget: a `mate_in` drill FAILS at `learnerMoves >= goal.moves`, and a `hold`
 * drill PASSES on reaching it. So par means "within this many moves" for the
 * first three kinds and "for this many moves" for `hold`, which is why
 * `parLabel` below reads the kind rather than printing a bare number.
 *
 * ── AND STARS ARE src/lesson/stars.ts, UNCHANGED ────────────────────────────
 *
 * Not a second scheme. `stars({ hints, misses })` already scores a lesson, a
 * drill run produces exactly those two numbers (see PracticeDrillRoute), and
 * inventing a moves-against-par curve beside it would give the same drill two
 * different star ratings depending on which screen the learner reached it from.
 * See stars.ts for the 3/2/1 rule itself.
 */

/** F-PR-1's four categories, in the order the requirement lists them. */
export const DRILL_CATEGORIES = ['mates', 'motifs', 'endgames', 'mini-games'] as const;
export type DrillCategory = (typeof DRILL_CATEGORIES)[number];

export const CATEGORY_TITLE: Record<DrillCategory, string> = {
  mates: 'Mates',
  motifs: 'Motifs',
  endgames: 'Endgames',
  'mini-games': 'Section 1 mini-games',
};

/** The goal kinds `goal.ts` implements. Re-derived from it, never re-listed. */
export type DrillGoal = PlayItOut['goal']['kind'];

export interface Drill {
  /** The challenge's id inside its lesson, which is what the runner needs. */
  challengeId: string;
  lessonId: string;
  unit: string;
  category: DrillCategory;
  /** The sub-heading it sits under, from F-PR-1's parentheses. */
  group: string;
  goal: DrillGoal;
  /** The content's `goal.moves`. See the note above on what it means. */
  par: number;
  concept: string;
  /** The lesson's title. Two drills can share one, and 1.5.1 does. */
  title: string;
}

/**
 * The 28, in curriculum order.
 *
 * The CATEGORY of each is the one editorial judgement in this file — content
 * carries a `concept` tag and a unit, not one of F-PR-1's four names. The rule
 * applied: unit 1.5 is the piece checkmates, so it is `mates` even though it is
 * in Section 1; the rest of Section 1 is `mini-games`, which is what F-PR-1
 * means by the phrase; a `mate_in` goal outside Section 1 is a mate pattern;
 * units whose curriculum title names an ending are `endgames`; what is left is
 * `motifs`. drills.test.ts pins that every category is non-empty, so a rule
 * change that emptied one would fail rather than render a blank heading.
 */
export const DRILLS: readonly Drill[] = [
  { challengeId: '1.2.3-c6', lessonId: '1.2.3', unit: '1.2', category: 'mini-games', group: 'Section 1', goal: 'capture_all', par: 30, concept: 'take-free', title: "Take free pieces" },
  { challengeId: '1.2.4-c6', lessonId: '1.2.4', unit: '1.2', category: 'mini-games', group: 'Section 1', goal: 'promote', par: 20, concept: 'dont-hang', title: "Do not leave pieces free" },
  { challengeId: '1.2.5-c6', lessonId: '1.2.5', unit: '1.2', category: 'mini-games', group: 'Section 1', goal: 'hold', par: 12, concept: 'counting', title: "Counting attackers and defenders" },
  { challengeId: '1.3.4-c7', lessonId: '1.3.4', unit: '1.3', category: 'mini-games', group: 'Section 1', goal: 'mate_in', par: 15, concept: 'stalemate', title: "Stalemate" },
  { challengeId: '1.5.1-c6', lessonId: '1.5.1', unit: '1.5', category: 'mates', group: 'Piece checkmates', goal: 'mate_in', par: 12, concept: 'ladder-mate', title: "The ladder mate" },
  { challengeId: '1.5.1-c7', lessonId: '1.5.1', unit: '1.5', category: 'mates', group: 'Piece checkmates', goal: 'mate_in', par: 16, concept: 'ladder-mate', title: "The ladder mate" },
  { challengeId: '1.5.2-c6', lessonId: '1.5.2', unit: '1.5', category: 'mates', group: 'Piece checkmates', goal: 'mate_in', par: 14, concept: 'queen-mate', title: "King and queen against king" },
  { challengeId: '1.5.3-c6', lessonId: '1.5.3', unit: '1.5', category: 'mates', group: 'Piece checkmates', goal: 'mate_in', par: 22, concept: 'rook-mate', title: "King and rook against king" },
  { challengeId: '1.6.2-c7', lessonId: '1.6.2', unit: '1.6', category: 'mini-games', group: 'Section 1', goal: 'mate_in', par: 1, concept: 'checks-and-captures', title: "All checks and captures" },
  { challengeId: '1.6.3-c6', lessonId: '1.6.3', unit: '1.6', category: 'mini-games', group: 'Section 1', goal: 'hold', par: 8, concept: 'habit-one', title: "Your first full game with the coach" },
  { challengeId: '2.7.1-c7', lessonId: '2.7.1', unit: '2.7', category: 'endgames', group: 'Fundamental endings', goal: 'hold', par: 8, concept: 'draws', title: "What can and cannot mate" },
  { challengeId: '2.7.3-c7', lessonId: '2.7.3', unit: '2.7', category: 'endgames', group: 'Fundamental endings', goal: 'promote', par: 12, concept: 'promotion', title: "King in front of the pawn, and direct opposition" },
  { challengeId: '2.7.4-c7', lessonId: '2.7.4', unit: '2.7', category: 'endgames', group: 'Fundamental endings', goal: 'hold', par: 10, concept: 'draws', title: "The rook-pawn draw" },
  { challengeId: '2.7.5-c7', lessonId: '2.7.5', unit: '2.7', category: 'endgames', group: 'Fundamental endings', goal: 'promote', par: 6, concept: 'promotion', title: "The promotion race" },
  { challengeId: '2.7.6-c7', lessonId: '2.7.6', unit: '2.7', category: 'endgames', group: 'Fundamental endings', goal: 'promote', par: 14, concept: 'promotion', title: "Activate the king in the endgame" },
  { challengeId: '3.5.3-c7', lessonId: '3.5.3', unit: '3.5', category: 'mates', group: 'Mate patterns', goal: 'mate_in', par: 1, concept: 'stalemate', title: "Not stalemating him when you are winning" },
  { challengeId: '3.7.3-c8', lessonId: '3.7.3', unit: '3.7', category: 'motifs', group: 'Advanced', goal: 'promote', par: 6, concept: 'passed-pawn', title: "Passed pawns" },
  { challengeId: '3.9.2-c7', lessonId: '3.9.2', unit: '3.9', category: 'endgames', group: 'Fundamental endings', goal: 'hold', par: 10, concept: 'key-squares', title: "King and pawn against king, complete" },
  { challengeId: '3.9.3-c7', lessonId: '3.9.3', unit: '3.9', category: 'endgames', group: 'Fundamental endings', goal: 'hold', par: 10, concept: 'queen-vs-pawn', title: "Queen against a pawn on the seventh" },
  { challengeId: '3.9.4-c7', lessonId: '3.9.4', unit: '3.9', category: 'endgames', group: 'Fundamental endings', goal: 'capture_all', par: 10, concept: 'rook-vs-pawn', title: "Rook against a pawn" },
  { challengeId: '3.11.3-c6', lessonId: '3.11.3', unit: '3.11', category: 'mates', group: 'Mate patterns', goal: 'mate_in', par: 2, concept: 'forcing-line', title: "Forcing lines to three ply" },
  { challengeId: '4.4.1-c7', lessonId: '4.4.1', unit: '4.4', category: 'mates', group: 'Mate patterns', goal: 'mate_in', par: 2, concept: 'waiting-move', title: "Zugzwang as a weapon" },
  { challengeId: '4.7.4-c10', lessonId: '4.7.4', unit: '4.7', category: 'motifs', group: 'Advanced', goal: 'promote', par: 8, concept: 'passed-pawn', title: "Pawn majorities and creating a passed pawn" },
  { challengeId: '4.9.2-c8', lessonId: '4.9.2', unit: '4.9', category: 'endgames', group: 'Rook endings', goal: 'hold', par: 10, concept: 'draws', title: "The Philidor defence" },
  { challengeId: '4.9.5-c8', lessonId: '4.9.5', unit: '4.9', category: 'endgames', group: 'Rook endings', goal: 'promote', par: 12, concept: 'king-activity', title: "Cutting the king off" },
  { challengeId: '4.10.2-c8', lessonId: '4.10.2', unit: '4.10', category: 'endgames', group: 'Pawn endings and the wrong bishop', goal: 'promote', par: 8, concept: 'opposition', title: "Triangulation and outflanking" },
  { challengeId: '4.10.4-c9', lessonId: '4.10.4', unit: '4.10', category: 'endgames', group: 'Pawn endings and the wrong bishop', goal: 'hold', par: 10, concept: 'rook-pawn-draw', title: "The wrong-coloured bishop" },
  { challengeId: '4.10.5-c9', lessonId: '4.10.5', unit: '4.10', category: 'endgames', group: 'Pawn endings and the wrong bishop', goal: 'hold', par: 10, concept: 'colour-complex', title: "Opposite-coloured bishops and the drawing tendency" },
];

/** What the drill asks for, in a learner's words. */
export const GOAL_LABEL: Record<DrillGoal, string> = {
  mate_in: 'Deliver checkmate',
  promote: 'Make a queen',
  capture_all: 'Take everything',
  hold: 'Hold the draw',
};

/**
 * The par, worded so it cannot be misread.
 *
 * `hold` inverts the sense of the same number — `goal.ts` passes a hold drill on
 * REACHING the budget and fails the other three on reaching it — so a bare "par
 * 10" would mean "at most 10" on one card and "at least 10" on the next.
 */
export function parLabel(d: Drill): string {
  const moves = d.par === 1 ? '1 move' : `${String(d.par)} moves`;
  return d.goal === 'hold' ? `Survive ${moves}` : `Within ${moves}`;
}

/** The drills of one category, in catalogue order. */
export function drillsIn(category: DrillCategory): Drill[] {
  return DRILLS.filter((d) => d.category === category);
}

/** The groups of one category, in the order they first appear. */
export function groupsIn(category: DrillCategory): string[] {
  return [...new Set(drillsIn(category).map((d) => d.group))];
}

/** The key a drill's result is stored under. Unique: 1.5.1 has two drills. */
export function drillKey(d: Pick<Drill, 'lessonId' | 'challengeId'>): string {
  return `${d.lessonId}/${d.challengeId}`;
}

/** The drill a route's parameters name, or null when nothing matches. */
export function findDrill(lessonId: string | undefined, challengeId: string | undefined): Drill | null {
  if (lessonId === undefined || challengeId === undefined) return null;
  return DRILLS.find((d) => d.lessonId === lessonId && d.challengeId === challengeId) ?? null;
}

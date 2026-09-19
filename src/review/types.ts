import type { Color } from '@/rules';

/**
 * The review vocabulary. Every other file in src/review/ speaks it and none of
 * them redefine any of it.
 *
 * Design spec: docs/superpowers/specs/2026-09-19-game-review-design.md §4.4.
 */

/** PRD F-RV-2 and Appendix C. `Great` and `Brilliant` are key-moment-only. */
export type MoveLabel =
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Miss'
  | 'Blunder';

/** The four PRD sections, used as the Appendix C threshold bands. */
export type Band = 1 | 2 | 3 | 4;

export type Phase = 'opening' | 'middlegame' | 'endgame';

/**
 * What the analysis path consumes. An in-app game builds one of these by
 * joining `game_started` and `game_finished` on `gameId` (see gameSource.ts);
 * import (F-RV-9, out of scope) would build one from a PGN and change nothing
 * downstream. This is the seam.
 */
export interface ReviewSource {
  gameId: string;
  learner: Color;
  persona: string;
  sans: string[];
  result: 'win' | 'loss' | 'draw';
  timeControl: 'untimed' | '10+0';
  startedAt: string;
}

/** One position's first-pass result: MultiPV 1, one search. */
export interface AnalysedPosition {
  /** Index into `[startFen, ...fensAfterEachPly]`; 0 is the start position. */
  index: number;
  fen: string;
  /** Win per cent for the side to move at `fen`, i.e. the value with best play. */
  win: number;
  bestUci: string;
  pv: string[];
  depth: number;
}

/** A move, judged. */
export interface ReviewedMove {
  /** 0-based index into `ReviewSource.sans`. */
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  mover: Color;
  best: { uci: string; san: string };
  /** Win per cent for the mover at `fenBefore`, i.e. with best play. */
  winBefore: number;
  /** Win per cent for the mover after the move actually played. */
  winAfterPlayed: number;
  /** max(0, winBefore - winAfterPlayed). */
  drop: number;
  /** PRD 10.6 per-move accuracy from `drop`. */
  accuracy: number;
  label: MoveLabel;
  book: boolean;
  phase: Phase;
}

export type MomentKind = 'decided' | 'missed' | 'found' | 'swing';

/** PRD F-RV-4. */
export interface KeyMoment {
  ply: number;
  kind: MomentKind;
  /** Filled by the deeper second pass; null until it lands (PRD F-RV-1). */
  deeper: DeeperMoment | null;
  /** One to three sentences, built only from verified facts. Null when a fact was missing. */
  explanation: string | null;
  /** The lesson that teaches the idea, if the theme maps to one. */
  lessonId: string | null;
}

/** The MultiPV-2 second pass for one key moment. */
export interface DeeperMoment {
  depth: number;
  /** Win per cent for the mover, best line. */
  bestWin: number;
  /** Win per cent for the mover, second-best line. Null when only one legal move. */
  secondWin: number | null;
  bestUci: string;
  secondUci: string | null;
}

/** PRD F-RV-6. */
export interface ErrorEntry {
  gameId: string;
  ply: number;
  fenBefore: string;
  playedSan: string;
  bestSan: string;
  bestUci: string;
  label: 'Mistake' | 'Blunder' | 'Miss';
  theme: string;
  phase: Phase;
  /** null for untimed games, and for 10+0 until the clock is persisted (spec §7.3). */
  clockMs: number | null;
  lessonId: string | null;
  /** "the Section the learner is in teaches exactly this theme" (spec §9.6). */
  typical: boolean;
  createdAt: string;
}

/** PRD F-RV-3. The whole reviewed game, cached in Dexie and rebuildable. */
export interface Review {
  gameId: string;
  learner: Color;
  /** The depth the first pass actually ran at, after the ladder (spec §4.2). */
  depth: number;
  /** True while the 90-second wall has cut the pass short (PRD F-RV-1). */
  partial: boolean;
  moves: ReviewedMove[];
  /** null for a side with no non-book moves; renders as "—", never as 100. */
  accuracy: { w: number | null; b: number | null };
  counts: Partial<Record<MoveLabel, number>>;
  opening: { name: string; leftBookAtPly: number | null } | null;
  turningPhase: Phase | null;
  keyMoments: KeyMoment[];
  errors: ErrorEntry[];
  createdAt: string;
}

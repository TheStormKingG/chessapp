import type { Review } from '@/review/types';
import type { Theme } from '@/review/errorLog';
import type { Speed } from '@/import/types';

/**
 * The profile vocabulary (PRD §8.14, F-SW-1 … F-SW-8). Every other file in
 * src/profile/ speaks it and none of them redefine any of it.
 *
 * ── WHAT THIS MODULE IS ──────────────────────────────────────────────────────
 *
 * A PROJECTION, in the sense src/data/ uses the word: a pure function of
 * records that already exist. Nothing here is stored. The inputs are the cached
 * `Review` rows (themselves derived and rebuildable) plus the two facts a
 * `Review` does not carry — when the game was played and how it ended — which
 * come from the `imported` table for an imported game and from the event log
 * for an in-app one.
 *
 * So the profile re-derives on every read and there is no third copy of the
 * truth to migrate, to rebuild, or to find stale.
 */

/**
 * The six skills of F-PG-1, in F-PG-1's order.
 *
 * F-SW-1 says the profile "replaces the six bare skill bars of F-PG-1 with the
 * same six skills plus the detail behind each". There were never six bars:
 * src/screens/ProgressScreen.tsx shipped the path, the totals and nothing else,
 * so this is the first implementation of F-PG-1's six rather than a replacement
 * of one. That is stated here because "replaces" in the requirement would
 * otherwise read as a licence to delete the path and the totals, which are a
 * different requirement and are still correct.
 */
export const SKILL_IDS = ['boardVision', 'tactics', 'endgames', 'openings', 'strategy', 'habits'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_TITLE: Record<SkillId, string> = {
  boardVision: 'Board vision',
  tactics: 'Tactics',
  endgames: 'Endgames',
  openings: 'Openings',
  strategy: 'Strategy',
  habits: 'Thinking and habits',
};

/**
 * One game as the profile understands it.
 *
 * `speed` is `'in-app'` for a game played here, because F-IM-2's five speeds are
 * properties of a source site's pool and an in-app game belongs to none of them.
 * It is a sixth value rather than a coercion onto `rapid` for the same reason
 * `Speed` has an `other` member: a game must be visibly what it is.
 */
export interface ProfileGame {
  gameId: string;
  /** ISO 8601. When the game was PLAYED, never when it was reviewed. */
  playedAt: string;
  result: 'win' | 'loss' | 'draw';
  speed: Speed | 'in-app';
  review: Review;
}

/**
 * F-SW-6, "Confidence and sample size".
 *
 * > "The profile shows how many games it is built on. Below ten games it shows
 * > only counts and no comparisons. From ten games it shows comparisons labelled
 * > 'early'. From thirty games the labels drop."
 *
 * Two separate questions live in this one type and they must not be conflated:
 *
 *  - `comparisons` — is the SAMPLE big enough for a comparison to be fair. That
 *    is F-SW-6's rule and it is a function of the game count alone.
 *  - `label` — does a comparison shown at this sample need the "early" caveat.
 *
 * Whether there is anything to compare AGAINST is a third question and it is not
 * here: see `ComparisonAvailability`.
 */
export interface SampleConfidence {
  games: number;
  comparisons: boolean;
  label: 'early' | null;
}

/**
 * Whether a comparison can be shown at all, which needs BOTH a big enough
 * sample (F-SW-6) and band statistics to compare against (F-SW-5).
 *
 * `'no-band-data'` is the state this release ships in — see bandStats.ts. It is
 * a distinct value from `'too-few-games'` because the two have different
 * remedies and the learner is owed the true one: playing ten more games fixes
 * one of them and cannot fix the other.
 */
export type ComparisonAvailability =
  | { shown: false; reason: 'too-few-games' | 'no-band-data' }
  | { shown: true; label: 'early' | null };

/**
 * F-SW-3's "typical-for-level flag".
 *
 * > "the typical-for-level flag ('most players at your level miss this too' or
 * > 'unusual for your level')"
 *
 * `known: false` is the shipped state, and it is not a placeholder: it is the
 * honest answer while no rating-bucketed statistics exist. `ErrorEntry.typical`
 * is NOT this flag — src/review/errorLog.ts says so in as many words: it records
 * that the section the learner is in teaches the theme, which is a statement
 * about the curriculum and "never about other learners". Reading it as F-SW-3's
 * flag would put a claim about other players in front of a learner on the
 * strength of a field that was documented as not being one.
 */
export type TypicalForLevel = { known: false } | { known: true; typical: boolean; wording: string };

/**
 * One weakness, ranked by F-SW-3's cost.
 *
 * Both factors of the product are carried, not just the product, because F-SW-3
 * asks the screen to show the count as well as the ranking, and because a single
 * opaque score cannot be checked by a reader against the games it came from.
 */
export interface Weakness {
  theme: Exclude<Theme, 'unclassified'> | 'unclassified';
  /** A plain name, F-SW-3: "Knight forks against you". */
  name: string;
  /** Raw occurrences, unweighted — F-SW-3's "9 times in 20 games". */
  occurrences: number;
  /** How many distinct games it occurred in. */
  games: number;
  /** F-SW-3's product: weighted occurrences × weighted mean expected-score loss. */
  cost: number;
  weightedOccurrences: number;
  /** Expected score, 0…1, so 0.3 is "three tenths of a game". */
  meanExpectedScoreLost: number;
  typicalForLevel: TypicalForLevel;
  lessonId: string | null;
  lessonTitle: string | null;
  /** Where the drill that fixes it lives, or null when none does. */
  drill: { to: string; name: string } | null;
}

/** F-SW-2. Three things the learner does well, worded. */
export interface Strength {
  id: string;
  kind: 'pattern' | 'phase' | 'opening' | 'habit';
  /** A complete sentence. The screen prints it; it does not assemble one. */
  text: string;
  /** What it rests on, carried into the F-SW-8 data export. */
  evidence: Record<string, string | number>;
}

/**
 * A measure with its unit stated.
 *
 * F-PG-1 asks for "a mastery percentage" per skill. Four of the six skills have
 * a number that genuinely is a percentage (an accuracy, a found-versus-missed
 * ratio); two do not, and their natural measure is a per-game rate. Forcing a
 * rate onto a 0–100 scale would need a mapping nothing in the PRD specifies, and
 * an invented composite is the fabricated metric the Progress screen's own
 * header comment already refuses. So the unit travels with the number.
 *
 * `absent` carries the REASON, so a screen can say why a number is missing
 * instead of printing a zero that reads as a measurement.
 */
export type Measure =
  | { kind: 'percent'; value: number }
  | { kind: 'rate'; value: number; per: 'game' }
  /** A plain total over the whole window, not divided by anything. */
  | { kind: 'count'; value: number }
  | { kind: 'absent'; reason: string };

/** One row of F-SW-4's detail, generic over what the skill counts. */
export interface DetailRow {
  label: string;
  measure: Measure;
  /** Worded comparison against the band, when one is available (F-SW-5). */
  comparison: string | null;
}

/** F-SW-4: the breakdown behind one skill. */
export interface SkillBreakdown {
  id: SkillId;
  title: string;
  headline: Measure;
  rows: DetailRow[];
  /** What this skill cannot yet report, and why. Never silently empty. */
  notMeasured: string[];
}

/** F-SW-7's "what changed", in words. */
export interface WhatChanged {
  /** True when there are two full windows to compare. */
  available: boolean;
  /** Present even when unavailable: it says why. */
  sentences: string[];
  recentGames: number;
  previousGames: number;
}

/** F-SW-1 … F-SW-8, assembled. */
export interface Profile {
  /** F-SW-6: "shows how many games it is built on". */
  games: number;
  confidence: SampleConfidence;
  comparisons: ComparisonAvailability;
  strengths: Strength[];
  weaknesses: Weakness[];
  skills: SkillBreakdown[];
  changed: WhatChanged;
  /** The window the profile was built over, newest first. */
  gameIds: string[];
}

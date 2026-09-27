import type { LearnerEvent } from '@/data/events';
import { unitById } from '@/path/curriculum';

/**
 * F-TS-7, "For learners with no games yet", verbatim:
 *
 * > "Before any games exist, the profile is seeded from checkpoint results and puzzle
 * > attempts, and the first tailored session is offered after the learner's tenth
 * > in-app game."
 *
 * ── WHAT THE PROFILE ALREADY SUPPORTS, AND WHAT IT DOES NOT ──────────────────
 *
 * Checked before building anything. `buildProfile` takes `ProfileGame[]`, and every
 * one of those carries a `Review`; with no games its weakness list is empty, and
 * nothing anywhere reads a checkpoint result or a puzzle attempt into it. So the
 * profile does NOT support F-TS-7 today.
 *
 * It is also not a small addition to `buildProfile`, and that is worth stating
 * precisely rather than filed as "done". F-SW-3's `Weakness` is ranked by COST:
 * weighted occurrences multiplied by weighted mean expected-score loss. A missed
 * checkpoint concept and a failed puzzle have no expected-score loss — nothing lost a
 * game, because no game was played. Putting them into the same ranking means either
 * inventing a cost for them, which is the fabricated metric src/profile/ refuses in
 * three separate files, or ranking them by a different quantity in the same list,
 * which makes the list's order meaningless.
 *
 * So the seed is its own type, visibly not a `Weakness`, and the session builder uses
 * it only when there are no games at all. A learner with games has real costs, and
 * real costs win.
 */

/** F-TS-7's "after the learner's tenth in-app game". */
export const FIRST_SESSION_AFTER_GAMES = 10;

export interface SeedSignal {
  kind: 'checkpoint-concept' | 'puzzle-theme';
  /** The concept tag, or the puzzle theme. */
  id: string;
  /** How many times the learner got it wrong. */
  missed: number;
  /** The unit it was missed in, for a checkpoint concept. Null for a puzzle theme. */
  unit: string | null;
  /**
   * A lesson to teach it: the first lesson of the unit whose checkpoint surfaced it.
   *
   * Not the lesson that teaches this exact concept — that mapping does not exist
   * without loading every lesson's challenges and indexing their `concept` tags at
   * runtime. The unit is what the checkpoint event records, the unit is what the
   * learner has reached, and its first lesson is in band by construction.
   */
  lessonId: string | null;
}

/**
 * Seed signals from what the learner has done, worst first.
 *
 * Checkpoint concepts before puzzle themes: a missed checkpoint concept is a
 * statement about the curriculum the learner has been taught, and a puzzle theme is a
 * statement about a pack. The first is the better guide to what to teach again.
 */
export function seedFromAttempts(events: readonly LearnerEvent[]): SeedSignal[] {
  const concepts = new Map<string, { missed: number; unit: string }>();
  const themes = new Map<string, number>();

  for (const e of events) {
    const p = e.payload;
    if (p.type === 'checkpoint_attempted') {
      for (const c of p.missedConcepts) {
        const prev = concepts.get(c);
        concepts.set(c, { missed: (prev?.missed ?? 0) + 1, unit: p.unit });
      }
    } else if (p.type === 'puzzle_attempted' && !p.solved) {
      for (const t of p.themes) themes.set(t, (themes.get(t) ?? 0) + 1);
    }
  }

  const fromConcepts: SeedSignal[] = [...concepts.entries()].map(([id, v]) => ({
    kind: 'checkpoint-concept',
    id,
    missed: v.missed,
    unit: v.unit,
    lessonId: unitById(v.unit)?.lessons[0]?.id ?? null,
  }));
  const fromThemes: SeedSignal[] = [...themes.entries()].map(([id, missed]) => ({
    kind: 'puzzle-theme',
    id,
    missed,
    unit: null,
    lessonId: null,
  }));

  // Ties broken by id so the order is total: two concepts missed once each would
  // otherwise swap between reads and change what the learner is told to work on.
  const byMissed = (a: SeedSignal, b: SeedSignal) => b.missed - a.missed || a.id.localeCompare(b.id);
  return [...fromConcepts.sort(byMissed), ...fromThemes.sort(byMissed)];
}

/**
 * F-TS-7's gate, plus F-IM-5's exception.
 *
 * > F-IM-5: "the profile seeds the error log and the placement, and the learner's
 * > first daily plan is a tailored session (F-TS-1) rather than the path's first
 * > lesson."
 *
 * An import brings real games with real reviews, so a learner who has imported is not
 * a learner "with no games yet" and the ten-game wait does not apply to them. Without
 * this, the two requirements contradict each other.
 */
export function firstSessionDue(input: { inAppGamesReviewed: number; importedGames: number }): boolean {
  if (input.importedGames > 0) return true;
  return input.inAppGamesReviewed >= FIRST_SESSION_AFTER_GAMES;
}

/** How many reviewed games came from each side of the import seam. */
export function gameCounts(input: {
  reviewedGameIds: readonly string[];
  importedGameIds: ReadonlySet<string>;
}): { inAppGamesReviewed: number; importedGames: number } {
  let inApp = 0;
  let imported = 0;
  for (const id of input.reviewedGameIds) {
    if (input.importedGameIds.has(id)) imported += 1;
    else inApp += 1;
  }
  return { inAppGamesReviewed: inApp, importedGames: imported };
}

import { loadCheckpoint } from '@/lesson/loader';
import type { Challenge, Lesson } from '@/lesson/types';
import { RULES_CHECK, pickRung, type PlacementRung } from './placementBank';

/**
 * Turning a manifest rung into challenges, and challenges into something
 * `LessonPlayer` can run.
 *
 * Kept out of the route's `.tsx` so it can be read and tested without rendering
 * anything, and because that file may export only components
 * (`react-refresh/only-export-components`).
 *
 * Every load here is one dynamic import of one unit's checkpoint JSON
 * (`lesson/loader.ts`), so a placement round costs one file and the rules check
 * costs three. Nothing walks the corpus.
 */

/** One rung's challenges, loaded from that unit's checkpoint bank. */
export async function loadRung(rung: PlacementRung): Promise<Challenge[]> {
  return pickRung(await loadCheckpoint(rung.unit), rung);
}

/**
 * F-ON-5's five-challenge rules check, in manifest order across its three units.
 *
 * The three banks are fetched in parallel and then read in manifest order, so
 * the questions arrive in the order the manifest declares rather than the order
 * the network happened to resolve in.
 */
export async function loadRulesCheck(): Promise<Challenge[]> {
  const banks = await Promise.all(RULES_CHECK.map((r) => loadCheckpoint(r.unit)));
  return RULES_CHECK.flatMap((rung, i) => {
    const bank = banks[i];
    return bank ? pickRung(bank, rung) : [];
  });
}

/**
 * A round of the placement test, shaped as a `Lesson` so it runs in the house
 * player with hints off — the same reuse `checkpointToLesson` makes for a
 * checkpoint attempt.
 *
 * `xp` is 0 and the caller passes `showXp={false}`: F-ON-5 gives the placement
 * test no XP, and a player that claimed some would be claiming it on behalf of
 * a screen that awards none. The card is filled in but never rendered — the
 * route passes `skipCard`, because the test's own intro screen has already said
 * this — and it is written honestly anyway rather than left as a placeholder
 * that would be the first thing seen if `skipCard` were ever dropped.
 */
export function roundLesson(
  id: string,
  title: string,
  challenges: Challenge[],
  takeaway: string,
): Lesson {
  return {
    id,
    // Not a real unit: these challenges are tagged to their own units in the
    // manifest, and `unitById('placement')` is deliberately undefined so nothing
    // downstream can mistake a placement round for a unit's own work.
    unit: 'placement',
    title,
    xp: 0,
    card: {
      idea: `${challenges.length} questions on positions you have not seen. No hints.`,
      diagrams: [],
    },
    explain: [],
    challenges,
    takeaway,
  };
}

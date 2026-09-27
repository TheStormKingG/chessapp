import { plural } from '@/app/plural';
import type { Weakness } from '@/profile';
import { type BandVerdict, bandVerdict } from './band';

/**
 * F-TS-2, "How it chooses", verbatim:
 *
 * > "The session targets the highest-cost weakness that the curriculum can address
 * > at the learner's band. A weakness above the learner's band (a Section 4 idea for
 * > a Section 2 learner) is shown in the profile with 'later on the path' and is not
 * > drilled yet. Two weaknesses can be combined when they share a lesson. The choice
 * > and the reason are stated in one sentence at the top of the session."
 *
 * ── THE RANKING IS NOT RECOMPUTED HERE ───────────────────────────────────────
 *
 * "Highest-cost" is already decided. `src/profile/weaknesses.ts` ranks by F-SW-3's
 * cost — weighted occurrences × weighted mean expected-score loss, recent games
 * weighted more heavily — and settles ties deterministically. This walks that order
 * and takes the first weakness the band admits. A second ranking here would be a
 * second answer to a question that already has one, and the two would disagree the
 * first time either changed.
 *
 * So `chooseTarget` never sorts, and its tests assert that it doesn't.
 */

export interface SessionTarget {
  primary: Weakness;
  /** A second weakness the same lesson covers, or null. */
  alsoCovers: Weakness | null;
  lessonId: string;
  /** The curriculum section the lesson sits in. */
  section: string;
  /** F-TS-2's one sentence, for the top of the session. */
  reason: string;
}

/** A weakness the profile shows but does not drill, with the wording for why. */
export interface DeferredWeakness {
  weakness: Weakness;
  reason: Exclude<BandVerdict, { drill: true }>['reason'];
  note: string;
}

export interface Choice {
  target: SessionTarget | null;
  deferred: DeferredWeakness[];
  /** Why no session is on offer, when none is. Null when there is a target. */
  noTarget: string | null;
}

/** "9 times in 20 games" — F-SW-3's own phrasing, reused so the two agree. */
function count(w: Weakness): string {
  return `${plural(w.occurrences, 'time')} in ${plural(w.games, 'game')}`;
}

/**
 * F-TS-2's sentence. Built from the numbers the profile already computed, so a
 * learner reading the session and the profile is told the same thing twice rather
 * than two different things once.
 */
export function reasonFor(primary: Weakness, alsoCovers: Weakness | null): string {
  if (alsoCovers) {
    return `Today is about ${primary.name.toLowerCase()} and ${alsoCovers.name.toLowerCase()} — one lesson covers both, and together they cost you the most.`;
  }
  return `Today is about ${primary.name.toLowerCase()}: ${count(primary)}, and it costs you more than anything else.`;
}

/**
 * The target, or an honest account of why there is none.
 *
 * `weaknesses` arrives in cost order — pass `profile.weaknesses`, which is F-SW-3's
 * top three and the three the profile screen shows. When every one of them is out of
 * band there is no session: the profile says "later on the path" against each, which
 * is what F-TS-2 asks for, and nothing is drilled.
 */
export function chooseTarget(input: { weaknesses: readonly Weakness[]; reached: string | null }): Choice {
  const deferred: DeferredWeakness[] = [];
  let target: SessionTarget | null = null;

  for (const w of input.weaknesses) {
    const v = bandVerdict(w, input.reached);
    if (!v.drill) {
      deferred.push({ weakness: w, reason: v.reason, note: v.note });
      continue;
    }
    if (target === null) {
      // The first drillable weakness in cost order IS the highest-cost one the
      // curriculum can address. No comparison needed, and none made.
      // No band check on the second weakness, deliberately. `bandVerdict` is a
      // function of the lesson id and the learner's unit alone, so a weakness
      // sharing this lesson necessarily has the same verdict — the primary's, which
      // has just passed. A guard here would be a line no test could distinguish
      // from its absence, which src/profile/weaknesses.ts documents as not being a
      // guard at all. The property is asserted in this module's suite instead.
      const alsoCovers = input.weaknesses.find((other) => other !== w && other.lessonId === v.lessonId) ?? null;
      target = { primary: w, alsoCovers, lessonId: v.lessonId, section: v.section, reason: reasonFor(w, alsoCovers) };
    }
  }

  if (target === null) {
    const laterOnly = deferred.length > 0 && deferred.every((d) => d.reason === 'later-on-the-path');
    return {
      target: null,
      deferred,
      noTarget:
        deferred.length === 0
          ? 'There are no weaknesses to work on yet.'
          : laterOnly
            ? 'Everything the profile found is later on the path. Keep going and it will come up.'
            : 'Nothing in the profile has a lesson to drill yet.',
    };
  }
  return { target, deferred, noTarget: null };
}

import { SECTIONS, type UnitDef } from '@/path/curriculum';
import { activeNode } from '@/path/progress';
import type { Progress } from '@/data';

/**
 * F-TS-2's band rule, verbatim:
 *
 * > "The session targets the highest-cost weakness that the curriculum can address
 * > at the learner's band. A weakness above the learner's band (a Section 4 idea
 * > for a Section 2 learner) is shown in the profile with 'later on the path' and
 * > is not drilled yet."
 *
 * Two gates hide inside that sentence and they are NOT the same question:
 *
 *  - **Band.** Does the lesson that fixes this weakness sit at or before the
 *    section the learner has reached. This is the requirement's own rule and the
 *    one with learner-facing wording.
 *  - **Content.** Does that lesson's unit have content at all. An unbuilt unit's
 *    lessons render as "Content coming" (src/path/progress.ts), so there is
 *    nothing for F-TS-3 to reassemble even when the band allows it.
 *
 * They are separated because they have different remedies and the learner is owed
 * the true one: progressing along the path fixes the first and cannot fix the
 * second. Collapsing them would tell a learner to keep going for a weakness whose
 * lesson nobody has written yet.
 *
 * ── PURE, AND OVER TWO ARGUMENTS ─────────────────────────────────────────────
 *
 * `bandVerdict` is a pure function of (the weakness, the unit the learner has
 * reached). No store, no clock, no Dexie. `reachedUnit` is the one impure-ish
 * adapter — a pure function of the `Progress` projection — and it is separate so
 * the rule can be tested at every band without constructing a learner.
 */

/** F-TS-2's wording for a weakness the learner is not ready to drill. */
export const LATER_ON_THE_PATH = 'later on the path';

/** Where something sits in the authored curriculum. */
export interface CurriculumSite {
  /** The section id, e.g. `'2'`. */
  section: string;
  /** Its index in `SECTIONS`, which is the band order. */
  sectionIndex: number;
  unit: UnitDef;
}

function siteOf(match: (u: UnitDef) => boolean): CurriculumSite | null {
  for (const [sectionIndex, section] of SECTIONS.entries()) {
    const unit = section.units.find(match);
    if (unit) return { section: section.id, sectionIndex, unit };
  }
  return null;
}

/** The section and unit a lesson belongs to, from the authored curriculum. */
export function siteOfLesson(lessonId: string): CurriculumSite | null {
  return siteOf((u) => u.lessons.some((l) => l.id === lessonId));
}

/** The section a unit belongs to. */
export function siteOfUnit(unitId: string): CurriculumSite | null {
  return siteOf((u) => u.id === unitId);
}

/**
 * The band the learner is at, expressed as the unit the path says they are on.
 *
 * "Reached", not "completed": the active node is the one thing the path says to do
 * next, so its unit is the furthest unit the learner is entitled to be working in.
 * A learner who has finished everything built has no active node, and their band is
 * the last unit of the last section — they have reached the end of the path, so
 * nothing in the curriculum is above them.
 *
 * Null when the curriculum is empty or the active node names a unit that no longer
 * exists. Callers must treat null as the conservative case (see `bandVerdict`).
 */
export function reachedUnit(p: Progress): string | null {
  const active = activeNode(p);
  if (active) return active.unit;
  const last = SECTIONS[SECTIONS.length - 1];
  const unit = last?.units[last.units.length - 1];
  return unit?.id ?? null;
}

export type BandVerdict =
  /** The lesson exists, has content, and is at or below the learner's band. */
  | { drill: true; lessonId: string; section: string }
  /** No lesson teaches this theme — `THEME_LESSON` maps it to null. */
  | { drill: false; reason: 'no-lesson'; note: string }
  /** A lesson id that the authored curriculum no longer declares. */
  | { drill: false; reason: 'not-in-curriculum'; note: string }
  /** In band, but the unit has no content yet. */
  | { drill: false; reason: 'content-coming'; note: string; section: string }
  /** F-TS-2's own case. */
  | { drill: false; reason: 'later-on-the-path'; note: string; section: string };

/**
 * The decision itself, over data a caller can construct: where the lesson sits and
 * which band the learner is at.
 *
 * Separated from `bandVerdict` for one reason. Every unit in the shipped
 * curriculum is `built: true`, so the `content-coming` branch is unreachable
 * through the real `SECTIONS` today — and a branch that no test can enter is a
 * branch that is not known to work. This signature lets the test build an unbuilt
 * site directly, so the rule is verified rather than assumed, and it will still be
 * verified on the day Section 5 arrives one unit at a time.
 */
export function verdictAt(site: CurriculumSite, lessonId: string, learnerBand: number): BandVerdict {
  if (site.sectionIndex > learnerBand) {
    return { drill: false, reason: 'later-on-the-path', note: LATER_ON_THE_PATH, section: site.section };
  }
  if (!site.unit.built) {
    return {
      drill: false,
      reason: 'content-coming',
      note: 'the lesson that fixes this is not written yet',
      section: site.section,
    };
  }
  return { drill: true, lessonId, section: site.section };
}

/**
 * F-TS-2, as a function.
 *
 * `reached === null` means the learner could not be placed, and is treated as the
 * FIRST section — the conservative direction. The failure mode worth avoiding is
 * drilling a Section 4 idea at a beginner, so an unknown band drills only what the
 * first section teaches rather than everything.
 */
export function bandVerdict(weakness: { lessonId: string | null }, reached: string | null): BandVerdict {
  if (weakness.lessonId === null) {
    return {
      drill: false,
      reason: 'no-lesson',
      note: 'no lesson teaches this yet',
    };
  }
  const site = siteOfLesson(weakness.lessonId);
  if (!site) {
    return {
      drill: false,
      reason: 'not-in-curriculum',
      note: `lesson ${weakness.lessonId} is not in the curriculum`,
    };
  }
  // Unplaceable learner, or a reached unit that no longer exists: band 0.
  const learnerBand = (reached === null ? null : siteOfUnit(reached))?.sectionIndex ?? 0;
  return verdictAt(site, weakness.lessonId, learnerBand);
}

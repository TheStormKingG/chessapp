import type { ChallengeResult } from '@/lesson/LessonMachine';
import { SECTIONS, SECTION_1, SECTION_4, unitById, type SectionDef } from '@/path/curriculum';

/**
 * The placement DECISION, as a pure function over scored results (PRD 8.1
 * F-ON-5).
 *
 * Nothing in this file touches React, Dexie or the content corpus. The test
 * drives it directly, which is the point: the placement rule is the part of
 * onboarding that decides where a learner spends their first month, and a rule
 * that can only be exercised by clicking through twelve challenges is a rule
 * nobody checks the edges of.
 *
 * What the PRD asks for, clause by clause, and where each one lives:
 *
 *   "with partial credit"                        -> `challengeCredit`
 *   "the first unit whose challenges scored
 *    below 70 per cent"                          -> `placeLearner`, in path order
 *   "never beyond the start of Section 4"        -> `PLACEMENT_CAP_UNIT`
 *   "units before the placement point are
 *    marked tested out"                          -> `Placement.testedOut`
 *   "says which unit and why, in one sentence"   -> `Placement.reason`
 *   "moves the placement back by whole units"    -> `earlierPlacement`
 *   "the rules check places at 2.1 on a pass,
 *    otherwise 1.3"                              -> `placeFromRulesCheck`
 *
 * The bot game after placement is not here and must never be: F-ON-5 says it
 * "does not change the placement, it seeds the habit score". A function that
 * cannot see the game cannot be asked to weigh it.
 */

/** Every unit on the path, in path order, across every section. */
export const PATH_UNITS: readonly string[] = SECTIONS.flatMap((s) => s.units.map((u) => u.id));

function firstUnitOf(s: SectionDef): string {
  const u = s.units[0];
  // A section with no units is a typo in `curriculum.ts`, not a runtime state:
  // that file is a literal table. Failing at import names it here rather than
  // letting the placement cap quietly become some other unit.
  if (!u) throw new Error(`Section ${s.id} declares no units, so the placement cap has nothing to point at`);
  return u.id;
}

/**
 * F-ON-5: "never beyond the start of Section 4". Derived from the curriculum
 * rather than written as '4.1', so renumbering Section 4 moves the cap with it.
 */
export const PLACEMENT_CAP_UNIT: string = firstUnitOf(SECTION_4);

/**
 * F-ON-2: where "new to chess" starts — "Section 1, unit 1". Derived the same
 * way as the cap, so neither is a string literal that can drift from the table.
 */
export const FIRST_PATH_UNIT: string = firstUnitOf(SECTION_1);

/** F-ON-5: "the first unit whose challenges scored below 70 per cent". */
export const PLACEMENT_PASS_MARK = 0.7;

/** Where a unit sits on the path, or -1 for a unit the curriculum does not declare. */
export function unitIndex(unit: string): number {
  return PATH_UNITS.indexOf(unit);
}

/** Every unit strictly before `unit`, in path order. Empty for the first unit. */
export function unitsBefore(unit: string): string[] {
  const i = unitIndex(unit);
  return i <= 0 ? [] : PATH_UNITS.slice(0, i);
}

/** "2.3 Pins and skewers", or just the id for a unit with no declared title. */
export function unitLabel(unit: string): string {
  const title = unitById(unit)?.title;
  return title ? `${unit} ${title}` : unit;
}

/**
 * Partial credit for one placement challenge (F-ON-5, "with partial credit").
 *
 * Three outcomes, not two, and they come straight off `ChallengeResult` rather
 * than from a new scoring concept:
 *
 *   1    `mastery` — right, first time, with no hint. `LessonMachine` sets this
 *        flag and only this flag means unaided.
 *   0.5  right, but after a hint or a miss. The learner knows the idea and
 *        needed a nudge; a checkpoint refuses that (PRD 6.4 counts mastery) and
 *        placement must not, or every answer-after-a-nudge would place a
 *        learner as if they had never seen the idea.
 *   0    wrong twice, revealed, or never reached.
 *
 * `undefined` is the "never reached" case and is 0 rather than absent: a round
 * the learner abandoned scored nothing, and treating it as unasked would let an
 * exit raise the average.
 */
export function challengeCredit(r: ChallengeResult | undefined): number {
  if (!r?.correct) return 0;
  return r.mastery ? 1 : 0.5;
}

/** One unit's placement score: credit earned out of challenges asked. */
export interface UnitScore {
  unit: string;
  /** Credit earned, with partial credit. Between 0 and `asked`. */
  scored: number;
  /** How many placement challenges this unit was asked. */
  asked: number;
}

/** Score one unit's placement challenges from the player's own result map. */
export function scoreUnit(
  unit: string,
  challenges: readonly { id: string }[],
  results: Record<string, ChallengeResult>,
): UnitScore {
  return {
    unit,
    scored: challenges.reduce((sum, c) => sum + challengeCredit(results[c.id]), 0),
    asked: challenges.length,
  };
}

/** Whether a unit's score clears the bar. A unit that was asked nothing does not. */
export function clearsBar(s: UnitScore, passMark = PLACEMENT_PASS_MARK): boolean {
  return s.asked > 0 && s.scored / s.asked >= passMark;
}

export interface Placement {
  /** The unit the learner starts at. */
  unit: string;
  /** Every unit before `unit`, marked tested out and counting as passed. */
  testedOut: readonly string[];
  /** Which unit and why, in one sentence (F-ON-5). */
  reason: string;
  /** True when nothing scored below the bar, so the Section 4 cap decided it. */
  capped: boolean;
}

function pct(s: UnitScore): number {
  return Math.round((s.scored / s.asked) * 100);
}

/**
 * Where the learner starts, from the scored rounds.
 *
 * `scores` may arrive in any order and may name a unit the curriculum does not
 * declare; both are sorted and filtered here rather than being made the
 * caller's problem, because the caller is a screen and this is the rule.
 */
export function placeLearner(
  scores: readonly UnitScore[],
  passMark = PLACEMENT_PASS_MARK,
): Placement {
  const ordered = scores
    .filter((s) => s.asked > 0 && unitIndex(s.unit) >= 0)
    .sort((a, b) => unitIndex(a.unit) - unitIndex(b.unit));

  /*
   * No usable evidence at all — an abandoned test, or a caller that scored
   * nothing — places at the beginning of the path, NOT at the cap.
   *
   * This is the one branch the rule below gets wrong on its own: "no unit
   * scored below the bar" is satisfied vacuously by an empty list, and the cap
   * would then test a learner out of three whole sections on the strength of
   * having answered nothing.
   */
  if (ordered.length === 0) {
    const first = FIRST_PATH_UNIT;
    return {
      unit: first,
      testedOut: [],
      reason: `You start at ${unitLabel(first)} because the placement test has nothing scored to go on.`,
      capped: false,
    };
  }

  // `find` scans in path order, so when two units score the same the earlier
  // one wins. That is the tie rule and it is the safe direction: placing a
  // learner one unit early costs them a revision, placing them one unit late
  // costs them the lesson they needed.
  const failed = ordered.find((s) => !clearsBar(s, passMark));

  // Either everything cleared the bar, or the first thing that did not sits
  // beyond where placement is allowed to reach. Both land on the cap.
  if (!failed || unitIndex(failed.unit) > unitIndex(PLACEMENT_CAP_UNIT)) {
    return {
      unit: PLACEMENT_CAP_UNIT,
      testedOut: unitsBefore(PLACEMENT_CAP_UNIT),
      reason: `You start at ${unitLabel(PLACEMENT_CAP_UNIT)} because you cleared every round, and placement goes no further than the start of Section 4.`,
      capped: true,
    };
  }

  return {
    unit: failed.unit,
    testedOut: unitsBefore(failed.unit),
    reason: `You start at ${unitLabel(failed.unit)} because it is the first thing you scored under ${Math.round(passMark * 100)} per cent on, at ${pct(failed)} per cent.`,
    capped: false,
  };
}

/**
 * F-ON-5: "'Start earlier' moves the placement back by whole units."
 *
 * One unit per call, walking `PATH_UNITS`, so it crosses a section boundary the
 * same way it crosses a unit boundary — 2.1 steps back to 1.6, not to 2.0.
 * Null at the first unit on the path, which is how the screen knows to disable
 * the control rather than offering a move that does nothing.
 */
export function earlierPlacement(p: Placement): Placement | null {
  const i = unitIndex(p.unit);
  if (i <= 0) return null;
  const unit = PATH_UNITS[i - 1];
  if (!unit) return null;
  return {
    unit,
    testedOut: unitsBefore(unit),
    reason: `You chose to start at ${unitLabel(unit)}, earlier than the placement test put you.`,
    capped: false,
  };
}

/** F-ON-5: a pass on the rules check starts at 2.1. */
export const RULES_CHECK_PASS_UNIT = '2.1';
/** F-ON-5: anything else starts at 1.3. */
export const RULES_CHECK_FAIL_UNIT = '1.3';

/**
 * F-ON-5: "The 'I know the rules' option runs a five-challenge rules check
 * instead and places the learner at unit 2.1 on a pass, otherwise at unit 1.3."
 *
 * The bar is the same 70 per cent with the same partial credit as the placement
 * test. The PRD does not name one for the rules check, and inventing a second
 * threshold would mean two numbers to keep in step for no stated reason.
 */
export function placeFromRulesCheck(
  scored: number,
  asked: number,
  passMark = PLACEMENT_PASS_MARK,
): Placement {
  const passed = clearsBar({ unit: RULES_CHECK_PASS_UNIT, scored, asked }, passMark);
  const unit = passed ? RULES_CHECK_PASS_UNIT : RULES_CHECK_FAIL_UNIT;
  const percent = asked === 0 ? 0 : Math.round((scored / asked) * 100);
  return {
    unit,
    testedOut: unitsBefore(unit),
    reason: passed
      ? `You start at ${unitLabel(unit)} because you passed the rules check at ${percent} per cent, so the rules themselves are behind you.`
      : `You start at ${unitLabel(unit)} because the rules check came out at ${percent} per cent, so a pass over check, mate and draws is worth having first.`,
    capped: false,
  };
}

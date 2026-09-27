import type { ChallengeResult } from '@/lesson/LessonMachine';
import { SECTION_4, unitById } from '@/path/curriculum';
import {
  PATH_UNITS,
  PLACEMENT_CAP_UNIT,
  PLACEMENT_PASS_MARK,
  RULES_CHECK_FAIL_UNIT,
  RULES_CHECK_PASS_UNIT,
  challengeCredit,
  clearsBar,
  earlierPlacement,
  placeFromRulesCheck,
  placeLearner,
  scoreUnit,
  unitIndex,
  unitLabel,
  unitsBefore,
  type UnitScore,
} from './placement';

/** A unit that scored `scored` out of `asked`, with no other assumptions. */
function score(unit: string, scored: number, asked = 3): UnitScore {
  return { unit, scored, asked };
}

/** Three of three: comfortably over the bar. */
function cleared(unit: string): UnitScore {
  return score(unit, 3);
}

/** One of three: comfortably under it. */
function missed(unit: string): UnitScore {
  return score(unit, 1);
}

function result(o: Partial<ChallengeResult>): ChallengeResult {
  return { correct: false, hints: 0, misses: 0, mastery: false, ...o };
}

/* ------------------------------------------------------------------ the path */

test('the path order used by placement is every unit of every section, in order', () => {
  // The positive control for every "in path order" assertion below: if this
  // list were empty or one section long, `placeLearner` would still return an
  // answer and every ordering test would pass by having nothing to order.
  expect(PATH_UNITS.length).toBeGreaterThan(20);
  expect(PATH_UNITS[0]).toBe('1.1');
  expect(unitIndex('1.6')).toBeLessThan(unitIndex('2.1'));
  expect(unitIndex('2.8')).toBeLessThan(unitIndex('3.1'));
  expect(unitIndex('3.12')).toBeLessThan(unitIndex('4.1'));
  // A unit the curriculum does not declare is -1, not 0 — which is the value
  // that would silently sort an unknown unit to the front of the list.
  expect(unitIndex('9.9')).toBe(-1);
});

test('the placement cap is the first unit Section 4 declares', () => {
  expect(PLACEMENT_CAP_UNIT).toBe(SECTION_4.units[0]?.id);
  expect(PLACEMENT_CAP_UNIT).toBe('4.1');
});

test('every unit the cap tests out is built, so nothing unauthored is marked passed', () => {
  const before = unitsBefore(PLACEMENT_CAP_UNIT);
  // Non-empty, or the loop below asserts nothing: a cap that tested out no
  // units would pass a "none of them is unbuilt" check trivially.
  expect(before.length).toBe(PATH_UNITS.indexOf('4.1'));
  expect(before.length).toBeGreaterThan(0);
  const unbuilt = before.filter((u) => !unitById(u)?.built);
  expect(unbuilt).toEqual([]);
  // The other partition, asserted non-empty: `built` really is being read.
  expect(before.filter((u) => unitById(u)?.built === true)).toHaveLength(before.length);
});

test('unitLabel names the unit and its title, and degrades to the id alone', () => {
  expect(unitLabel('2.3')).toBe('2.3 Pins and skewers');
  expect(unitLabel('9.9')).toBe('9.9');
});

/* --------------------------------------------------------- partial credit */

test('partial credit is full for mastery, half for a right answer that needed help, none otherwise', () => {
  expect(challengeCredit(result({ correct: true, mastery: true }))).toBe(1);
  expect(challengeCredit(result({ correct: true, hints: 1 }))).toBe(0.5);
  expect(challengeCredit(result({ correct: true, misses: 1 }))).toBe(0.5);
  expect(challengeCredit(result({ correct: false, misses: 2 }))).toBe(0);
  // A challenge the learner never reached is scored, as zero, rather than being
  // left out — leaving it out would let an exit raise the average.
  expect(challengeCredit(undefined)).toBe(0);
});

test('scoreUnit sums partial credit over the challenges actually asked', () => {
  const challenges = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const results = {
    a: result({ correct: true, mastery: true }),
    b: result({ correct: true, hints: 1 }),
    // 'c' is absent: never answered.
  };
  expect(scoreUnit('2.3', challenges, results)).toEqual({ unit: '2.3', scored: 1.5, asked: 3 });
});

test('the bar is "below 70 per cent", so exactly 70 per cent clears it', () => {
  expect(PLACEMENT_PASS_MARK).toBe(0.7);
  expect(clearsBar(score('1.1', 7, 10))).toBe(true);
  expect(clearsBar(score('1.1', 6.9, 10))).toBe(false);
  // A unit asked nothing does not clear the bar by dividing by zero.
  expect(clearsBar(score('1.1', 0, 0))).toBe(false);
});

/* -------------------------------------------------------------- placement */

test('the learner is placed at the first unit that scored below the bar', () => {
  const p = placeLearner([cleared('1.1'), cleared('1.3'), missed('2.3'), cleared('3.7')]);
  expect(p.unit).toBe('2.3');
  expect(p.capped).toBe(false);
  expect(p.testedOut).toEqual(PATH_UNITS.slice(0, PATH_UNITS.indexOf('2.3')));
  expect(p.testedOut).toContain('2.2');
  expect(p.testedOut).not.toContain('2.3');
});

test('EDGE: every unit above the bar places at the start of Section 4, and no further', () => {
  const p = placeLearner([cleared('1.1'), cleared('2.1'), cleared('3.1'), cleared('3.11')]);
  expect(p.unit).toBe('4.1');
  expect(p.capped).toBe(true);
  // The cap is a cap, not a maximum-seen: 3.11 was the highest unit scored and
  // the learner is placed past it, but never past 4.1.
  expect(p.testedOut).toContain('3.12');
  expect(p.testedOut).not.toContain('4.1');
  expect(p.testedOut).not.toContain('4.2');
});

test('EDGE: every unit below the bar places at the very first unit, with nothing tested out', () => {
  const p = placeLearner([missed('1.1'), missed('1.3'), missed('2.3'), missed('3.7')]);
  expect(p.unit).toBe('1.1');
  expect(p.capped).toBe(false);
  expect(p.testedOut).toEqual([]);
});

test('EDGE: a tie between two units below the bar goes to the earlier one on the path', () => {
  const tied = [score('3.1', 1.5), score('1.3', 1.5)];
  // Both partitions asserted: the two really do score the same, so the answer
  // can only have come from the ordering.
  expect(tied[0]?.scored).toBe(tied[1]?.scored);
  expect(placeLearner(tied).unit).toBe('1.3');
  // ...and the reverse input order gives the same answer, which is what makes
  // it an ordering rule rather than an artefact of the array.
  expect(placeLearner([...tied].reverse()).unit).toBe('1.3');
});

test('a failure beyond the cap still places at the cap', () => {
  // 4.2 is past the start of Section 4, so a miss there cannot push a learner
  // past 4.1 — and the two units before it cleared, so nothing else could
  // have produced this answer.
  const p = placeLearner([cleared('3.11'), cleared('4.1'), missed('4.2')]);
  expect(p.unit).toBe('4.1');
  expect(p.capped).toBe(true);
});

test('units asked nothing are ignored, and an entirely unscored test starts at the beginning', () => {
  const p = placeLearner([score('1.1', 0, 0), score('2.3', 0, 0)]);
  expect(p.unit).toBe('1.1');
  expect(p.capped).toBe(false);
  expect(p.testedOut).toEqual([]);
  // The same list with one real score behaves as a one-unit test, which proves
  // the zero-asked entries were dropped rather than counted as failures.
  const q = placeLearner([score('1.1', 0, 0), cleared('2.3')]);
  expect(q.unit).toBe('4.1');
});

test('a unit the curriculum does not declare cannot decide the placement', () => {
  const p = placeLearner([missed('9.9'), cleared('1.1'), missed('2.3')]);
  expect(p.unit).toBe('2.3');
});

test('the reason is one sentence that names the unit and says why', () => {
  /*
   * "One sentence" is checked as "ends in a full stop and contains no sentence
   * break", not by counting full stops: every unit id carries two of its own
   * ('2.3', '4.1'), so a count would fail on a correct sentence and pass on a
   * two-sentence reason about unit 9.
   */
  const oneSentence = (s: string) => s.endsWith('.') && !/\.\s/.test(s);

  const failed = placeLearner([missed('2.3')]).reason;
  expect(failed).toContain('2.3 Pins and skewers');
  expect(failed).toContain('70 per cent');
  expect(failed).toContain('33 per cent');
  expect(oneSentence(failed)).toBe(true);

  const capped = placeLearner([cleared('2.3')]).reason;
  expect(capped).toContain('4.1 Deflection and decoy');
  expect(capped).toContain('Section 4');
  expect(oneSentence(capped)).toBe(true);

  // The predicate is not vacuous: it rejects two sentences and an unfinished one.
  expect(oneSentence('You start at 2.3. It is the first thing you missed.')).toBe(false);
  expect(oneSentence('You start at 2.3 Pins and skewers')).toBe(false);
});

/* --------------------------------------------------------- start earlier */

test('start earlier moves back by one whole unit and re-derives what is tested out', () => {
  const p = placeLearner([cleared('1.1'), missed('2.3')]);
  const back = earlierPlacement(p);
  expect(back?.unit).toBe('2.2');
  expect(back?.testedOut).toEqual(PATH_UNITS.slice(0, PATH_UNITS.indexOf('2.2')));
  expect(back?.testedOut).not.toContain('2.2');
  expect(back?.capped).toBe(false);
  expect(back?.reason).toContain('2.2 Forks');
});

test('start earlier crosses a section boundary rather than stopping at it', () => {
  const back = earlierPlacement(placeLearner([missed('2.1')]));
  expect(back?.unit).toBe('1.6');
});

test('start earlier is repeatable, one unit at a time', () => {
  const start = placeLearner([cleared('1.1'), cleared('2.1'), cleared('3.1'), cleared('3.11')]);
  expect(start.unit).toBe('4.1');
  const one = earlierPlacement(start);
  const two = one && earlierPlacement(one);
  const three = two && earlierPlacement(two);
  expect([one?.unit, two?.unit, three?.unit]).toEqual(['3.12', '3.11', '3.10']);
});

test('start earlier is null at the first unit, so the control can be disabled', () => {
  const first = placeLearner([missed('1.1')]);
  expect(first.unit).toBe('1.1');
  expect(earlierPlacement(first)).toBeNull();
});

/* ------------------------------------------------------------ rules check */

test('the rules check places at 2.1 on a pass and 1.3 otherwise', () => {
  const pass = placeFromRulesCheck(4, 5);
  expect(pass.unit).toBe(RULES_CHECK_PASS_UNIT);
  expect(pass.unit).toBe('2.1');
  expect(pass.testedOut).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6']);
  expect(pass.reason).toContain('2.1 Real Chess');
  expect(pass.reason).toContain('80 per cent');

  const fail = placeFromRulesCheck(3, 5);
  expect(fail.unit).toBe(RULES_CHECK_FAIL_UNIT);
  expect(fail.unit).toBe('1.3');
  expect(fail.testedOut).toEqual(['1.1', '1.2']);
  expect(fail.reason).toContain('1.3 Check, mate and draws');
  expect(fail.reason).toContain('60 per cent');
});

test('the rules check uses the same bar and the same partial credit', () => {
  // 3.5 of 5 is exactly 70 per cent: a pass, reached through partial credit.
  expect(placeFromRulesCheck(3.5, 5).unit).toBe('2.1');
  expect(placeFromRulesCheck(3.4, 5).unit).toBe('1.3');
  // An abandoned rules check is a fail, not a divide by zero.
  expect(placeFromRulesCheck(0, 0).unit).toBe('1.3');
  expect(placeFromRulesCheck(0, 0).reason).toContain('0 per cent');
});

test('the rules check never places beyond 2.1, whatever it is handed', () => {
  expect(placeFromRulesCheck(50, 5).unit).toBe('2.1');
});

import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { SECTION_1, SECTION_4, SECTIONS } from './curriculum';
import { pathNodes, activeLesson, activeNode, activeUnitProgress } from './progress';

test('first lesson is active, the rest locked, checkpoint always attemptable', () => {
  const nodes = pathNodes(emptyProgress());
  expect(nodes[0]).toMatchObject({ kind: 'lesson', id: '1.1.1', state: 'active' });
  expect(nodes[1]).toMatchObject({ kind: 'lesson', id: '1.1.2', state: 'locked' });
  const cp = nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1');
  expect(cp).toMatchObject({ state: 'available' });
});

test('completing lessons advances the active node; passing the checkpoint unlocks the next unit', () => {
  const p = emptyProgress();
  p.lessons['1.1.1'] = { stars: 3, completed: true };
  let nodes = pathNodes(p);
  expect(nodes[0]).toMatchObject({ state: 'done' });
  expect(nodes[1]).toMatchObject({ state: 'active' });
  p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  nodes = pathNodes(p);
  expect(nodes.find((n) => n.kind === 'lesson' && n.id === '1.2.1')).toMatchObject({ state: 'active' });
  expect(nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1')).toMatchObject({ state: 'passed' });
});

test('every unit of Section 1 is built: nothing in Section 1 reads as coming', () => {
  // Units 1.3 to 1.6 used to be authored-but-invisible. This is the assertion
  // that flipping them on is what shipped, and that nothing regresses it: the
  // whole section is reachable, so no Section 1 node carries the `coming` state.
  //
  // SCOPED, not deleted. Section 2 is now on the path and is declared entirely
  // unbuilt, so a path-wide `coming` filter is loud about something that is
  // correct. The invariant this test exists for -- every Section 1 unit built
  // and reachable -- is unchanged and still worth a guard, so the filter narrows
  // to Section 1's own nodes and the negative controls below stay exactly as
  // they were. They are what stops the empty result meaning "the filter matched
  // nothing", and `section: '1'` is now the thing they prove is non-empty.
  expect(SECTION_1.units.filter((u) => !u.built)).toEqual([]);
  const nodes = pathNodes(emptyProgress()).filter((n) => n.section === '1');
  expect(nodes.filter((n) => n.state === 'coming')).toEqual([]);
  // Negative control: an empty result above cannot mean "pathNodes returned
  // nothing" -- all six units, all 29 lessons and all six checkpoints are here.
  expect(nodes.filter((n) => n.kind === 'lesson')).toHaveLength(29);
  expect(nodes.filter((n) => n.kind === 'checkpoint')).toHaveLength(6);
  expect(new Set(nodes.map((n) => n.unit)).size).toBe(6);
});

test('an unbuilt unit would still read as coming, lessons and checkpoint alike', () => {
  // The rule `units not yet built are shown as coming` used to be guarded by
  // unit 1.3 happening to be unbuilt. That was incidental, and Section 2 will
  // arrive one unit at a time -- so the rule is guarded directly instead, by
  // taking the last unit offline for the length of this test.
  const last = SECTION_1.units[SECTION_1.units.length - 1]!;
  last.built = false;
  try {
    const nodes = pathNodes(emptyProgress());
    expect(nodes.find((n) => n.kind === 'lesson' && n.id === '1.6.1')).toMatchObject({
      state: 'coming',
    });
    expect(nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.6')).toMatchObject({
      state: 'coming',
    });
  } finally {
    last.built = true;
  }
});

test('the active node advances across a unit boundary into the newly built units', () => {
  // 1.2 -> 1.3 is the boundary that only exists now that 1.3 is built; before
  // the flip the path stopped dead at unit 1.2's checkpoint.
  const p = emptyProgress();
  for (const u of ['1.1', '1.2']) {
    p.units[u] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  }
  expect(activeLesson(p)).toMatchObject({ id: '1.3.1', unit: '1.3' });
  // ...and on through every remaining boundary, to the last node of the section.
  for (const [passed, next] of [
    [['1.1', '1.2', '1.3'], '1.4.1'],
    [['1.1', '1.2', '1.3', '1.4'], '1.5.1'],
    [['1.1', '1.2', '1.3', '1.4', '1.5'], '1.6.1'],
  ] as const) {
    const q = emptyProgress();
    for (const u of passed) q.units[u] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
    expect(activeLesson(q)).toMatchObject({ id: next });
  }
});

test('unit 1.6 closes Section 1: its checkpoint is the section\'s last node', () => {
  // Scoped for the same reason as the test above: the last node of the PATH is
  // now Section 2's last checkpoint. What this test guards is where SECTION 1
  // ends, which has not moved.
  const nodes = pathNodes(emptyProgress());
  const s1 = nodes.filter((n) => n.section === '1');
  expect(s1).toHaveLength(29 + 6); // the boundary is real, not an empty slice
  expect(s1[s1.length - 1]).toMatchObject({ kind: 'checkpoint', unit: '1.6' });
  // And the section boundary is where the next section begins, not the end.
  expect(nodes[s1.length]).toMatchObject({ section: '2', unit: '2.1' });
});

test('passing a unit early marks its unfinished lessons tested out, not active', () => {
  const p = emptyProgress();
  p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: true };
  const nodes = pathNodes(p);
  expect(nodes[0]).toMatchObject({ id: '1.1.1', state: 'testedOut' });
  expect(nodes.filter((n) => n.kind === 'lesson' && n.state === 'active')).toHaveLength(1);
  expect(activeLesson(p)).toMatchObject({ id: '1.2.1' });
});

const allOf = (ids: string[]) => {
  const p = emptyProgress();
  for (const id of ids) p.lessons[id] = { stars: 3, completed: true };
  return p;
};
const UNIT_1_1 = ['1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8'];

/** Every unit of the section passed -- which, now that all six are built, is
 *  the only state in which the path has nothing left to offer. */
/**
 * Every unit that is BUILT, passed. This used to walk SECTION_1 alone, which
 * was the same set exactly while Section 2 was entirely unauthored. Unit 2.1 is
 * built now, so a Section-1-only sweep would leave 2.1.1 active and the two
 * "nothing is left" tests below would be asserting the opposite of their names.
 * It walks the declared sections and asks each unit, rather than naming one.
 */
const builtUnits = () => SECTIONS.flatMap((s) => s.units).filter((u) => u.built);

const allUnitsPassed = () => {
  const p = emptyProgress();
  const built = builtUnits();
  expect(built.length, 'fixture: some unit is built').toBeGreaterThan(0);
  for (const u of built) {
    p.units[u.id] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  }
  return p;
};

test('exactly one node is current until everything built is finished', () => {
  const someDone = allOf(['1.1.1', '1.1.2']);
  const lessonsDoneNotPassed = allOf(UNIT_1_1);
  const unitPassed = (() => {
    const p = emptyProgress();
    p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
    return p;
  })();
  for (const p of [emptyProgress(), someDone, lessonsDoneNotPassed, unitPassed]) {
    expect(pathNodes(p).filter((n) => n.state === 'active')).toHaveLength(1);
    expect(activeNode(p)).not.toBeNull();
  }
  // Passing 1.1 and 1.2 no longer finishes the section -- it opens unit 1.3.
  const throughUnit2 = (() => {
    const p = emptyProgress();
    p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
    p.units['1.2'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
    return p;
  })();
  expect(pathNodes(throughUnit2).filter((n) => n.state === 'active')).toHaveLength(1);
  expect(activeNode(throughUnit2)).toMatchObject({ kind: 'lesson', id: '1.3.1' });

  const finished = allUnitsPassed();
  expect(pathNodes(finished).filter((n) => n.state === 'active')).toHaveLength(0);
  expect(activeNode(finished)).toBeNull();
});

test('all of a unit\'s lessons done but not passed: the checkpoint is the current node', () => {
  const p = allOf(UNIT_1_1);
  const nodes = pathNodes(p);
  expect(nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1')).toMatchObject({
    state: 'active',
  });
  expect(nodes.find((n) => n.kind === 'lesson' && n.id === '1.2.1')).toMatchObject({
    state: 'locked',
  });
  expect(activeNode(p)).toMatchObject({ kind: 'checkpoint', unit: '1.1' });
  expect(activeLesson(p)).toBeNull();
});

test('finishing everything built leaves no active lesson', () => {
  /*
   * The built set used to be spelled out here, so that flipping a unit on
   * without revisiting this test failed rather than silently changing what
   * "everything" means. That guard was right and its implementation was not:
   * it cost one edit per unit authored, and a list edited that often is
   * transcribed from the failure message rather than read.
   *
   * What replaces it is a stronger claim than the literal list ever made --
   * the built units form a PREFIX of the path, with no gap. A gap (3.3 built
   * while 3.2 is not) is a real defect this never used to test for: the
   * learner walks into "content coming" and finds more content behind it, so
   * the path stops being a path. `builtFlag.test.ts` separately holds each
   * flag honest against what is actually on disk, which is the half a
   * hardcoded list could never check.
   */
  const ids = builtUnits().map((u) => u.id);
  expect(ids.length).toBeGreaterThan(0);
  const declared = SECTIONS.flatMap((sec) => sec.units).map((u) => u.id);
  expect(ids).toEqual(declared.slice(0, ids.length));
  expect(ids.length).toBeLessThan(declared.length); // not everything, or the split is vacuous

  expect(activeLesson(allUnitsPassed())).toBeNull();
  expect(activeNode(allUnitsPassed())).toBeNull();
});

/* --------------------------------------------- Section 2 on the path */

test('the path walks every declared section, in path order', () => {
  const nodes = pathNodes(emptyProgress());
  // Section 1, then 2, then 3, then 4. The order IS the path.
  expect([...new Set(nodes.map((n) => n.section))]).toEqual(['1', '2', '3', '4']);
  expect(nodes.filter((n) => n.kind === 'lesson')).toHaveLength(29 + 36 + 46 + 53);
  expect(nodes.filter((n) => n.kind === 'checkpoint')).toHaveLength(6 + 8 + 12 + 12);
  // SCOPED rather than deleted, for the fourth time. This has tracked the built
  // boundary through every authoring pass: eight unbuilt Section 2 units, then
  // five, then none -- and now a whole unbuilt Section 3. Both sides are
  // asserted, so neither "none are coming" nor "all are coming" can pass by
  // matching nothing.
  const s2 = nodes.filter((n) => n.section === '2');
  expect(s2).toHaveLength(36 + 8);
  expect(s2.filter((n) => n.state === 'coming')).toEqual([]);
  // Section 3 is wholly authored now, so it owes what Section 2 owes.
  const s3 = nodes.filter((n) => n.section === '3');
  expect(s3).toHaveLength(46 + 12);
  expect(s3.filter((n) => n.state === 'coming')).toEqual([]);
  /*
   * Section 4 carries the moving boundary now, DERIVED from the flag rather
   * than named: it moves once per unit authored, and naming it meant editing
   * this block on every flip -- the road to a test that records what the code
   * does instead of what it should do.
   *
   * The derivation is only safe while both partitions are non-empty, which the
   * length checks buy. That is not theoretical: this block was on Section 3
   * until a moment ago and FAILED the instant Section 3 became wholly built,
   * which is the designed behaviour rather than a nuisance. It will fail the
   * same way when Section 4 completes, which is the end of v1.
   */
  const s4 = nodes.filter((n) => n.section === '4');
  expect(s4).toHaveLength(53 + 12);
  const built4 = new Set(SECTION_4.units.filter((u) => u.built).map((u) => u.id));
  const s4Built = s4.filter((n) => built4.has(n.unit));
  const s4Coming = s4.filter((n) => !built4.has(n.unit));
  expect(s4Coming.length).toBeGreaterThan(0);
  expect(s4Built).toHaveLength(s4.length - s4Coming.length); // the split is total
  expect(s4Built.filter((n) => n.state === 'coming')).toEqual([]);
  expect(s4Coming.filter((n) => n.state !== 'coming')).toEqual([]);
  expect(nodes.filter((n) => n.state === 'active')).toHaveLength(1);
});

test('a node carries its section rather than leaving it to be parsed out of the id', () => {
  // Inferring "2" from the leading character of "2.8.3" is the kind of thing
  // that breaks silently at Section 10, so the field is carried, not derived.
  const nodes = pathNodes(emptyProgress());
  expect(nodes.find((n) => n.kind === 'lesson' && n.id === '1.1.1')).toMatchObject({
    section: '1',
  });
  expect(nodes.find((n) => n.kind === 'checkpoint' && n.unit === '2.8')).toMatchObject({
    section: '2',
  });
  expect(nodes.filter((n) => typeof n.section !== 'string')).toEqual([]);
});

test('the unit meter resolves a unit outside Section 1', () => {
  // `activeUnitProgress` used to look the active unit up in SECTION_1 alone and
  // return null when it missed, so the first Section 2 unit to be flipped on
  // would have shown a learner no unit progress at all.
  //
  // This test used to reach that state by mutating `SECTION_2.units[0].built`
  // inside a try/finally, because no Section 2 unit was built. Unit 2.1 is
  // built for real now, so the fixture is not merely redundant -- it is wrong:
  // its `finally` restored `built = false`, which would leave the shipped
  // curriculum object unbuilt for anything that read it afterwards in this
  // module. The assertions are unchanged; they now run against the real
  // curriculum, which is stronger evidence than a mutated copy of it.
  const p = emptyProgress();
  for (const s1 of SECTION_1.units) {
    p.units[s1.id] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  }
  expect(activeNode(p)).toMatchObject({ kind: 'lesson', id: '2.1.1', unit: '2.1' });
  expect(activeUnitProgress(p)).toMatchObject({ unit: '2.1', done: 0, total: 5 });
});

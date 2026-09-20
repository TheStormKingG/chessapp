import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { SECTION_1, SECTION_2 } from './curriculum';
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
const allUnitsPassed = () => {
  const p = emptyProgress();
  for (const u of SECTION_1.units) {
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
  // "Everything built" is now all six units, so this only holds at the end of
  // the section -- and unit 1.6's checkpoint is the last thing it holds after.
  expect(activeLesson(allUnitsPassed())).toBeNull();
  expect(activeNode(allUnitsPassed())).toBeNull();
});

/* --------------------------------------------- Section 2 on the path */

test('the path walks every declared section, in path order', () => {
  const nodes = pathNodes(emptyProgress());
  // Section 1 first, then Section 2. The order IS the path.
  expect([...new Set(nodes.map((n) => n.section))]).toEqual(['1', '2']);
  expect(nodes.filter((n) => n.kind === 'lesson')).toHaveLength(29 + 36);
  expect(nodes.filter((n) => n.kind === 'checkpoint')).toHaveLength(6 + 8);
  // Every Section 2 unit is declared unbuilt, so all of it reads as coming --
  // lessons and checkpoints alike -- and none of it can steal the active node.
  const s2 = nodes.filter((n) => n.section === '2');
  expect(s2).toHaveLength(36 + 8);
  expect(s2.filter((n) => n.state !== 'coming')).toEqual([]);
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
  // would have shown a learner no unit progress at all. Flipping 2.1 on for the
  // length of this test is the only way to reach that state today.
  const u = SECTION_2.units[0]!;
  u.built = true;
  try {
    const p = emptyProgress();
    for (const s1 of SECTION_1.units) {
      p.units[s1.id] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
    }
    expect(activeNode(p)).toMatchObject({ kind: 'lesson', id: '2.1.1', unit: '2.1' });
    expect(activeUnitProgress(p)).toMatchObject({ unit: '2.1', done: 0, total: 5 });
  } finally {
    u.built = false;
  }
});

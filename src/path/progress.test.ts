import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { SECTION_1 } from './curriculum';
import { pathNodes, activeLesson, activeNode } from './progress';

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

test('every unit of Section 1 is built: nothing on the path reads as coming', () => {
  // Units 1.3 to 1.6 used to be authored-but-invisible. This is the assertion
  // that flipping them on is what shipped, and that nothing regresses it: the
  // whole section is reachable, so no node anywhere carries the `coming` state.
  expect(SECTION_1.units.filter((u) => !u.built)).toEqual([]);
  const nodes = pathNodes(emptyProgress());
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

test('unit 1.6 closes the section: its checkpoint is the last node on the path', () => {
  const nodes = pathNodes(emptyProgress());
  expect(nodes[nodes.length - 1]).toMatchObject({ kind: 'checkpoint', unit: '1.6' });
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

import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { SECTION_1, SECTION_2, SECTIONS, unitById } from './curriculum';
import { pathNodes } from './progress';

test('Section 2 has all eight units of Appendix A, in order', () => {
  expect(SECTION_2.units.map((u) => u.id)).toEqual([
    '2.1',
    '2.2',
    '2.3',
    '2.4',
    '2.5',
    '2.6',
    '2.7',
    '2.8',
  ]);
});

test('units 2.1 and 2.2 are built and the other six are not', () => {
  // SCOPED, not deleted. This used to read "every Section 2 unit is unbuilt",
  // which was true exactly while no Section 2 content existed. Units 2.1 and
  // 2.2 are authored, verified and flipped on, so the invariant worth guarding
  // is the one that is still load-bearing: nothing is reachable ahead of its
  // content. The built list grows by one unit per authoring pass; the unbuilt
  // list must shrink by exactly the same one, which is why both are spelled
  // out rather than one being derived from the other.
  expect(SECTION_2.units.filter((u) => u.built).map((u) => u.id)).toEqual(['2.1', '2.2']);
  expect(SECTION_2.units.filter((u) => !u.built).map((u) => u.id)).toEqual([
    '2.3',
    '2.4',
    '2.5',
    '2.6',
    '2.7',
    '2.8',
  ]);
  // Both filters above are empty over an empty list. Eight units are here.
  expect(SECTION_2.units).toHaveLength(8);
});

test('every declared lesson id matches its unit, and every unit has lessons', () => {
  for (const u of SECTION_2.units) {
    expect(u.lessons.length, `unit ${u.id} has no lessons`).toBeGreaterThan(0);
    for (const l of u.lessons) {
      expect(l.id.startsWith(`${u.id}.`), `${l.id} is not in unit ${u.id}`).toBe(true);
      expect(l.title.length, `${l.id} has no title`).toBeGreaterThan(0);
    }
  }
});

test('the lesson count per unit matches PRD Appendix A', () => {
  // Appendix A lists the lessons as prose, so the only way a dropped lesson is
  // caught is by counting them against the table.
  expect(SECTION_2.units.map((u) => u.lessons.length)).toEqual([5, 4, 5, 5, 3, 5, 6, 3]);
  expect(SECTION_2.units.reduce((n, u) => n + u.lessons.length, 0)).toBe(36);
});

test('no lesson id is declared twice across the curriculum', () => {
  const ids = [...SECTION_1.units, ...SECTION_2.units].flatMap((u) => u.lessons.map((l) => l.id));
  expect(ids).toHaveLength(new Set(ids).size);
});

test('Section 2 is on the path, and every unbuilt unit of it reads as coming', () => {
  // This test used to assert the opposite -- that `pathNodes` walked SECTION_1
  // alone, so an unbuilt Section 2 unit was not merely un-attemptable but
  // absent -- and said it would fail on the day someone wired the path to
  // render more than one section. That day is this commit, and the decision it
  // asked to be made rather than inherited was made: the path walks every
  // section, each section heads and meters itself, so eight unbuilt units read
  // as "0 of 36 done" under a Section 2 heading rather than as "0 of 65" under
  // a Section 1 one.
  const nodes = pathNodes(emptyProgress());
  const s2 = nodes.filter((n) => n.section === '2');
  expect(s2.filter((n) => n.kind === 'lesson')).toHaveLength(36);
  expect(s2.filter((n) => n.kind === 'checkpoint')).toHaveLength(8);
  // Declared is not the same as reachable: nothing in Section 2 is attemptable
  // until its unit is flipped to `built: true`. Units 2.1 and 2.2 have been,
  // so the filter narrows to the units that are still unauthored rather than
  // being deleted -- and it keeps a non-empty control, because "none of these
  // are reachable" is satisfied vacuously by a filter that matched nothing.
  const BUILT = ['2.1', '2.2'];
  const unbuilt = s2.filter((n) => !BUILT.includes(n.unit));
  expect(unbuilt).toHaveLength(27 + 6); // 36 - 5 - 4 lessons, 8 - 2 checkpoints
  expect(unbuilt.filter((n) => n.state !== 'coming')).toEqual([]);
  // And the built units are genuinely the exception, not merely excluded:
  // their nodes are on the path and none of them reads as coming.
  const builtNodes = s2.filter((n) => BUILT.includes(n.unit));
  expect(builtNodes).toHaveLength(11); // 5 + 4 lessons, 2 checkpoints
  expect(builtNodes.filter((n) => n.state === 'coming')).toEqual([]);
  // Section 1 is untouched by the widening.
  expect(nodes.filter((n) => n.section === '1' && n.kind === 'lesson')).toHaveLength(29);
  expect(nodes.filter((n) => n.section === '1' && n.kind === 'checkpoint')).toHaveLength(6);
});

test('SECTIONS is the path order, and every declared unit is reachable by id', () => {
  expect(SECTIONS.map((s) => s.id)).toEqual(['1', '2']);
  expect(unitById('1.1')).toMatchObject({ id: '1.1', built: true });
  // The lookup that matters: a unit declared outside Section 1. Before SECTIONS
  // existed this returned undefined, and a caller that shrugged at undefined
  // gave a Section 2 learner a screen that silently found nothing.
  expect(unitById('2.1')).toMatchObject({ id: '2.1', built: true });
  expect(unitById('2.2')).toMatchObject({ id: '2.2', built: true });
  // The built/unbuilt boundary resolves on both sides: a unit that is declared
  // but unauthored must still be found by id, or the screen that renders its
  // "content coming" placeholder has nothing to render.
  expect(unitById('2.3')).toMatchObject({ id: '2.3', built: false });
  expect(unitById('2.8')?.lessons).toHaveLength(3);
  expect(unitById('9.9')).toBeUndefined();
});

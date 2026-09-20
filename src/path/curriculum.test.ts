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

test('every Section 2 unit is unbuilt', () => {
  expect(SECTION_2.units.filter((u) => u.built).map((u) => u.id)).toEqual([]);
  // The filter above is empty over an empty list too. Eight units are here.
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

test('Section 2 is on the path, and every unit of it reads as coming', () => {
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
  // until its unit is flipped to `built: true`.
  expect(s2.filter((n) => n.state !== 'coming')).toEqual([]);
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
  expect(unitById('2.1')).toMatchObject({ id: '2.1', built: false });
  expect(unitById('2.8')?.lessons).toHaveLength(3);
  expect(unitById('9.9')).toBeUndefined();
});

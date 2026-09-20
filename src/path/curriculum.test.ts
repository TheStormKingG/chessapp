import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { SECTION_1, SECTION_2 } from './curriculum';
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

test('declaring Section 2 does not put it on the path', () => {
  // `pathNodes` walks SECTION_1 only, so an unbuilt Section 2 unit is not
  // merely un-attemptable, it is absent. That is deliberate for now: PathScreen
  // renders one hardcoded section header and its meter counts every lesson
  // pathNodes returns, so admitting eight unbuilt units today would show a
  // learner "0 of 65" under a Section 1 heading. Wiring the path to render more
  // than one section is the change that must land before a Section 2 unit can
  // be flipped to `built: true`. This test fails on the day someone wires it,
  // which is when that decision should be made rather than inherited.
  const nodes = pathNodes(emptyProgress());
  expect(nodes.filter((n) => n.unit.startsWith('2.'))).toEqual([]);
  expect(nodes.filter((n) => n.kind === 'lesson')).toHaveLength(29);
  expect(nodes.filter((n) => n.kind === 'checkpoint')).toHaveLength(6);
});

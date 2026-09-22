import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { LESSON_THEME, SECTION_1, SECTION_2, SECTIONS, themeForLesson, unitById } from './curriculum';
import { THEME_LESSON } from '@/review/errorLog';
import { THEMES } from '@/puzzles/themes';
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

test('every unit of Section 2 is built, and the flag is not vacuously set', () => {
  // SCOPED, not deleted. This has now read three ways: "every Section 2 unit is
  // unbuilt", then "2.1 to 2.3 are built and the other five are not", and now
  // this. The invariant has never changed -- nothing is reachable ahead of its
  // content -- only which side of the boundary each unit sits on. All eight are
  // authored, verified and flipped on, so the unbuilt list is empty and the
  // built list is spelled out: a unit silently dropped from SECTION_2 would
  // otherwise leave both filters agreeing.
  expect(SECTION_2.units.filter((u) => u.built).map((u) => u.id)).toEqual([
    '2.1',
    '2.2',
    '2.3',
    '2.4',
    '2.5',
    '2.6',
    '2.7',
    '2.8',
  ]);
  expect(SECTION_2.units.filter((u) => !u.built)).toEqual([]);
  // The line above is satisfied vacuously by an empty section, and there is no
  // longer an unbuilt unit to serve as the control, so the count is the control.
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

test('Section 2 is on the path, and nothing in it reads as coming', () => {
  // This test has tracked the built boundary as it moved: first Section 2 was
  // absent from the path, then eight unbuilt units read as coming, then five,
  // and now none. The path still walks every section, each section heads and
  // meters itself, and Section 2's 36 lessons count under their own heading.
  const nodes = pathNodes(emptyProgress());
  const s2 = nodes.filter((n) => n.section === '2');
  expect(s2.filter((n) => n.kind === 'lesson')).toHaveLength(36);
  expect(s2.filter((n) => n.kind === 'checkpoint')).toHaveLength(8);
  // Every unit is authored, so every Section 2 node is locked behind Section 1
  // rather than coming. `coming` now has no real instance anywhere on the path,
  // which is why the rule it guards stays armed by the synthetic fixture in
  // progress.test.ts rather than being deleted with the last real instance.
  expect(s2.filter((n) => n.state === 'coming')).toEqual([]);
  expect(s2).toHaveLength(44); // 36 lessons + 8 checkpoints: the line above is not vacuous
  // Section 1 is untouched.
  expect(nodes.filter((n) => n.section === '1' && n.kind === 'lesson')).toHaveLength(29);
  expect(nodes.filter((n) => n.section === '1' && n.kind === 'checkpoint')).toHaveLength(6);
});

test('SECTIONS is the path order, and every declared unit is reachable by id', () => {
  expect(SECTIONS.map((s) => s.id)).toEqual(['1', '2']);
  expect(unitById('1.1')).toMatchObject({ id: '1.1', built: true });
  // The lookup that matters: a unit declared outside Section 1. Before SECTIONS
  // existed this returned undefined, and a caller that shrugged at undefined
  // gave a Section 2 learner a screen that silently found nothing. Every unit
  // resolves now, so the loop replaces the hand-listed cases that used to track
  // the built boundary -- a unit added to SECTION_2 without being wired into
  // `unitById` is caught here rather than by whichever id happened to be named.
  for (const u of SECTIONS.flatMap((s) => s.units)) {
    expect(unitById(u.id), `unit ${u.id} does not resolve by id`).toMatchObject({
      id: u.id,
      built: true,
    });
  }
  expect(SECTIONS.flatMap((s) => s.units)).toHaveLength(14); // the loop above is not vacuous
  expect(unitById('2.8')?.lessons).toHaveLength(3);
  expect(unitById('9.9')).toBeUndefined();
});

const LESSON_IDS = new Set(SECTION_1.units.flatMap((u) => u.lessons.map((l) => l.id)));

test('every lesson with a motif links to the themed practice for it (F-PZ-2 d)', () => {
  expect(Object.keys(LESSON_THEME).length).toBeGreaterThan(0);
  for (const [lessonId, theme] of Object.entries(LESSON_THEME)) {
    expect(themeForLesson(lessonId), `lesson ${lessonId}`).toBe(theme);
  }
});

test('a lesson with no motif has no link, rather than a link to nothing', () => {
  expect(themeForLesson('1.1.1')).toBeNull();
  expect(themeForLesson('1.2.2')).toBeNull();
});

test('an unknown lesson id has no link either', () => {
  // The id can come from a saved place or a URL, so "not in the map" has to be
  // an answer rather than an undefined that reads as a theme downstream.
  expect(themeForLesson('9.9.9')).toBeNull();
});

test('every lesson named in the map is a lesson that exists', () => {
  // A link to a lesson the curriculum dropped is a link to a 404, and nothing
  // else in the app would notice: the map is read, never enumerated.
  for (const lessonId of Object.keys(LESSON_THEME)) {
    expect(LESSON_IDS.has(lessonId), `${lessonId} is not in SECTION_1`).toBe(true);
  }
});

test('every theme named in the map is a theme the packs actually ship', () => {
  const shipped = new Set<string>(THEMES);
  for (const [lessonId, theme] of Object.entries(LESSON_THEME)) {
    expect(shipped.has(theme), `${lessonId} points at ${theme}, which no pack carries`).toBe(true);
  }
});

/**
 * The review feature already maps its own themes to lessons, and the two maps
 * meet at exactly one point: `missed_mate` drills `mateIn1`, and its lesson is
 * 1.3.3. The maps are different relations — review theme to lesson, against
 * lesson to puzzle theme — so neither can be derived from the other, which is
 * why this is a consistency check and not an inversion.
 */
test('the one lesson both maps name agrees across them', () => {
  expect(THEME_LESSON.missed_mate).toBe('1.3.3');
  expect(themeForLesson('1.3.3')).toBe('mateIn1');
});

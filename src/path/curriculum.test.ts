import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { LESSON_THEME, SECTION_1, SECTION_2, SECTION_3, SECTIONS, themeForLesson, unitById } from './curriculum';
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

test('Section 2 is built, Section 3 is declared and reads as coming', () => {
  // This test has tracked the built boundary through every move it has made:
  // Section 2 absent from the path, then eight of its units coming, then five,
  // then none -- and now Section 3 is declared and ALL of it is coming. The
  // boundary moved forward a section; the rule did not change.
  const nodes = pathNodes(emptyProgress());
  const s2 = nodes.filter((n) => n.section === '2');
  expect(s2.filter((n) => n.kind === 'lesson')).toHaveLength(36);
  expect(s2.filter((n) => n.kind === 'checkpoint')).toHaveLength(8);
  expect(s2.filter((n) => n.state === 'coming')).toEqual([]);
  expect(s2).toHaveLength(44); // the line above is not vacuous

  // Section 3 is the live instance of `coming` again. Since 2.8 shipped this
  // rule was held only by a synthetic fixture, because nothing real was
  // unbuilt; declaring Section 3 is what puts real data back under it.
  const s3 = nodes.filter((n) => n.section === '3');
  expect(s3.filter((n) => n.kind === 'lesson')).toHaveLength(46);
  expect(s3.filter((n) => n.kind === 'checkpoint')).toHaveLength(12);
  expect(s3).toHaveLength(58);
  /*
   * The boundary inside Section 3 is now DERIVED from the flag rather than
   * named, because it moves once per unit authored and this assertion was
   * being rewritten every time -- which is how a test stops being read and
   * starts being updated to whatever the code now does.
   *
   * Derivation costs nothing here PROVIDED both partitions are known to be
   * non-empty, which is what the two length checks below buy. Without them a
   * section that was wholly built, or wholly coming, would satisfy both
   * filters by matching nothing, and this test would go quiet at exactly the
   * two moments it exists for.
   */
  const built = new Set(SECTION_3.units.filter((u) => u.built).map((u) => u.id));
  const s3Built = s3.filter((n) => built.has(n.unit));
  const s3Coming = s3.filter((n) => !built.has(n.unit));
  expect(s3Built.length).toBeGreaterThan(0);
  expect(s3Coming.length).toBeGreaterThan(0);
  expect(s3Built.filter((n) => n.state === 'coming')).toEqual([]);
  expect(s3Coming.filter((n) => n.state !== 'coming')).toEqual([]);

  // Section 1 is untouched.
  expect(nodes.filter((n) => n.section === '1' && n.kind === 'lesson')).toHaveLength(29);
  expect(nodes.filter((n) => n.section === '1' && n.kind === 'checkpoint')).toHaveLength(6);
});

test('SECTIONS is the path order, and every declared unit is reachable by id', () => {
  expect(SECTIONS.map((s) => s.id)).toEqual(['1', '2', '3', '4']);
  expect(unitById('1.1')).toMatchObject({ id: '1.1', built: true });
  // Every declared unit resolves, built or not. That second half is the point:
  // a unit that is declared but unauthored must still be found by id, or the
  // screen that renders its "content coming" placeholder has nothing to render.
  // Section 3 restores that case, which Section 2 supplied until 2.8 shipped.
  for (const u of SECTIONS.flatMap((s) => s.units)) {
    expect(unitById(u.id), `unit ${u.id} does not resolve by id`).toMatchObject({ id: u.id });
  }
  // 38, which is the PRD's own total for v1. The loop above is not vacuous, and
  // this number is the one place the app says how big the finished path is.
  expect(SECTIONS.flatMap((s) => s.units)).toHaveLength(38);
  // Both sides of the boundary, named, so neither can quietly become the other.
  expect(unitById('2.8')).toMatchObject({ built: true });
  expect(unitById('3.1')).toMatchObject({ built: true });
  // The unbuilt side is taken from wherever the boundary currently is rather
  // than named, for the reason given in the test below: naming it means
  // rewriting this line once per unit authored, and a line rewritten that
  // often is not being read. `builtFlag.test.ts` is what holds the flag
  // honest against the disk; this only needs SOME unit to still be coming, so
  // that `unitById` is exercised on a declared-but-unauthored unit -- the case
  // that has to keep working for the "content coming" placeholder to render.
  const coming = SECTIONS.flatMap((s) => s.units).filter((u) => !u.built);
  expect(coming.length).toBeGreaterThan(0);
  expect(unitById(coming[0]!.id)).toMatchObject({ built: false });
  expect(unitById('4.12')?.lessons).toHaveLength(4);
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

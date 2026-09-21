import { THEME_LESSON } from '@/review/errorLog';
import { THEMES } from '@/puzzles/themes';
import { LESSON_THEME, SECTION_1, themeForLesson } from './curriculum';

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

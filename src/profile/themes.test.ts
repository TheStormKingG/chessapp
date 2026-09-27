import { expect, test } from 'vitest';
import { THEME_LESSON, TYPICAL_THEMES, type Theme } from '@/review/errorLog';
import { SECTIONS } from '@/path/curriculum';
import { THEME_DESCRIPTION, THEME_NAME, drillFor, lessonFor, lessonTitle } from './themes';

const ALL_THEMES = Object.keys(THEME_LESSON) as Theme[];

test('every theme the review layer can produce has a plain name and a description', () => {
  // Read from THEME_LESSON, which is the review layer's own list, so a fifth
  // theme added when the tagger gains a motif fails here rather than rendering as
  // `undefined` on the Progress tab.
  expect(ALL_THEMES.length).toBe(TYPICAL_THEMES.length + 1); // the four, plus unclassified
  for (const t of ALL_THEMES) {
    expect(THEME_NAME[t], t).toBeTruthy();
    expect(THEME_DESCRIPTION[t], t).toBeTruthy();
    expect(THEME_NAME[t], t).not.toContain('undefined');
  }
});

test('unclassified is named rather than hidden', () => {
  // It is the COMMON case — four of sixteen motifs are implemented — so a
  // profile that dropped it would silently omit most of the learner's cost.
  expect(THEME_NAME.unclassified).toBeTruthy();
  expect(THEME_NAME.unclassified).not.toBe(THEME_NAME.hung_piece);
});

test('every lesson id THEME_LESSON names resolves to an authored lesson title', () => {
  // The drift guard. src/review/errorLog.ts has the same test for the ids; this
  // is the additional claim that the TITLE is readable from the curriculum, which
  // is what the profile prints.
  const named = ALL_THEMES.map((t) => THEME_LESSON[t]).filter((id): id is string => id !== null);
  expect(named.length).toBeGreaterThan(0);
  for (const id of named) {
    expect(lessonTitle(id), id).not.toBeNull();
  }
});

test('lessonTitle returns null for an id the curriculum does not declare', () => {
  // The negative case, with the positive control beside it: without the second
  // assertion, a lessonTitle that returned null for everything would pass.
  expect(lessonTitle('9.9.9')).toBeNull();
  const first = SECTIONS[0]?.units[0]?.lessons[0];
  expect(first).toBeDefined();
  if (first) expect(lessonTitle(first.id)).toBe(first.title);
});

test('every theme has a lesson except unclassified, which honestly has none', () => {
  for (const t of TYPICAL_THEMES) {
    const l = lessonFor(t);
    expect(l, t).not.toBeNull();
    expect(l?.title, t).toBeTruthy();
    // The title is the authored one, not the id echoed back.
    expect(l?.title, t).not.toBe(l?.id);
  }
  expect(lessonFor('unclassified')).toBeNull();
});

test('every theme has a drill, and only the mate theme goes to themed practice', () => {
  // F-SW-3 asks for "the lesson and drill that fix it". The three habit themes
  // have no puzzle motif — src/puzzles/queue.ts refuses to invent one — so their
  // drill is the learner's own positions, which is a real drill and not a stub.
  for (const t of ALL_THEMES) {
    const d = drillFor(t);
    expect(d.to, t).toMatch(/^\/puzzles\//);
    expect(d.name, t).toBeTruthy();
  }
  expect(drillFor('missed_mate').to).toBe('/puzzles/themed?theme=mateIn1');
  for (const t of ['hung_piece', 'missed_capture', 'ignored_threat', 'unclassified'] as const) {
    expect(drillFor(t).to, t).toBe('/puzzles/fix');
  }
});

test('the themed-practice link names a theme the packs actually carry', () => {
  // A link to a motif no pack holds offers practice with nothing in it — the
  // failure PuzzleRoutes guards against by filtering the query parameter against
  // THEMES. Asserting it here means the profile cannot be the source of one.
  const to = drillFor('missed_mate').to;
  const theme = new URLSearchParams(to.split('?')[1] ?? '').get('theme');
  expect(theme).toBe('mateIn1');
});

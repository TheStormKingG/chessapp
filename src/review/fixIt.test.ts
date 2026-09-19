import { drillFrom, MIN_DRILL, MAX_DRILL } from './fixIt';
import type { ErrorEntry } from './types';

function err(o: Partial<ErrorEntry> = {}): ErrorEntry {
  return {
    gameId: 'g1',
    ply: 10,
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    playedSan: 'Qh5',
    bestSan: 'Nf3',
    bestUci: 'g1f3',
    label: 'Blunder',
    theme: 'hung_piece',
    phase: 'opening',
    clockMs: null,
    lessonId: '1.3.1',
    typical: true,
    createdAt: '2026-09-19T00:00:00.000Z',
    ...o,
  };
}

test('fewer than three errors means no drill at all', () => {
  expect(drillFrom([])).toBeNull();
  expect(drillFrom([err(), err({ ply: 12 })])).toBeNull();
});

test('three errors make a three-challenge drill', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })]);
  expect(d).not.toBeNull();
  expect(d!.challenges).toHaveLength(3);
  expect(d!.challenges.length).toBeGreaterThanOrEqual(MIN_DRILL);
});

test('more than five errors are capped at five, biggest first', () => {
  const errs = Array.from({ length: 9 }, (_, i) => err({ ply: i * 2 }));
  const d = drillFrom(errs);
  // The literal, not MAX_DRILL: `toHaveLength(MAX_DRILL)` moves with the
  // constant and so cannot fail when the cap changes. PRD F-RV-7 says three to
  // five, and five is the number this asserts.
  expect(d!.challenges).toHaveLength(5);
  expect(MAX_DRILL).toBe(5);
  expect(MIN_DRILL).toBe(3);
});

test('a blunder outranks a mistake when the cap bites', () => {
  // Six errors, only five survive. The single Blunder is at the very end, so a
  // builder that simply took the first five in ply order would drop it.
  const errs = [
    ...Array.from({ length: 5 }, (_, i) => err({ ply: i * 2, label: 'Mistake' as const })),
    err({ ply: 40, label: 'Blunder' as const }),
  ];
  const d = drillFrom(errs)!;
  expect(d.challenges.map((c) => c.id)).toContain('fix-g1-40');
});

test('each challenge is find_the_move on the position before the mistake', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })])!;
  for (const c of d.challenges) {
    expect(c.type).toBe('find_the_move');
    expect(c.fen).toBe(err().fenBefore);
    if (c.type === 'find_the_move') {
      expect(c.answer.moves).toContain('g1f3');
      expect(c.answer.moves).toContain('Nf3');
    }
  }
});

test('challenge ids are unique, so the player can key on them', () => {
  const d = drillFrom([err({ ply: 10 }), err({ ply: 12 }), err({ ply: 14 })])!;
  expect(new Set(d.challenges.map((c) => c.id)).size).toBe(3);
});

test('the drill carries no XP of its own', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })])!;
  expect(d.xp).toBe(0);
});

test('the suggested lesson is the one the most errors point at', () => {
  const d = drillFrom([
    err({ ply: 10, lessonId: '1.3.1' }),
    err({ ply: 12, lessonId: '1.3.2' }),
    err({ ply: 14, lessonId: '1.3.2' }),
  ])!;
  expect(d.suggestedLessonId).toBe('1.3.2');
});

test('no lesson is suggested when no error mapped to one', () => {
  const d = drillFrom([
    err({ ply: 10, lessonId: null, theme: 'unclassified' }),
    err({ ply: 12, lessonId: null, theme: 'unclassified' }),
    err({ ply: 14, lessonId: null, theme: 'unclassified' }),
  ])!;
  expect(d.suggestedLessonId).toBeNull();
});

test('the shape is a Lesson the shipped player accepts', () => {
  const d = drillFrom([err(), err({ ply: 12 }), err({ ply: 14 })])!;
  // Structural: every field LessonPlayer reads must be present.
  expect(d.id).toEqual(expect.any(String));
  expect(d.unit).toEqual(expect.any(String));
  expect(d.title).toEqual(expect.any(String));
  expect(d.card.idea).toEqual(expect.any(String));
  expect(Array.isArray(d.card.diagrams)).toBe(true);
  expect(Array.isArray(d.explain)).toBe(true);
  expect(d.takeaway).toEqual(expect.any(String));
});

test('a theme with no prompt of its own still gets a real question', () => {
  const d = drillFrom([
    err({ ply: 10, theme: 'something_new' }),
    err({ ply: 12, theme: 'something_new' }),
    err({ ply: 14, theme: 'something_new' }),
  ])!;
  for (const c of d.challenges) expect(c.prompt.length).toBeGreaterThan(0);
});

import { describe, expect, test } from 'vitest';
import { buildQueue } from './queue';
import type { ErrorEntry } from '../review/types';
import type { Puzzle, Theme } from './types';

/**
 * A real `ErrorEntry`, not a cast. The plan's draft of this file used
 * `err('fork')`, but `fork` is a PUZZLE theme; the review tagger emits only
 * `hung_piece`, `missed_capture`, `missed_mate`, `ignored_threat` and
 * `unclassified` (src/review/errorLog.ts). A test built on a theme the
 * producer cannot produce proves nothing about the producer.
 */
const err = (theme: string, ply: number): ErrorEntry => ({
  gameId: 'g1',
  ply,
  fenBefore: '8/8/8/8/8/8/8/K6k w - - 0 1',
  playedSan: 'Ka2',
  bestSan: 'Kb2',
  bestUci: 'a1b2',
  label: 'Blunder',
  theme,
  phase: 'middlegame',
  clockMs: null,
  lessonId: null,
  typical: true,
  createdAt: '2026-09-19T00:00:00.000Z',
});

const P = (id: string, rating: number, theme: Theme): Puzzle => ({
  id,
  rating,
  themes: [theme],
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  solution: ['a1a2', 'h1h2'],
});

const rating = { rating: 1000, confidence: 0.5 };

describe('queue', () => {
  test("the learner's own positions come before similar ones (F-PZ-3)", () => {
    const q = buildQueue({
      errors: [err('missed_mate', 20)],
      pool: [P('similar', 1000, 'mateIn1')],
      rating,
      seen: new Set(),
    });
    expect(q.fix[0]?.source).toBe('own');
    expect(q.fix[1]?.source).toBe('similar');
  });

  test('an own drill is the learner\'s position with the learner already to move', () => {
    const e = err('missed_mate', 20);
    const q = buildQueue({ errors: [e], pool: [], rating, seen: new Set() });
    const own = q.fix[0];
    expect(own?.firstLearnerPly).toBe(0);
    expect(own?.puzzle.fen).toBe(e.fenBefore);
    expect(own?.puzzle.solution).toEqual([e.bestUci]);
    expect(own?.error).toEqual(e);
  });

  test('similar means the same theme and within 150 points', () => {
    const q = buildQueue({
      errors: [err('missed_mate', 20)],
      pool: [
        P('near', 1100, 'mateIn1'),
        P('farRating', 1400, 'mateIn1'),
        P('wrongTheme', 1000, 'skewer'),
      ],
      rating,
      seen: new Set(),
    });
    const ids = q.fix.filter((i) => i.source === 'similar').map((i) => i.puzzle.id);
    expect(ids).toContain('near');
    expect(ids).not.toContain('farRating');
    expect(ids).not.toContain('wrongTheme');
  });

  test('a similar drill is a pack puzzle, so the opponent move is replayed first', () => {
    const q = buildQueue({
      errors: [err('missed_mate', 20)],
      pool: [P('near', 1100, 'mateIn1')],
      rating,
      seen: new Set(),
    });
    expect(q.fix.find((i) => i.source === 'similar')?.firstLearnerPly).toBe(1);
  });

  test('an unclassified error produces a lesson link, not a drill', () => {
    const q = buildQueue({
      errors: [err('unclassified', 12)],
      pool: [P('anything', 1000, 'fork')],
      rating,
      seen: new Set(),
    });
    expect(q.fix).toHaveLength(0);
    expect(q.lessonLinks).toHaveLength(1);
  });

  test('the unclassified lesson link names no lesson, because there is none to name', () => {
    // THEME_LESSON.unclassified is null by design: the tagger did not identify
    // an idea, so there is no lesson that teaches it. The link carries the
    // position; it must not invent a destination.
    const q = buildQueue({ errors: [err('unclassified', 12)], pool: [], rating, seen: new Set() });
    expect(q.lessonLinks[0]?.lessonId).toBeNull();
  });

  test('a theme the tagger could never emit is treated as unclassified, not as a drill', () => {
    // 'fork' is a puzzle theme, not a review theme. An unknown string must not
    // be matched against puzzle themes by accident.
    const q = buildQueue({
      errors: [err('fork', 8)],
      pool: [P('anything', 1000, 'fork')],
      rating,
      seen: new Set(),
    });
    expect(q.fix).toHaveLength(0);
    expect(q.lessonLinks).toHaveLength(1);
  });

  test('a classified error with no puzzle counterpart still drills the position and links its lesson', () => {
    // Three of the tagger's four themes have no counterpart among the eight
    // Section 1-2 puzzle themes. The learner's own position is still a real
    // drill, and THEME_LESSON still knows the lesson.
    const q = buildQueue({
      errors: [err('hung_piece', 30)],
      pool: [P('anything', 1000, 'fork')],
      rating,
      seen: new Set(),
    });
    expect(q.fix.map((i) => i.source)).toEqual(['own']);
    expect(q.lessonLinks[0]?.lessonId).toBe('1.2.4');
  });

  test('no errors means no fix set, and that is not an error state', () => {
    const q = buildQueue({
      errors: [],
      pool: [P('a', 1000, 'fork')],
      rating,
      seen: new Set(),
    });
    expect(q.fix).toHaveLength(0);
    expect(q.lessonLinks).toHaveLength(0);
  });

  test('a seen puzzle is not offered again', () => {
    const q = buildQueue({
      errors: [err('missed_mate', 20)],
      pool: [P('near', 1100, 'mateIn1')],
      rating,
      seen: new Set(['near']),
    });
    expect(q.fix.map((i) => i.source)).toEqual(['own']);
  });

  test('two errors do not both hand out the same similar puzzle', () => {
    const q = buildQueue({
      errors: [err('missed_mate', 20), err('missed_mate', 44)],
      pool: [P('near', 1100, 'mateIn1')],
      rating,
      seen: new Set(),
    });
    const ids = q.fix.filter((i) => i.source === 'similar').map((i) => i.puzzle.id);
    expect(ids).toEqual(['near']);
    expect(q.fix.filter((i) => i.source === 'own')).toHaveLength(2);
  });
});

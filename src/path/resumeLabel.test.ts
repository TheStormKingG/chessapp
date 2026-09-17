import { resumeLabel } from './resumeLabel';
import type { LessonResume } from '@/data';

const rec: LessonResume = {
  lessonId: '1.1.1',
  challengeId: 'c3',
  index: 2,
  challengeCount: 8,
  results: {},
  totalHints: 0,
  totalMisses: 0,
  savedAt: '2026-09-17T00:00:00.000Z',
};

test('a saved place reads as in progress, and says how far in', () => {
  expect(resumeLabel(rec, '1.1.1')).toEqual({ hint: 'In progress · 3 of 8', action: 'Resume' });
});

test('no record means the current wording, not a fabricated one', () => {
  expect(resumeLabel(null, '1.1.1')).toBeNull();
  expect(resumeLabel(undefined, '1.1.1')).toBeNull();
});

test('a record for another lesson never labels this node', () => {
  expect(resumeLabel(rec, '1.1.2')).toBeNull();
});

test('a stale record — out of range, empty, or shapeless — falls back', () => {
  expect(resumeLabel({ ...rec, index: 8 }, '1.1.1')).toBeNull();
  expect(resumeLabel({ ...rec, index: -1 }, '1.1.1')).toBeNull();
  expect(resumeLabel({ ...rec, challengeCount: 0, index: 0 }, '1.1.1')).toBeNull();
  expect(resumeLabel({ ...rec, challengeId: '' }, '1.1.1')).toBeNull();
  expect(resumeLabel({ ...rec, index: 1.5 }, '1.1.1')).toBeNull();
});

test('the first challenge still counts as started, and reads honestly', () => {
  expect(resumeLabel({ ...rec, index: 0, challengeId: 'c1' }, '1.1.1')?.hint).toBe('In progress · 1 of 8');
});

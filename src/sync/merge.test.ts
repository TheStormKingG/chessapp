import { mergeEvents } from './merge';
import type { LearnerEvent } from '@/data';

const ev = (id: string, createdAt: string): LearnerEvent => ({
  id,
  createdAt,
  deviceDay: '2026-09-16',
  payload: { type: 'lesson_started', lessonId: '1.1.1' },
  synced: 1,
});

test('merge unions by id and sorts by createdAt', () => {
  const local = [ev('a', '2026-09-16T10:00:00Z'), ev('b', '2026-09-16T11:00:00Z')];
  const remote = [ev('b', '2026-09-16T11:00:00Z'), ev('c', '2026-09-16T09:00:00Z')];
  expect(mergeEvents(local, remote).map((e) => e.id)).toEqual(['c', 'a', 'b']);
});

test('a shared id appears once and keeps the local copy', () => {
  const local = [ev('b', '2026-09-16T11:00:00Z')];
  const remote = [{ ...ev('b', '2026-09-16T11:00:00Z'), deviceDay: '1999-01-01' }];
  const out = mergeEvents(local, remote);
  expect(out).toHaveLength(1);
  expect(out[0]!.deviceDay).toBe('2026-09-16');
});

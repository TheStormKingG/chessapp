import { db } from './db';
import { emptyProgress } from './reduce';
import { onEventAppended, useProgress } from './store';
import type { LearnerEvent } from './events';

beforeEach(async () => {
  await db.events.clear();
  useProgress.setState({ progress: emptyProgress(), loaded: false });
});

test('append persists and updates progress; load rebuilds from disk', async () => {
  await useProgress
    .getState()
    .append({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: false });
  expect(useProgress.getState().progress.xp).toBe(10);
  expect(await db.events.count()).toBe(1);
  useProgress.setState({ progress: { ...useProgress.getState().progress, xp: 0 } });
  await useProgress.getState().load();
  expect(useProgress.getState().progress.xp).toBe(10);
  expect(useProgress.getState().loaded).toBe(true);
});

test('appended events are stored unsynced with a local device day', async () => {
  const e = await useProgress.getState().append({ type: 'lesson_started', lessonId: '1.1.1' });
  const row = await db.events.get(e.id);
  expect(row?.synced).toBe(0);
  expect(row?.deviceDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('onEventAppended notifies subscribers until unsubscribed', async () => {
  const seen: LearnerEvent[] = [];
  const off = onEventAppended((e) => seen.push(e));
  await useProgress.getState().append({ type: 'lesson_started', lessonId: '1.1.1' });
  off();
  await useProgress.getState().append({ type: 'lesson_started', lessonId: '1.1.2' });
  expect(seen).toHaveLength(1);
  expect(seen[0]?.payload).toEqual({ type: 'lesson_started', lessonId: '1.1.1' });
});

test('rebuild reprojects the whole log from disk', async () => {
  await useProgress
    .getState()
    .append({ type: 'lesson_completed', lessonId: '1.1.1', stars: 2, xp: 10, replay: false });
  useProgress.setState({ progress: emptyProgress() });
  await useProgress.getState().rebuild();
  expect(useProgress.getState().progress.lessons['1.1.1']).toEqual({ stars: 2, completed: true });
});

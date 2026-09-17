import { db } from '@/data';
import { flush, pullAll } from './flush';
import type { LearnerEvent } from '@/data';

const ev = (id: string): LearnerEvent => ({
  id,
  createdAt: new Date().toISOString(),
  deviceDay: '2026-09-16',
  payload: { type: 'lesson_started', lessonId: '1.1.1' },
  synced: 0,
});

beforeEach(() => db.events.clear());

test('flush upserts unsynced events in batches and marks them synced', async () => {
  await db.events.bulkAdd(Array.from({ length: 150 }, (_, i) => ev(`e${i}`)));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: () => ({ upsert }) };
  await flush(client as never, 'user-1');
  expect(upsert).toHaveBeenCalledTimes(2);
  expect(upsert.mock.calls[0]![0]).toHaveLength(100);
  expect(upsert.mock.calls[0]![0][0]).toMatchObject({ id: 'e0', user_id: 'user-1', type: 'lesson_started' });
  expect(await db.events.where('synced').equals(0).count()).toBe(0);
});

test('flush leaves events unsynced when the server errors', async () => {
  await db.events.add(ev('x'));
  const client = { from: () => ({ upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) }) };
  await expect(flush(client as never, 'u')).rejects.toThrow('boom');
  expect(await db.events.where('synced').equals(0).count()).toBe(1);
});

test('flush sends the payload without its discriminator and keeps the rest', async () => {
  await db.events.add(ev('only'));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  await flush({ from: () => ({ upsert }) } as never, 'u');
  expect(upsert.mock.calls[0]![0][0].payload).toEqual({ lessonId: '1.1.1' });
});

test('pullAll maps rows back to LearnerEvents', async () => {
  const rows = [
    { id: 'r1', type: 'lesson_started', payload: { lessonId: '1.1.1' }, device_day: '2026-09-16', created_at: '2026-09-16T10:00:00Z' },
  ];
  const client = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) };
  const out = await pullAll(client as never, 'u');
  expect(out[0]).toMatchObject({ id: 'r1', payload: { type: 'lesson_started', lessonId: '1.1.1' }, synced: 1 });
});

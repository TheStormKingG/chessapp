import { listLessons, loadCheckpoint, loadLesson } from './loader';

test('lists lessons in unit order', () => {
  const ids = listLessons('1.1');
  expect(ids[0]).toBe('1.1.1');
});

test('loads a lesson by id', async () => {
  const l = await loadLesson('1.1.1');
  expect(l.title).toBe('The board');
  expect(l.challenges.length).toBeGreaterThanOrEqual(5);
});

test('unknown lesson rejects', async () => {
  await expect(loadLesson('9.9.9')).rejects.toThrow(/unknown lesson/i);
});

test('loadCheckpoint rejects for a unit with no bank yet', async () => {
  await expect(loadCheckpoint('9.9')).rejects.toThrow(/unknown checkpoint/i);
});

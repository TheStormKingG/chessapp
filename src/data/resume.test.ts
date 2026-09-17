import { db } from './db';
import { clearResume, loadResume, saveResume, type LessonResume } from './resume';

const rec: LessonResume = {
  lessonId: '1.1.7',
  challengeId: 'c8',
  index: 7,
  challengeCount: 10,
  results: { c1: { correct: true, hints: 0, misses: 0, mastery: true } },
  totalHints: 1,
  totalMisses: 2,
  savedAt: '2026-09-17T00:00:00.000Z',
};

beforeEach(async () => {
  await db.resume.clear();
});

test('a resume record round-trips and is keyed by lesson id', async () => {
  expect(await loadResume('1.1.7')).toBeNull();
  await saveResume(rec);
  expect(await loadResume('1.1.7')).toEqual(rec);

  await saveResume({ ...rec, index: 8, challengeId: 'c9' });
  expect(await db.resume.count()).toBe(1);
  expect((await loadResume('1.1.7'))?.index).toBe(8);
});

test('clearing removes only that lesson, so a finished lesson cannot resume', async () => {
  await saveResume(rec);
  await saveResume({ ...rec, lessonId: '1.1.8' });
  await clearResume('1.1.7');
  expect(await loadResume('1.1.7')).toBeNull();
  expect(await loadResume('1.1.8')).not.toBeNull();
});

test('a resume record is not an event, so it never reaches the progress log', async () => {
  await saveResume(rec);
  expect(await db.events.count()).toBe(0);
});

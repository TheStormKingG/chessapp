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
  // The place is mirrored to localStorage as well as the database (resume.ts),
  // so a fixture that clears only one store carries the previous test's place.
  localStorage.clear();
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

test('a place is recorded synchronously, so an interruption before the database commits does not lose it', async () => {
  // The player saves without awaiting -- a reload can tear the page down
  // before an IndexedDB transaction commits, which is exactly what happens
  // when a learner is interrupted the moment a challenge advances.
  const writing = saveResume(rec);
  await db.resume.clear();
  // Positive control: the database really has lost the write, so a pass below
  // can only come from a record that was durable before the put landed.
  expect(await db.resume.count()).toBe(0);
  expect(await loadResume('1.1.7')).toEqual(rec);
  await writing;
});

test('clearing a place removes the synchronous record too, so a finished lesson cannot come back', async () => {
  await saveResume(rec);
  await clearResume('1.1.7');
  // Even with the database wiped, nothing may be left to resume from.
  await db.resume.clear();
  expect(await loadResume('1.1.7')).toBeNull();
});

test('the newer of the two records wins, so a store that missed a write cannot undo it', async () => {
  await saveResume(rec);
  await db.resume.put({ ...rec, index: 9, challengeId: 'c10', savedAt: '2026-09-18T00:00:00.000Z' });
  expect((await loadResume('1.1.7'))?.index).toBe(9);
});

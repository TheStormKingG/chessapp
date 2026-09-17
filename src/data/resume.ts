import { db } from './db';

export interface ResumeResult {
  correct: boolean;
  hints: number;
  misses: number;
  mastery: boolean;
}

/**
 * Where a learner had got to in a lesson, so an interruption — a reload, the ✕,
 * a tab change, an incoming call — does not throw the run away (PRD F-AC-1).
 *
 * Deliberately NOT an event: the append-only log is the record of what a
 * learner achieved, and a half-finished run has achieved nothing yet. Keeping
 * the in-flight place in its own table keyed by lesson id means a lesson that
 * finally completes appends its `challenge_attempted` events exactly once, from
 * one place, as it always did.
 */
export interface LessonResume {
  lessonId: string;
  /** The challenge to come back to, identified as well as indexed, so a content
      change under a saved record is detected rather than silently mis-restored. */
  challengeId: string;
  index: number;
  challengeCount: number;
  results: Record<string, ResumeResult>;
  totalHints: number;
  totalMisses: number;
  savedAt: string;
}

/**
 * The place is written to TWO stores, and the reason is the whole point of the
 * feature.
 *
 * The player reports its place from a React effect and the caller persists it
 * without awaiting — there is nothing sensible to await it from, and a lesson
 * must not block on storage between challenges. An IndexedDB write is
 * asynchronous: the transaction is opened in one task and commits in a later
 * one. Anything that takes the page away in between — a reload, a tab close, an
 * OS killing a backgrounded tab, the incoming call this feature exists for —
 * aborts the transaction, and the learner comes back one challenge earlier than
 * they left, having been told "your place is saved".
 *
 * `localStorage` is the only durable store a browser writes synchronously, so
 * the place lands there first and is safe the instant the challenge advances.
 * IndexedDB stays the record of truth for everything else that reads a resume
 * row, and the mirror is a write-through cache in front of it. Reads take
 * whichever copy is newer, so a device where `localStorage` is unavailable
 * (private mode throws) degrades to exactly the previous behaviour instead of
 * resurrecting a stale place.
 *
 * The key is under the `chessapp` prefix that `clearDeviceData` already sweeps,
 * so "clear this device's data" keeps its promise without being told about it.
 */
const key = (lessonId: string): string => `chessapp.resume.${lessonId}`;

function mirrorPut(r: LessonResume): void {
  try {
    localStorage.setItem(key(r.lessonId), JSON.stringify(r));
  } catch {
    // Private-mode or quota-exhausted storage: the database write below is
    // still made, which is the behaviour this mirror improves on.
  }
}

function mirrorGet(lessonId: string): LessonResume | null {
  try {
    const raw = localStorage.getItem(key(lessonId));
    if (raw === null) return null;
    const r = JSON.parse(raw) as LessonResume;
    // A hand-edited or half-written value must not be able to seed a lesson.
    return typeof r.lessonId === 'string' && typeof r.savedAt === 'string' && typeof r.index === 'number'
      ? r
      : null;
  } catch {
    return null;
  }
}

function mirrorDelete(lessonId: string): void {
  try {
    localStorage.removeItem(key(lessonId));
  } catch {
    // As above: the database delete still runs.
  }
}

export async function saveResume(r: LessonResume): Promise<void> {
  // Synchronous first: from here on an interruption cannot lose the place.
  mirrorPut(r);
  await db.resume.put(r);
}

export async function loadResume(lessonId: string): Promise<LessonResume | null> {
  const mirrored = mirrorGet(lessonId);
  const stored = (await db.resume.get(lessonId)) ?? null;
  if (!mirrored) return stored;
  if (!stored) return mirrored;
  return stored.savedAt > mirrored.savedAt ? stored : mirrored;
}

export async function clearResume(lessonId: string): Promise<void> {
  // Synchronous first, for the same reason: a lesson that has just been
  // completed must not be able to come back as a half-finished one.
  mirrorDelete(lessonId);
  await db.resume.delete(lessonId);
}

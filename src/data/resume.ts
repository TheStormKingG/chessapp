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

export async function saveResume(r: LessonResume): Promise<void> {
  await db.resume.put(r);
}

export async function loadResume(lessonId: string): Promise<LessonResume | null> {
  return (await db.resume.get(lessonId)) ?? null;
}

export async function clearResume(lessonId: string): Promise<void> {
  await db.resume.delete(lessonId);
}

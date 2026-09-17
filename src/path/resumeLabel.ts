import { useEffect, useState } from 'react';
import { loadResume, type LessonResume } from '@/data';

export interface ResumeLabel {
  /** What the node says about the state of the run. */
  hint: string;
  /** What the control does — a resumption, not a fresh start. */
  action: string;
}

/**
 * How an interrupted lesson should read on the path and on Today (PRD F-AC-1).
 *
 * Honest by construction: every way the record can fail to describe this lesson
 * — absent, saved against another lesson, or stale against content that has
 * since changed shape — returns null, and the caller falls back to its current
 * wording. The same shape checks the player uses to decide whether to restore a
 * run decide whether to advertise one, so the label can never promise a place
 * the player would silently discard.
 */
export function resumeLabel(r: LessonResume | null | undefined, lessonId: string): ResumeLabel | null {
  if (!r || r.lessonId !== lessonId) return null;
  if (!r.challengeId) return null;
  if (!Number.isInteger(r.challengeCount) || r.challengeCount <= 0) return null;
  if (!Number.isInteger(r.index) || r.index < 0 || r.index >= r.challengeCount) return null;
  return { hint: `In progress · ${String(r.index + 1)} of ${String(r.challengeCount)}`, action: 'Resume' };
}

/** The saved place for one lesson, or null — including while it is being read. */
export function useLessonResume(lessonId: string | null): LessonResume | null {
  // The record is keyed by lesson, so a change of lesson invalidates it at once
  // rather than one render later — adjusted during render, as elsewhere in this
  // codebase, because a setState in an effect body is lint-banned.
  const [seen, setSeen] = useState<{ id: string | null; r: LessonResume | null }>({ id: lessonId, r: null });
  if (seen.id !== lessonId) setSeen({ id: lessonId, r: null });
  useEffect(() => {
    if (!lessonId) return;
    let on = true;
    loadResume(lessonId)
      .then((v) => {
        if (on) setSeen({ id: lessonId, r: v });
      })
      .catch(() => {
        // A place we cannot read is a place we must not advertise: the state
        // already holds null for this lesson.
      });
    return () => {
      on = false;
    };
  }, [lessonId]);
  return seen.id === lessonId ? seen.r : null;
}

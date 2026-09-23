import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LessonPlayer, loadLesson, type Lesson, type LessonOutcome } from '@/lesson';
import { clearResume, loadResume, saveResume, useProgress, type LessonResume } from '@/data';
import { track } from '@/analytics';

export function LessonRoute() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [resume, setResume] = useState<LessonResume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress((s) => s.progress);
  const append = useProgress((s) => s.append);

  useEffect(() => {
    let on = true;
    // The saved place is read before the player mounts, so the run comes back
    // where it was left rather than restarting at the idea card (PRD F-AC-1).
    Promise.all([loadLesson(id), loadResume(id)])
      .then(([l, r]) => {
        if (!on) return;
        setResume(r);
        setLesson(l);
        track('lesson_started', { lessonId: l.id, resumed: r !== null });
        void append({ type: 'lesson_started', lessonId: l.id });
      })
      .catch((e: unknown) => {
        if (on) setError(e instanceof Error ? e.message : 'Unknown error');
      });
    return () => {
      on = false;
    };
  }, [id, append]);

  if (error)
    return (
      <section className="p-4">
        <p>That lesson could not be loaded.</p>
        <button
          type="button"
          className="tap mt-3 rounded-control border border-edge-strong px-4"
          onClick={() => {
            void nav('/path');
          }}
        >
          Back to the path
        </button>
      </section>
    );
  if (!lesson) return <section className="p-4 text-content-dim">Loading…</section>;

  // F-PA-7: a replay earns reduced XP; the reducer halves it on this flag.
  const replay = progress.lessons[lesson.id]?.completed ?? false;

  const onComplete = (o: LessonOutcome): void => {
    void (async () => {
      // The place is dropped before the events are written, so a completed
      // lesson can never come back as a half-finished one.
      await clearResume(o.lessonId);
      for (const [challengeId, r] of Object.entries(o.results)) {
        await append({
          type: 'challenge_attempted',
          lessonId: o.lessonId,
          challengeId,
          correct: r.correct,
          hints: r.hints,
          misses: r.misses,
          mastery: r.mastery,
          context: 'lesson',
        });
      }
      await append({
        type: 'lesson_completed',
        lessonId: o.lessonId,
        stars: o.stars,
        xp: o.xp,
        replay,
      });
      track('lesson_completed', { lessonId: o.lessonId, stars: o.stars, xp: o.xp, replay });
      // No navigation here. The outcome is now recorded the moment the close
      // screen appears, which is a screen the learner is meant to read; moving
      // them off it would be the recording stealing the exit.
    })();
  };

  return (
    <LessonPlayer
      lesson={lesson}
      resume={resume}
      onProgress={(r) => {
        void (r ? saveResume(r) : clearResume(lesson.id));
      }}
      onExit={() => {
        void nav('/path');
      }}
      // Recording happens as soon as the close screen appears; the button and
      // the close control are then both just the way back to the path.
      onOutcome={onComplete}
      onComplete={() => {
        void nav('/path');
      }}
    />
  );
}

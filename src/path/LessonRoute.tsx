import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LessonPlayer, loadLesson, type Lesson, type LessonOutcome } from '@/lesson';
import { useProgress } from '@/data';

export function LessonRoute() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress((s) => s.progress);
  const append = useProgress((s) => s.append);

  useEffect(() => {
    let on = true;
    loadLesson(id)
      .then((l) => {
        if (!on) return;
        setLesson(l);
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
          className="tap mt-3 rounded-lg border border-line px-4"
          onClick={() => {
            void nav('/path');
          }}
        >
          Back to the path
        </button>
      </section>
    );
  if (!lesson) return <section className="p-4 text-ink-muted">Loading…</section>;

  // F-PA-7: a replay earns reduced XP; the reducer halves it on this flag.
  const replay = progress.lessons[lesson.id]?.completed ?? false;

  const onComplete = (o: LessonOutcome): void => {
    void (async () => {
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
      await nav('/path');
    })();
  };

  return (
    <LessonPlayer
      lesson={lesson}
      onExit={() => {
        void nav('/path');
      }}
      onComplete={onComplete}
    />
  );
}

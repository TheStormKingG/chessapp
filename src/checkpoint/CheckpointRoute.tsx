import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { loadCheckpoint, type CheckpointBank, type Challenge } from '@/lesson';
import { LessonPlayer, type LessonOutcome } from '@/lesson/LessonPlayer';
import { useProgress } from '@/data';
import { track } from '@/analytics';
import { btn } from '@/app/Button';
import { unitById } from '@/path/curriculum';
import { checkpointToLesson, remediationSet, sampleChallenges, scoreAttempt } from './CheckpointMachine';

type Stage =
  | { kind: 'intro' }
  | { kind: 'test'; chosen: Challenge[] }
  | { kind: 'failed'; score: number; missed: string[] }
  | { kind: 'remediate'; set: Challenge[] }
  | { kind: 'passed'; score: number; awarded: boolean };

export function CheckpointRoute() {
  const { unit = '' } = useParams();
  const nav = useNavigate();
  const [bank, setBank] = useState<CheckpointBank | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const progress = useProgress((s) => s.progress);
  const append = useProgress((s) => s.append);
  const attempts = progress.units[unit]?.attempts ?? 0;
  // PRD 6.4: the note is for three *failed* attempts, not three attempts.
  const failedAttempts = progress.units[unit]?.failedAttempts ?? 0;
  useEffect(() => {
    // No content bank yet (Tasks 18-19) is a missing route, not a crash.
    loadCheckpoint(unit)
      .then(setBank)
      .catch(() => {
        void nav('/path');
      });
  }, [unit, nav]);
  const testLesson = useMemo(
    () => (bank && stage.kind === 'test' ? checkpointToLesson(bank, stage.chosen) : null),
    [bank, stage],
  );
  const remLesson = useMemo(
    () => (bank && stage.kind === 'remediate' ? checkpointToLesson(bank, stage.set, true) : null),
    [bank, stage],
  );
  if (!bank) return <section className="t-body p-4 text-content-dim">Loading…</section>;
  const toPath = () => {
    void nav('/path');
  };

  if (stage.kind === 'intro')
    return (
      <section className="p-4">
        <h1 className="t-title">{bank.title}</h1>
        <p className="mt-2">
          {bank.sample} mixed questions on positions you have not seen. No hints. Pass mark{' '}
          {Math.round(bank.passMark * 100)} per cent. Passing completes the unit, and you can attempt it now to
          test out.
        </p>
        {failedAttempts >= 3 && (
          <p className="t-body mt-2 rounded-lg bg-signal-soft p-3">
            Three attempts without a pass so far. The coach recommends replaying this unit&rsquo;s lessons before the next try.
          </p>
        )}
        <button
          type="button"
          className={`${btn.primary} mt-4 w-full`}
          onClick={() => {
            track('checkpoint_started', { unit: bank.unit, attempt: attempts + 1 });
            setStage({ kind: 'test', chosen: sampleChallenges(bank) });
          }}
        >
          Start the checkpoint
        </button>
        <button type="button" className={`${btn.secondary} mt-2 w-full`} onClick={toPath}>
          Back to the path
        </button>
      </section>
    );

  if (stage.kind === 'test' && testLesson) {
    const finish = async (o: LessonOutcome) => {
      const s = scoreAttempt(stage.chosen, o.results, bank.passMark);
      for (const [challengeId, r] of Object.entries(o.results))
        await append({
          type: 'challenge_attempted',
          lessonId: bank.unit,
          challengeId,
          correct: r.correct,
          hints: r.hints,
          misses: r.misses,
          mastery: r.mastery,
          context: 'checkpoint',
        });
      const alreadyPassed = progress.units[bank.unit]?.passed ?? false;
      await append({
        type: 'checkpoint_attempted',
        unit: bank.unit,
        score: s.score,
        passed: s.passed,
        attempt: attempts + 1,
        missedConcepts: s.missedConcepts,
      });
      track('checkpoint_attempted', {
        unit: bank.unit,
        score: s.score,
        passed: s.passed,
        attempt: attempts + 1,
      });
      if (s.passed) {
        // PRD 6.4: passing before the unit's lessons are done is testing out.
        // Any section's unit, not Section 1's. A Section 2 checkpoint looked up
        // in SECTION_1 found nothing, so `anyUndone` was false and passing it
        // would never have been recorded as testing out.
        const unitLessons = unitById(bank.unit)?.lessons ?? [];
        const anyUndone = unitLessons.some((l) => !progress.lessons[l.id]?.completed);
        if (anyUndone) await append({ type: 'unit_tested_out', unit: bank.unit });
        setStage({ kind: 'passed', score: s.score, awarded: !alreadyPassed });
      } else setStage({ kind: 'failed', score: s.score, missed: s.missedConcepts });
    };
    return (
      <LessonPlayer
        lesson={testLesson}
        hintsAllowed={false}
        title={bank.title}
        exitLabel="Exit checkpoint"
        closeHeading="Checkpoint complete"
        // The next screen is the result, not the path; and the checkpoint's own
        // XP is awarded there, so the player must not claim the lesson's.
        closeAction="See your score"
        showXp={false}
        onExit={toPath}
        onComplete={(o) => {
          void finish(o);
        }}
      />
    );
  }

  if (stage.kind === 'failed')
    return (
      <section className="p-4">
        <h1 className="t-title">Not yet</h1>
        <p className="mt-2">
          You scored {Math.round(stage.score * 100)} per cent. Missed: {stage.missed.join(', ')}.
        </p>
        <button
          type="button"
          className={`${btn.primary} mt-4 w-full`}
          onClick={() => {
            setStage({ kind: 'remediate', set: remediationSet(bank, stage.missed) });
          }}
        >
          Practise the missed ideas
        </button>
        {/* Every sibling screen offers the path; a failed attempt must not be the
            one dead end (the tab bar was the only way out). */}
        <button type="button" className={`${btn.secondary} mt-2 w-full`} onClick={toPath}>
          Back to the path
        </button>
      </section>
    );

  if (stage.kind === 'remediate' && remLesson)
    return (
      <LessonPlayer
        lesson={remLesson}
        title="Practice"
        exitLabel="Exit practice"
        closeHeading="Practice done"
        closeAction="Back to the checkpoint"
        showXp={false}
        onExit={toPath}
        onComplete={() => {
          setStage({ kind: 'intro' });
        }}
      />
    );

  if (stage.kind === 'passed')
    return (
      <section className="p-4">
        <h1 className="t-title">Checkpoint passed</h1>
        <p className="mt-2">
          {Math.round(stage.score * 100)} per cent. Unit {bank.unit} complete.
          {stage.awarded ? ' +50 XP.' : ''}
        </p>
        <button
          type="button"
          className={`${btn.primary} mt-4 w-full`}
          onClick={toPath}
        >
          Back to the path
        </button>
      </section>
    );

  return <section className="t-body p-4 text-content-dim">Loading…</section>;
}

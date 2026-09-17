import type { Challenge, CheckpointBank, Lesson } from '@/lesson';
import type { ChallengeResult } from '@/lesson/LessonMachine';

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** PRD 6.4: every attempt draws a fresh sample from the held-out bank. */
export function sampleChallenges(bank: CheckpointBank, rng: () => number = Math.random): Challenge[] {
  return shuffle(bank.bank, rng).slice(0, bank.sample);
}

export function scoreAttempt(
  chosen: Challenge[],
  results: Record<string, ChallengeResult>,
  passMark = 0.75,
): { score: number; passed: boolean; missedConcepts: string[] } {
  const correct = chosen.filter((c) => results[c.id]?.mastery).length;
  const score = chosen.length === 0 ? 0 : correct / chosen.length;
  const missed = [...new Set(chosen.filter((c) => !results[c.id]?.mastery).map((c) => c.concept))];
  return { score, passed: score >= passMark, missedConcepts: missed };
}

/** PRD 6.4: five to eight challenges drawn from the concepts that were missed. */
export function remediationSet(
  bank: CheckpointBank,
  concepts: string[],
  rng: () => number = Math.random,
): Challenge[] {
  const pool = shuffle(
    bank.bank.filter((c) => concepts.includes(c.concept)),
    rng,
  );
  return pool.slice(0, Math.max(5, Math.min(8, pool.length)));
}

/** Checkpoints reuse the lesson player with hints disabled and no card/explain screens. */
export function checkpointToLesson(bank: CheckpointBank, chosen: Challenge[], remediation = false): Lesson {
  return {
    id: `${bank.unit}.cp`,
    unit: bank.unit,
    title: remediation ? `${bank.title} — practice` : bank.title,
    xp: 10,
    card: {
      idea: remediation
        ? 'Practice the ideas you missed, then retake the checkpoint.'
        : `${String(bank.sample)} mixed questions on positions you have not seen. No hints. Pass mark ${String(Math.round(bank.passMark * 100))} per cent.`,
      diagrams: [],
    },
    explain: [],
    challenges: chosen,
    takeaway: remediation ? 'Now retake the checkpoint.' : 'Checkpoint complete.',
  };
}

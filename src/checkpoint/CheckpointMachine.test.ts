import { sampleChallenges, scoreAttempt, remediationSet, checkpointToLesson } from './CheckpointMachine';
import type { Challenge, CheckpointBank } from '@/lesson';

const mk = (i: number, concept: string): Challenge => ({ id: `q${i}`, type: 'which_square', fen: '8/8/8/8/8/8/8/8 w - - 0 1', prompt: 'p', concept, answer: { square: 'e4' } });
const bank: CheckpointBank = { unit: '9.9', title: 't', passMark: 0.75, sample: 10, bank: Array.from({ length: 30 }, (_, i) => mk(i, i % 3 === 0 ? 'a' : i % 3 === 1 ? 'b' : 'c')) };

test('samples the requested count without repeats and differs between attempts', () => {
  const a = sampleChallenges(bank, () => 0.1), b = sampleChallenges(bank, () => 0.9);
  expect(a).toHaveLength(10); expect(new Set(a.map((c) => c.id)).size).toBe(10);
  expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id));
});

test('scores by mastery-credit correctness and passes at 75 per cent', () => {
  const chosen = bank.bank.slice(0, 10);
  const results = Object.fromEntries(chosen.map((c, i) => [c.id, { correct: i < 8, hints: 0, misses: i < 8 ? 0 : 2, mastery: i < 8 }]));
  const s = scoreAttempt(chosen, results);
  expect(s).toEqual({ score: 0.8, passed: true, missedConcepts: ['c', 'a'] });
});

test('remediation set draws 5 to 8 from the missed concepts', () => {
  const set = remediationSet(bank, ['a'], () => 0.5);
  expect(set.length).toBeGreaterThanOrEqual(5); expect(set.length).toBeLessThanOrEqual(8);
  expect(set.every((c) => c.concept === 'a')).toBe(true);
});

test('checkpointToLesson wraps the sample as a hint-free lesson', () => {
  const l = checkpointToLesson(bank, bank.bank.slice(0, 10));
  expect(l.challenges).toHaveLength(10); expect(l.explain).toHaveLength(0); expect(l.xp).toBe(10);
});

test('checkpointToLesson keeps the bank challenge ids unchanged for scoring', () => {
  const chosen = bank.bank.slice(0, 10);
  const l = checkpointToLesson(bank, chosen);
  expect(l.challenges.map((c) => c.id)).toEqual(chosen.map((c) => c.id));
});

test('the pass mark is the bank rule, not a hard-coded 75 per cent', () => {
  const chosen = bank.bank.slice(0, 10);
  const results = Object.fromEntries(chosen.map((c, i) => [c.id, { correct: i < 8, hints: 0, misses: 0, mastery: i < 8 }]));
  expect(scoreAttempt(chosen, results, 0.9).passed).toBe(false);
});

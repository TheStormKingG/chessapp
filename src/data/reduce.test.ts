import { reduceProgress, emptyProgress } from './reduce';
import { newEvent } from './events';

test('lesson completion marks the lesson and adds xp once per id', () => {
  const e = newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: false });
  const p = reduceProgress(emptyProgress(), [e, e]); // duplicate id counts once
  expect(p.lessons['1.1.1']).toEqual({ stars: 3, completed: true });
  expect(p.xp).toBe(10);
});

test('best stars are kept; replay earns half xp', () => {
  const a = newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 2, xp: 10, replay: false });
  const b = newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 3, xp: 10, replay: true });
  const p = reduceProgress(emptyProgress(), [a, b]);
  expect(p.lessons['1.1.1']?.stars).toBe(3);
  expect(p.xp).toBe(15);
});

test('checkpoint pass completes the unit; test-out marks lessons too', () => {
  const p = reduceProgress(emptyProgress(), [
    newEvent({ type: 'checkpoint_attempted', unit: '1.1', score: 0.8, passed: true, attempt: 1, missedConcepts: [] }),
    newEvent({ type: 'unit_tested_out', unit: '1.2' }),
  ]);
  expect(p.units['1.1']).toEqual({ passed: true, attempts: 1, failedAttempts: 0, testedOut: false });
  expect(p.units['1.2']).toEqual({ passed: true, attempts: 0, failedAttempts: 0, testedOut: true });
});

test('concept mastery counts mastery-credit attempts only', () => {
  const p = reduceProgress(emptyProgress(), [
    newEvent({ type: 'challenge_attempted', lessonId: '1.1.1', challengeId: 'c1', correct: true, hints: 0, misses: 0, mastery: true, context: 'lesson' }),
    newEvent({ type: 'challenge_attempted', lessonId: '1.1.1', challengeId: 'c2', correct: true, hints: 1, misses: 0, mastery: false, context: 'lesson' }),
  ]);
  expect(p.attempts).toBe(2);
  expect(p.masteryAttempts).toBe(1);
});

test('games: consecutive losses are tracked for the cool-down rule', () => {
  const loss = (id: string) =>
    newEvent({ type: 'game_finished', gameId: id, result: 'loss', moves: 30, hints: 0, takebacks: 0, crowns: 3, pgn: '' });
  const p = reduceProgress(emptyProgress(), [loss('a'), loss('b')]);
  expect(p.consecutiveLosses).toBe(2);
  expect(p.games).toBe(2);
});

test('a win resets the consecutive-loss counter and still awards xp', () => {
  const g = (id: string, result: 'win' | 'loss') =>
    newEvent({ type: 'game_finished', gameId: id, result, moves: 30, hints: 0, takebacks: 0, crowns: 1, pgn: '' });
  const p = reduceProgress(emptyProgress(), [g('a', 'loss'), g('b', 'win')]);
  expect(p.consecutiveLosses).toBe(0);
  expect(p.xp).toBe(20); // PRD F-EN-2: 10 xp per bot game regardless of result
});

test('a passed checkpoint awards 50 xp and later attempts stay passed', () => {
  const cp = (passed: boolean, attempt: number) =>
    newEvent({ type: 'checkpoint_attempted', unit: '1.1', score: passed ? 0.9 : 0.3, passed, attempt, missedConcepts: [] });
  const p = reduceProgress(emptyProgress(), [cp(false, 1), cp(true, 2)]);
  expect(p.units['1.1']).toEqual({ passed: true, attempts: 2, failedAttempts: 0, testedOut: false });
  expect(p.xp).toBe(50);
});

test('reducing is pure: the starting progress is not mutated', () => {
  const start = emptyProgress();
  reduceProgress(start, [newEvent({ type: 'lesson_completed', lessonId: '1.1.1', stars: 1, xp: 20, replay: false })]);
  expect(start).toEqual(emptyProgress());
});

test('passing a checkpoint twice awards the 50 xp bonus once', () => {
  const cp = (attempt: number) =>
    newEvent({ type: 'checkpoint_attempted', unit: '1.1', score: 0.9, passed: true, attempt, missedConcepts: [] });
  const p = reduceProgress(emptyProgress(), [cp(1), cp(2)]);
  expect(p.units['1.1']).toEqual({ passed: true, attempts: 2, failedAttempts: 0, testedOut: false });
  expect(p.xp).toBe(50);
});

test('failed attempts are counted separately and reset when the unit is passed (PRD 6.4)', () => {
  const cp = (passed: boolean, attempt: number) =>
    newEvent({ type: 'checkpoint_attempted', unit: '1.1', score: passed ? 0.9 : 0.3, passed, attempt, missedConcepts: [] });
  const failing = reduceProgress(emptyProgress(), [cp(false, 1), cp(false, 2), cp(false, 3)]);
  expect(failing.units['1.1']?.failedAttempts).toBe(3);
  expect(failing.units['1.1']?.attempts).toBe(3);
  const passed = reduceProgress(failing, [cp(true, 4)]);
  expect(passed.units['1.1']?.failedAttempts).toBe(0);
  expect(passed.units['1.1']?.attempts).toBe(4);
  // Testing out clears the counter too: the unit is done.
  const out = reduceProgress(failing, [newEvent({ type: 'unit_tested_out', unit: '1.1' })]);
  expect(out.units['1.1']?.failedAttempts).toBe(0);
});

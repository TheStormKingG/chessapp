import { LEVEL_OPTIONS } from './types';
import { IMPORT_MIN_GAMES, destinationPath, levelDestination, needsAssessment } from './route';

test('all four level answers are mapped, and each to its own starting point', () => {
  // The positive control for the table below: F-ON-2 says four options, and the
  // switch is exhaustive over the union, so a missing case would not compile —
  // but a wrong MAPPING would, which is what these assertions are for.
  expect(LEVEL_OPTIONS).toHaveLength(4);
  expect(levelDestination('new')).toEqual({ kind: 'path', unit: '1.1' });
  expect(levelDestination('know_rules')).toEqual({ kind: 'rules-check' });
  expect(levelDestination('casual')).toEqual({ kind: 'placement' });
});

test('"I play online already" falls back to the placement test while import cannot be asked', () => {
  // `null` is this build: F-IM-5 is not implemented, so there is no count.
  expect(levelDestination('plays_online')).toEqual({ kind: 'placement' });
  expect(levelDestination('plays_online', null)).toEqual({ kind: 'placement' });
});

test('the import seam opens on ten games and not on nine', () => {
  // The branch is unreachable from the app today, so it is exercised here
  // directly: when F-IM-5 passes a real count this is the behaviour it gets,
  // rather than a branch that has never run.
  expect(IMPORT_MIN_GAMES).toBe(10);
  expect(levelDestination('plays_online', IMPORT_MIN_GAMES)).toEqual({ kind: 'import' });
  expect(levelDestination('plays_online', IMPORT_MIN_GAMES + 40)).toEqual({ kind: 'import' });
  expect(levelDestination('plays_online', IMPORT_MIN_GAMES - 1)).toEqual({ kind: 'placement' });
  expect(levelDestination('plays_online', 0)).toEqual({ kind: 'placement' });
});

test('a game count changes nothing for the other three answers', () => {
  for (const level of ['new', 'know_rules', 'casual'] as const) {
    expect(levelDestination(level, 50)).toEqual(levelDestination(level));
  }
});

test('both assessments are reached at the placement route, and the path at Today', () => {
  expect(destinationPath({ kind: 'placement' })).toBe('/onboarding/placement');
  expect(destinationPath({ kind: 'rules-check' })).toBe('/onboarding/placement');
  expect(destinationPath({ kind: 'path', unit: '1.1' })).toBe('/');
  // The seam's other end, named so a search for it finds both halves.
  expect(destinationPath({ kind: 'import' })).toBe('/onboarding/import');
});

test('needsAssessment is true for exactly the two answers that take a test', () => {
  const needs = LEVEL_OPTIONS.filter((o) => needsAssessment(o.value)).map((o) => o.value);
  const doesNot = LEVEL_OPTIONS.filter((o) => !needsAssessment(o.value)).map((o) => o.value);
  // Both partitions asserted, and both non-empty: a predicate that matched
  // nothing, or everything, would otherwise satisfy one of these lines alone.
  expect(needs).toEqual(['know_rules', 'casual', 'plays_online']);
  expect(doesNot).toEqual(['new']);
  expect(needsAssessment(null)).toBe(false);
});

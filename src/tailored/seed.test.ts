import { describe, expect, it } from 'vitest';
import { newEvent } from '@/data/events';
import { unitById } from '@/path/curriculum';
import { buildProfile } from '@/profile';
import { FIRST_SESSION_AFTER_GAMES, firstSessionDue, gameCounts, seedFromAttempts } from './seed';

const checkpoint = (unit: string, missedConcepts: string[]) =>
  newEvent({ type: 'checkpoint_attempted', unit, score: 40, passed: false, attempt: 1, missedConcepts });

const puzzle = (puzzleId: string, themes: string[], solved: boolean) =>
  newEvent({
    type: 'puzzle_attempted',
    puzzleId,
    themes,
    puzzleRating: 900,
    solved,
    hinted: false,
    misses: 1,
    source: 'rated',
    ms: 1000,
  });

describe('what the profile does without games', () => {
  it('has no weaknesses at all, which is why F-TS-7 needs a seed', () => {
    // The fact the seed exists for. Asserted rather than asserted about: if
    // `buildProfile` ever learns to seed itself, this test says so.
    const p = buildProfile([]);
    expect(p.games).toBe(0);
    expect(p.weaknesses).toEqual([]);
  });
});

describe('F-TS-7: seeding from checkpoint results and puzzle attempts', () => {
  it('finds nothing when the learner has done nothing', () => {
    expect(seedFromAttempts([])).toEqual([]);
  });

  it('counts a missed checkpoint concept and points at a lesson of that unit', () => {
    const s = seedFromAttempts([checkpoint('1.2', ['loose-pieces'])]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: 'checkpoint-concept', id: 'loose-pieces', missed: 1, unit: '1.2' });
    expect(s[0]?.lessonId).toBe(unitById('1.2')?.lessons[0]?.id);
  });

  it('adds up repeats across attempts', () => {
    const s = seedFromAttempts([checkpoint('1.2', ['loose-pieces']), checkpoint('1.2', ['loose-pieces', 'counting'])]);
    expect(s.map((x) => [x.id, x.missed])).toEqual([
      ['loose-pieces', 2],
      ['counting', 1],
    ]);
  });

  it('counts a failed puzzle theme and ignores a solved one', () => {
    const s = seedFromAttempts([puzzle('a', ['fork'], false), puzzle('b', ['skewer'], true)]);
    expect(s.map((x) => x.id)).toEqual(['fork']);
    // Positive control: the same attempt, failed, IS counted.
    expect(seedFromAttempts([puzzle('b', ['skewer'], false)]).map((x) => x.id)).toEqual(['skewer']);
  });

  it('puts checkpoint concepts ahead of puzzle themes however often each was missed', () => {
    const s = seedFromAttempts([
      checkpoint('1.2', ['loose-pieces']),
      puzzle('a', ['fork'], false),
      puzzle('b', ['fork'], false),
      puzzle('c', ['fork'], false),
    ]);
    expect(s[0]?.kind).toBe('checkpoint-concept');
    expect(s[1]?.kind).toBe('puzzle-theme');
  });

  it('is deterministic when two signals tie', () => {
    const s = seedFromAttempts([checkpoint('1.2', ['b-concept', 'a-concept'])]);
    expect(s.map((x) => x.id)).toEqual(['a-concept', 'b-concept']);
  });

  it('records no lesson for a unit the curriculum does not declare', () => {
    expect(seedFromAttempts([checkpoint('99.9', ['x'])])[0]?.lessonId).toBeNull();
    // Control: a real unit does resolve.
    expect(seedFromAttempts([checkpoint('1.2', ['x'])])[0]?.lessonId).not.toBeNull();
  });
});

describe('F-TS-7: when the first session is offered', () => {
  it('waits for the tenth in-app reviewed game', () => {
    expect(firstSessionDue({ inAppGamesReviewed: 9, importedGames: 0 })).toBe(false);
    expect(firstSessionDue({ inAppGamesReviewed: FIRST_SESSION_AFTER_GAMES, importedGames: 0 })).toBe(true);
    expect(FIRST_SESSION_AFTER_GAMES).toBe(10);
  });

  it('does not make an importing learner play ten games first, per F-IM-5', () => {
    expect(firstSessionDue({ inAppGamesReviewed: 0, importedGames: 1 })).toBe(true);
  });

  it('separates the two kinds of game by which table the id is in', () => {
    // Deliberately asymmetric: two of each would pass whichever way the two counters
    // were wired, which a mutation run proved by swapping them.
    const counts = gameCounts({
      reviewedGameIds: ['a', 'i1', 'b', 'c'],
      importedGameIds: new Set(['i1', 'i2']),
    });
    expect(counts).toEqual({ inAppGamesReviewed: 3, importedGames: 1 });
  });

  it('counts nothing as nothing rather than as one of each', () => {
    expect(gameCounts({ reviewedGameIds: [], importedGameIds: new Set() })).toEqual({
      inAppGamesReviewed: 0,
      importedGames: 0,
    });
  });
});

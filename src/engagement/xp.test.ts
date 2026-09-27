import { newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import { emptyProgress, reduceProgress } from '@/data/reduce';
import {
  PUZZLE_RATING_CEILING,
  PUZZLE_RATING_FLOOR,
  XP_RATES,
  emptyXpContext,
  xpForEvent,
  xpForPuzzle,
  xpByDay,
  type XpContext,
} from './xp';

function ctx(o: Partial<XpContext> = {}): XpContext {
  return { ...emptyXpContext(), ...o };
}

const lesson = (xp: number, replay = false): EventPayload => ({
  type: 'lesson_completed',
  lessonId: '1.1.1',
  stars: 3,
  xp,
  replay,
});

const checkpoint = (passed: boolean): EventPayload => ({
  type: 'checkpoint_attempted',
  unit: '1.1',
  score: passed ? 0.9 : 0.3,
  passed,
  attempt: 1,
  missedConcepts: [],
});

const game = (result: 'win' | 'loss' | 'draw'): EventPayload => ({
  type: 'game_finished',
  gameId: 'g1',
  result,
  moves: 30,
  hints: 0,
  takebacks: 0,
  crowns: 1,
  pgn: '',
});

const review = (drillCompleted = false): EventPayload => ({
  type: 'game_reviewed',
  gameId: 'g1',
  accuracy: 70,
  blunders: 1,
  mistakes: 1,
  drillCompleted,
  partial: false,
});

const puzzle = (puzzleRating: number, solved = true): EventPayload => ({
  type: 'puzzle_attempted',
  puzzleId: 'p1',
  themes: ['fork'],
  puzzleRating,
  solved,
  hinted: false,
  misses: solved ? 0 : 3,
  source: 'rated',
  ms: 5000,
});

/** Every member of `EventPayload`, so a rule quantified over "any event" really is. */
const EVERY_PAYLOAD: EventPayload[] = [
  { type: 'lesson_started', lessonId: '1.1.1' },
  {
    type: 'challenge_attempted',
    lessonId: '1.1.1',
    challengeId: 'c1',
    correct: true,
    hints: 0,
    misses: 0,
    mastery: true,
    context: 'lesson',
  },
  lesson(20),
  lesson(20, true),
  checkpoint(true),
  checkpoint(false),
  { type: 'unit_tested_out', unit: '1.1' },
  { type: 'game_started', gameId: 'g1', persona: 'ada', color: 'w', timeControl: '10+0', coach: true },
  game('win'),
  game('loss'),
  game('draw'),
  review(true),
  review(false),
  puzzle(600),
  puzzle(1500, false),
  { type: 'games_imported', source: 'lichess', username: 'x', added: 10, alreadyHeld: 0, skipped: 0 },
  { type: 'settings_changed', key: 'textEntry', value: true },
];

/* ------------------------------------------------ F-EN-2, rate by rate */

test('a lesson pays its own authored value, and a replay pays half of it', () => {
  expect(xpForEvent(lesson(10))).toBe(10);
  expect(xpForEvent(lesson(20))).toBe(20);
  expect(xpForEvent(lesson(15, true))).toBe(7);
  // F-EN-2's band is what content is authored to; both ends are real values in
  // `content/` (the smallest lesson is 10, the largest 20).
  expect(XP_RATES.lessonMin).toBe(10);
  expect(XP_RATES.lessonMax).toBe(20);
});

test('a passed checkpoint pays 50, a failed one nothing, a retake nothing', () => {
  expect(xpForEvent(checkpoint(true))).toBe(50);
  expect(xpForEvent(checkpoint(false))).toBe(0);
  expect(xpForEvent(checkpoint(true), ctx({ unitAlreadyPassed: true }))).toBe(0);
  // The 50 really is conditional on the context flag and not on the score: the
  // same passed payload paid above and pays nothing here.
  expect(xpForEvent(checkpoint(true), ctx({ unitAlreadyPassed: false }))).toBe(50);
});

test('a bot game pays 10 whatever the result', () => {
  for (const result of ['win', 'loss', 'draw'] as const) {
    expect(xpForEvent(game(result))).toBe(10);
  }
});

test('a review pays 15, a review of a loss pays 25', () => {
  expect(xpForEvent(review(), ctx({ reviewedGameResult: 'win' }))).toBe(15);
  expect(xpForEvent(review(), ctx({ reviewedGameResult: 'draw' }))).toBe(15);
  expect(xpForEvent(review(), ctx({ reviewedGameResult: 'loss' }))).toBe(25);
});

test('a review whose game has no result in the log pays the "any game" rate', () => {
  // The imported-game case: F-IM banks `game_reviewed` for a game that has no
  // `game_finished`, so the result is unknown and the lower rate is paid.
  expect(xpForEvent(review(), ctx({ reviewedGameResult: null }))).toBe(XP_RATES.review);
  // Non-vacuous: the same call with a loss in context pays more, so the null
  // branch is a decision about the null and not the only value this can return.
  expect(xpForEvent(review(), ctx({ reviewedGameResult: 'loss' }))).toBe(XP_RATES.reviewOfALoss);
});

test('a completed drill adds 5 on top of the review, and an unfinished one adds nothing', () => {
  expect(xpForEvent(review(true), ctx({ reviewedGameResult: 'win' }))).toBe(15 + 5);
  expect(xpForEvent(review(false), ctx({ reviewedGameResult: 'win' }))).toBe(15);
  expect(xpForEvent(review(true), ctx({ reviewedGameResult: 'loss' }))).toBe(25 + 5);
  // The floor of F-EN-2's 5-to-10 band, because `drillCompleted` is a boolean
  // and the log does not say how long the drill was.
  expect(XP_RATES.drill).toBe(5);
});

test('a second review of the same game pays nothing, drill included', () => {
  expect(xpForEvent(review(true), ctx({ alreadyReviewed: true, reviewedGameResult: 'loss' }))).toBe(0);
});

test('a puzzle pays 2 to 5 by difficulty, and every step is reachable from a shipped rating', () => {
  expect(xpForPuzzle(PUZZLE_RATING_FLOOR)).toBe(2);
  expect(xpForPuzzle(900)).toBe(3);
  expect(xpForPuzzle(1200)).toBe(4);
  expect(xpForPuzzle(PUZZLE_RATING_CEILING)).toBe(5);
  // All four values occur inside 600-1500, which is the whole range the packs
  // ship (`puzzles/types.ts`). A weighting whose top step needed a rating no
  // pack holds would pass the two assertions above and never pay a 5.
  const paid = new Set<number>();
  for (let r = PUZZLE_RATING_FLOOR; r <= PUZZLE_RATING_CEILING - 1; r += 1) paid.add(xpForPuzzle(r));
  expect([...paid].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
});

test('the puzzle weighting is monotone and clamped outside the shipped range', () => {
  let last = 0;
  for (let r = 0; r <= 3000; r += 25) {
    const v = xpForPuzzle(r);
    expect(v).toBeGreaterThanOrEqual(last);
    last = v;
  }
  expect(xpForPuzzle(-500)).toBe(XP_RATES.puzzleMin);
  expect(xpForPuzzle(9000)).toBe(XP_RATES.puzzleMax);
});

test('events that record state rather than work pay nothing', () => {
  expect(xpForEvent({ type: 'lesson_started', lessonId: '1.1.1' })).toBe(0);
  expect(xpForEvent({ type: 'unit_tested_out', unit: '1.1' })).toBe(0);
  expect(
    xpForEvent({ type: 'game_started', gameId: 'g', persona: 'ada', color: 'w', timeControl: '10+0', coach: true }),
  ).toBe(0);
  expect(xpForEvent({ type: 'settings_changed', key: 'coachMuted', value: true })).toBe(0);
  // The positive control for this whole group: the SAME function pays for the
  // finishing events, so "0" here is a property of these payloads and not of a
  // function that returns 0 for everything.
  expect(xpForEvent(lesson(12))).toBeGreaterThan(0);
});

/* ------------------------------------------------ the invariant */

test('F-EN-2 invariant: no event ever pays a negative amount', () => {
  const contexts: XpContext[] = [
    ctx(),
    ctx({ alreadyReviewed: true }),
    ctx({ unitAlreadyPassed: true }),
    ctx({ reviewedGameResult: 'win' }),
    ctx({ reviewedGameResult: 'loss' }),
    ctx({ reviewedGameResult: 'draw' }),
  ];
  let positives = 0;
  for (const p of EVERY_PAYLOAD) {
    for (const c of contexts) {
      const v = xpForEvent(p, c);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      if (v > 0) positives += 1;
    }
  }
  // The sweep really did exercise paying arms: without this a `xpForEvent` that
  // returned 0 for every input would satisfy every assertion above.
  expect(positives).toBeGreaterThan(0);
  expect(EVERY_PAYLOAD).toHaveLength(17);
});

test('F-EN-2 invariant: XP is never paid for a win alone', () => {
  // Stated as a property of the function: for every action whose payload carries
  // an outcome, swapping the outcome for the WORSE one never lowers the award.
  // That is the testable form of "never for a win alone" — winning must not be
  // what is being paid for.
  expect(xpForEvent(game('win'))).toBe(xpForEvent(game('loss')));
  expect(xpForEvent(game('win'))).toBe(xpForEvent(game('draw')));

  // A puzzle pays for the attempt. The same puzzle, solved and failed, pays the
  // same; only its difficulty moves the number.
  for (const rating of [600, 900, 1200, 1499]) {
    expect(xpForEvent(puzzle(rating, true))).toBe(xpForEvent(puzzle(rating, false)));
  }
  expect(xpForEvent(puzzle(1499, false))).toBeGreaterThan(xpForEvent(puzzle(600, true)));

  // And the one place a result IS read pays MORE for the loss, which is the
  // direction F-EN-2 asks for.
  expect(xpForEvent(review(), ctx({ reviewedGameResult: 'loss' }))).toBeGreaterThan(
    xpForEvent(review(), ctx({ reviewedGameResult: 'win' })),
  );
});

test('the story-game rate is declared and no event can carry a story game', () => {
  // F-EN-2 lists a story game at 20. The rate is declared so the table is
  // complete, and this asserts the reason nothing pays it: there is no event
  // type for a story game, so the gap is in the log and not in this file.
  //
  // Asserted over the event types rather than over the awards, because 20 is a
  // perfectly ordinary lesson award and "no award equals 20" would be false for
  // a reason that has nothing to do with story games.
  expect(XP_RATES.storyGame).toBe(20);
  const types = [...new Set(EVERY_PAYLOAD.map((p) => p.type))];
  expect(types.filter((t) => /story/i.test(t))).toEqual([]);
  // Positive control for the filter: it does match when there is something to
  // match, so the empty result above is an absence and not a broken predicate.
  expect([...types, 'story_game_finished'].filter((t) => /story/i.test(t))).toEqual(['story_game_finished']);
});

/* ------------------------------------------------ the per-day breakdown */

test('xpByDay agrees with the projection total on a log that exercises every rate', () => {
  // The anti-drift assertion for the two XP walks. Every arm that pays is in this
  // log, including the three context-dependent ones (a re-review, a retaken
  // checkpoint, a review of a loss), so an arm that diverged would show up here.
  const at = (payload: EventPayload, d: number, hour: number) => newEvent(payload, new Date(2026, 3, d, hour));
  const log: LearnerEvent[] = [
    at(lesson(14), 1, 9),
    at(puzzle(700), 1, 10),
    at(puzzle(1300), 1, 11),
    at(checkpoint(true), 1, 12),
    at(checkpoint(true), 1, 13), // a retake: pays nothing
    at(game('loss'), 2, 9),
    at(review(true), 2, 10), // review of a loss, with a drill
    at(review(true), 2, 11), // the same game again: pays nothing
    at(game('win'), 3, 9),
    at(
      { type: 'game_reviewed', gameId: 'g2', accuracy: 70, blunders: 1, mistakes: 1, drillCompleted: false, partial: false },
      3,
      10,
    ),
    at(lesson(16, true), 3, 11),
    at({ type: 'settings_changed', key: 'coachMuted', value: true }, 3, 12),
  ];
  const byDay = xpByDay(log);
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);

  expect(total).toBe(reduceProgress(emptyProgress(), log).xp);
  // Non-vacuous on both sides: three distinct days really are present and the
  // total really is non-zero, so this is not 0 === 0.
  expect([...byDay.keys()].sort()).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
  expect(total).toBeGreaterThan(0);
});

test('xpByDay puts each award on the day the action happened, not the day it was totalled', () => {
  const late = newEvent(lesson(12), new Date(2026, 3, 1, 23, 50));
  const early = newEvent(lesson(12), new Date(2026, 3, 2, 0, 10));
  const byDay = xpByDay([late, early]);
  expect(byDay.get('2026-04-01')).toBe(12);
  expect(byDay.get('2026-04-02')).toBe(12);
});

test('xpByDay records no day for a log that pays nothing', () => {
  const byDay = xpByDay([newEvent({ type: 'lesson_started', lessonId: '1.1.1' }, new Date(2026, 3, 1, 9))]);
  expect([...byDay.keys()]).toEqual([]);
  // Positive control: the same shape of call with a paying event does record a
  // day, so the empty map is an absence of awards and not a broken walk.
  expect([...xpByDay([newEvent(lesson(10), new Date(2026, 3, 1, 9))]).keys()]).toEqual(['2026-04-01']);
});

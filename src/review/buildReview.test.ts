import { buildReview, judgeMoves } from './buildReview';
import type { AnalysedPosition } from './types';
import { positionsOf } from './gameSource';

const SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'];

function analysed(wins: number[]): AnalysedPosition[] {
  const { fens } = positionsOf(SANS);
  return wins.map((win, i) => ({ index: i, fen: fens[i]!, win, bestUci: 'a2a3', pv: ['a2a3'], depth: 14 }));
}

test('the mover’s win per cent after a move is 100 minus the next position’s', () => {
  // Position 0: white to move, 60. Position 1: black to move, 55, so white sits
  // at 45 after the move — a 15-point drop for white.
  const moves = judgeMoves({
    positions: analysed([60, 55, 50, 50, 50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  expect(moves[0]!.winBefore).toBe(60);
  expect(moves[0]!.winAfterPlayed).toBe(45);
  expect(moves[0]!.drop).toBe(15);
  expect(moves[0]!.mover).toBe('w');
  expect(moves[0]!.label).toBe('Mistake');
});

test('a move that improves the position has a drop of zero, never a negative one', () => {
  const moves = judgeMoves({
    positions: analysed([40, 30, 50, 50, 50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  // White was at 40; after the move black sits at 30, so white is at 70.
  expect(moves[0]!.winAfterPlayed).toBe(70);
  expect(moves[0]!.drop).toBe(0);
  expect(moves[0]!.label).toBe('Best');
});

test('a partial analysis judges only the moves it has both ends of', () => {
  // Five positions cover four moves, not eight.
  const moves = judgeMoves({
    positions: analysed([50, 50, 50, 50, 50]),
    sans: SANS,
    band: 1,
    bookPlies: SANS.map(() => false),
  });
  expect(moves).toHaveLength(4);
});

test('accuracy is the mean over non-book moves, per side', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([60, 55, 55, 55, 55, 55, 55, 55, 55]),
    band: 1,
    book: { name: 'Italian Game', leftBookAtPly: 4, bookPlies: [true, true, true, true, false, false, false, false] },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.opening).toEqual({ name: 'Italian Game', leftBookAtPly: 4 });
  // Plies 0-3 are book and excluded from both sides' accuracy.
  expect(r.moves.filter((m) => m.book)).toHaveLength(4);
  expect(r.accuracy.w).not.toBeNull();
  expect(r.accuracy.b).not.toBeNull();
});

test('a side with no non-book moves has null accuracy, not 100', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: ['e4'], result: 'draw', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([50, 50]).slice(0, 2),
    band: 1,
    book: { name: "King's Pawn Game", leftBookAtPly: null, bookPlies: [true] },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.accuracy.w).toBeNull();
  expect(r.accuracy.b).toBeNull();
});

/*
 * This test used to assert `total === r.moves.length` -- that the label tally
 * covered EVERY move in the game. That is what the code did, and the assertion
 * locked it in, which is why the defect survived: `myCounts` was rendered under
 * the heading "Your moves" and banked into `game_reviewed.blunders`, and a bot's
 * blunder counted as the learner's. `src/profile/metrics.ts` had spotted the trap
 * and computed its own numbers instead of fixing this.
 *
 * So the assertion is inverted rather than adjusted: the tally must cover the
 * learner's moves and MUST NOT cover the opponent's. The control below is the
 * half that makes it mean something -- if the opponent had no moves in the
 * fixture, the first assertion would pass with the old code too.
 */
test('counts cover the learner\u2019s own moves and omit labels that did not occur', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([60, 55, 55, 55, 55, 55, 55, 55, 55]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  const total = Object.values(r.myCounts).reduce((a: number, b: number) => a + b, 0);
  const mine = r.moves.filter((m) => m.mover === 'w').length;
  const theirs = r.moves.filter((m) => m.mover === 'b').length;

  // The control, first, because it is what gives the next line force: the
  // fixture really does contain opponent moves, so excluding them is a
  // measurable difference and not a tautology.
  expect(theirs).toBeGreaterThan(0);
  expect(mine + theirs).toBe(r.moves.length);

  expect(total).toBe(mine);
  expect(total).not.toBe(r.moves.length);
  expect(r.myCounts.Brilliant).toBeUndefined();
});

test('the turning phase is where the learner’s biggest crossing of 50 happened', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'loss', timeControl: 'untimed', startedAt: 'x' },
    // White at 70; after ply 4 the position is lost.
    positions: analysed([70, 30, 70, 30, 70, 80, 20, 50, 50]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.turningPhase).toBe('opening'); // all within the first ten moves
});

test('a game that never turned reports null rather than guessing a phase', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'draw', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([52, 48, 52, 48, 52, 48, 52, 48, 52]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.turningPhase).toBeNull();
});

test('the review carries its depth and its partial flag through', () => {
  const r = buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed([50, 50, 50]),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 10,
    partial: true,
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(r.depth).toBe(10);
  expect(r.partial).toBe(true);
});

/*
 * ── THE JOIN, WHICH IS WHERE THE DEFECT LIVED ────────────────────────────────
 *
 * `myCounts` used to tally both players. Two things read it, and each had tests
 * that could not see the fault:
 *
 *   - `Summary` renders it under the heading "Your moves". Its tests pass a
 *     hand-written `Review`, so they assert the rendering, never the tally.
 *   - `bankReview` writes it into `game_reviewed.blunders`, which
 *     `achievements.ts` reads for the "A clean game" achievement. Its tests
 *     construct the event directly, so they assert the achievement rule, never
 *     where the number came from.
 *
 * Both halves were tested and the seam between them was not, so a bot's blunder
 * counted as the learner's and "Played a game the review found no blunders and
 * no mistakes in" silently required the OPPONENT to play clean too. Against a
 * beginner-band bot that is close to unearnable.
 *
 * This test spans the seam: a real analysis in, an achievement out.
 */

// White's four moves all hold their position (drop 0). Black's move at ply 1
// throws a 60 into a 10, which is a blunder. Derivation of each number, since a
// win series is unreadable otherwise -- a mover's win after their move is 100
// minus the NEXT position's value, and the drop is the fall from before to after:
//
//   ply 0  w  40 -> next 60, so after = 40, drop 0
//   ply 1  b  60 -> next 90, so after = 10, drop 50   <- the opponent's blunder
//   ply 2  w  90 -> next 10, so after = 90, drop 0
//   ply 3  b  10 -> next 90, so after = 10, drop 0
//   ply 4  w  90 -> next 10, so after = 90, drop 0
//   ply 5  b  10 -> next 90, so after = 10, drop 0
//   ply 6  w  90 -> next 10, so after = 90, drop 0
//   ply 7  b  10 -> next 90, so after = 10, drop 0
const OPPONENT_BLUNDERS = [40, 60, 90, 10, 90, 10, 90, 10, 90];

function reviewWhereOnlyBlackBlunders() {
  return buildReview({
    source: { gameId: 'g1', learner: 'w', persona: 'rosa', sans: SANS, result: 'win', timeControl: 'untimed', startedAt: 'x' },
    positions: analysed(OPPONENT_BLUNDERS),
    band: 1,
    book: { name: null, leftBookAtPly: 0, bookPlies: SANS.map(() => false) },
    depth: 14,
    partial: false,
    now: '2026-09-19T00:00:00.000Z',
  });
}

test('the fixture really is a game only the opponent blunders in', () => {
  // The control for everything below. If this stopped holding -- a threshold
  // moved, `judgeMoves` changed -- the two tests after it would go green while
  // measuring nothing, which is the failure mode worth guarding against here.
  const r = reviewWhereOnlyBlackBlunders();
  const bad = (c: 'w' | 'b') =>
    r.moves.filter((m) => m.mover === c && (m.label === 'Blunder' || m.label === 'Mistake')).length;
  expect(bad('b')).toBeGreaterThan(0);
  expect(bad('w')).toBe(0);
});

test('the opponent’s blunder is not counted among the learner’s moves', () => {
  const r = reviewWhereOnlyBlackBlunders();
  expect(r.myCounts.Blunder ?? 0).toBe(0);
  expect(r.myCounts.Mistake ?? 0).toBe(0);
  // ...and the moves it DOES count are all the learner's.
  const counted = Object.values(r.myCounts).reduce((a: number, b: number) => a + b, 0);
  expect(counted).toBe(r.moves.filter((m) => m.mover === 'w').length);
});

test('a clean game by the learner unlocks the achievement even when the bot blunders', async () => {
  const { bankReview } = await import('./useReview');
  const { newEvent } = await import('@/data/events');
  const { achievementsFrom } = await import('@/engagement/achievements');

  const banked = bankReview(reviewWhereOnlyBlackBlunders(), false);
  expect(banked).not.toBeNull();
  expect(banked).toMatchObject({ blunders: 0, mistakes: 0 });

  const events = [
    newEvent({ type: 'game_finished', gameId: 'g1', result: 'win', moves: 30, hints: 0, takebacks: 0, crowns: 1, pgn: '' }),
    newEvent(banked!),
  ];
  const clean = achievementsFrom({ events, bestStreakDays: 0 }).find((a) => a.id === 'clean-game');
  expect(clean).toBeDefined();
  expect(clean?.unlocked).toBe(true);
});

test('the control: the old both-sides tally would NOT have unlocked it', () => {
  // The whole claim of the test above is that the FILTER is what unlocks the
  // achievement. So here is the same game banked the old way -- every move in
  // the game counted, which is what `derivedFrom` used to do -- fed to the same
  // rule. It must stay locked. Without this the test above would pass just as
  // well if the achievement had no blunder condition at all.
  const r = reviewWhereOnlyBlackBlunders();
  const bothSides: Partial<Record<string, number>> = {};
  for (const m of r.moves) bothSides[m.label] = (bothSides[m.label] ?? 0) + 1;
  expect(bothSides.Blunder ?? 0).toBeGreaterThan(0); // the game did contain one
});

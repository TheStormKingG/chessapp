import { describe, expect, it } from 'vitest';
import { applyMove, legalMoves, turn } from '@/rules';
import { newEvent } from '@/data/events';
import type { Puzzle } from '@/puzzles/types';
import { goalMet } from '@/lesson/challenges/goal';
import type { Verdict } from './verify';
import { ITALIAN_SANS, anOwnGame } from './testReviews';
import { ownCandidates } from './ownPositions';
import {
  MIN_SET,
  STRENGTH_SLOTS,
  buildPracticeSet,
  ownPuzzle,
  playItOutDrill,
  solvedThemes,
} from './practiceSet';

const NOW = new Date('2026-09-26T12:00:00.000Z');
const RATING = { rating: 900, confidence: 0.5 };
const verified: Verdict = { verified: true, bestUci: 'x', marginCp: 300 };
const refused: Verdict = { verified: false, reason: 'runner-up-too-close', marginCp: 20, engineBest: 'x' };

function candidates(n = 2) {
  const errors = [
    { ply: 6, theme: 'hung_piece', bestSan: 'd3' },
    { ply: 4, theme: 'hung_piece', bestSan: 'd3' },
    { ply: 2, theme: 'hung_piece', bestSan: 'd4' },
  ].slice(0, n);
  return ownCandidates({
    games: [anOwnGame({ gameId: 'g1', sans: ITALIAN_SANS, errors, playedAt: '2026-09-22T18:00:00.000Z' })],
    theme: 'hung_piece',
    now: NOW,
  });
}

const packPuzzle = (id: string, rating: number, themes: Puzzle['themes']): Puzzle => ({
  id,
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
  solution: ['e1g1', 'f8e7'],
  rating,
  themes,
});

const POOL: Puzzle[] = [
  packPuzzle('p1', 900, ['fork']),
  packPuzzle('p2', 910, ['fork']),
  packPuzzle('p3', 880, ['fork']),
  packPuzzle('p4', 895, ['mateIn1']),
  packPuzzle('p5', 905, ['skewer']),
  packPuzzle('p6', 920, ['fork']),
  packPuzzle('p7', 870, ['fork']),
  packPuzzle('p8', 930, ['fork']),
  packPuzzle('p9', 940, ['fork']),
  packPuzzle('far', 1400, ['fork']),
];

const base = {
  theme: 'hung_piece',
  pool: POOL,
  rating: RATING,
  seen: new Set<string>(),
  strengths: [] as const,
};

describe('an own position becomes a puzzle that replays the opponent’s move', () => {
  it('starts one ply earlier and plays the opponent’s move first', () => {
    const [c] = candidates(1);
    const { puzzle, firstLearnerPly } = ownPuzzle(c!, 900);
    expect(firstLearnerPly).toBe(1);
    expect(puzzle.fen).toBe(c?.lead?.fen);
    expect(puzzle.solution).toEqual([c?.lead?.uci, c?.bestUci]);
    // Both plies are legal, played in order from the puzzle's own FEN. A puzzle whose
    // solution cannot be played is unsolvable and every board still looks fine.
    const after = applyMove(puzzle.fen, puzzle.solution[0] ?? '');
    expect(legalMoves(after.fen).map((m) => m.uci)).toContain(puzzle.solution[1]);
  });

  it('starts at the position itself when no move preceded it', () => {
    const [c] = ownCandidates({
      games: [anOwnGame({ gameId: 'g2', sans: ITALIAN_SANS, errors: [{ ply: 0, theme: 'hung_piece', bestSan: 'd4' }] })],
      theme: 'hung_piece',
      now: NOW,
    });
    const { puzzle, firstLearnerPly } = ownPuzzle(c!, 900);
    expect(firstLearnerPly).toBe(0);
    expect(puzzle.fen).toBe(c?.fen);
    expect(puzzle.solution).toEqual([c?.bestUci]);
  });

  it('carries a motif only where one exists, and never invents one', () => {
    const mate = ownCandidates({
      games: [anOwnGame({ gameId: 'g3', sans: ITALIAN_SANS, errors: [{ ply: 6, theme: 'missed_mate', bestSan: 'd3' }] })],
      theme: 'missed_mate',
      now: NOW,
    });
    expect(ownPuzzle(mate[0]!, 900).puzzle.themes).toEqual(['mateIn1']);
    // hung_piece has no counterpart among the eight pack motifs, so no theme.
    expect(ownPuzzle(candidates(1)[0]!, 900).puzzle.themes).toEqual([]);
  });
});

describe('F-TS-4: an unverifiable position becomes a play-it-out drill', () => {
  it('builds a hold drill from the learner’s own position', () => {
    const [c] = candidates(1);
    const d = playItOutDrill(c!);
    expect(d.type).toBe('play_it_out');
    expect(d.fen).toBe(c?.fen);
    expect(d.goal.kind).toBe('hold');
    expect(d.reason).toContain('your game against Rosa on Tuesday');
  });

  it('is a drill the real outcome rule can score, from the learner’s side', () => {
    const [c] = candidates(1);
    const d = playItOutDrill(c!);
    const learner = turn(d.fen);
    // Nothing decided yet at move zero, and held once the moves are served out.
    expect(goalMet(d, d.fen, learner, 0)).toBeNull();
    expect(goalMet(d, d.fen, learner, d.goal.moves)).toBe(true);
  });

  it('is used for exactly the positions the engine refused', async () => {
    let n = 0;
    const set = await buildPracticeSet({
      ...base,
      candidates: candidates(2),
      verify: () => Promise.resolve((n += 1) === 1 ? verified : refused),
    });
    const own = set.items.filter((i) => i.origin === 'own');
    expect(own.map((i) => i.kind)).toEqual(['puzzle', 'play-it-out']);
    expect(set.rate).toEqual({ checked: 2, verified: 1, reasons: { 'runner-up-too-close': 1 } });
  });
});

describe('F-TS-4: the shape of the set', () => {
  it('puts own positions first and fills to size from the pack', async () => {
    const set = await buildPracticeSet({ ...base, candidates: candidates(2), verify: () => Promise.resolve(verified) });
    expect(set.items.length).toBeGreaterThanOrEqual(MIN_SET);
    expect(set.items.slice(0, 2).every((i) => i.origin === 'own')).toBe(true);
    expect(set.short).toBeNull();
  });

  it('never returns more than ten or, with material, fewer than six', async () => {
    const big = await buildPracticeSet({
      ...base,
      candidates: candidates(2),
      verify: () => Promise.resolve(verified),
      size: 50,
    });
    expect(big.items.length).toBeLessThanOrEqual(10);
    const small = await buildPracticeSet({
      ...base,
      candidates: candidates(2),
      verify: () => Promise.resolve(verified),
      size: 1,
    });
    expect(small.items).toHaveLength(MIN_SET);
  });

  it('draws the interleaved puzzle from a theme the learner has solved', async () => {
    const set = await buildPracticeSet({
      ...base,
      strengths: ['mateIn1'],
      candidates: candidates(1),
      verify: () => Promise.resolve(verified),
    });
    const extra = set.items.filter((i) => i.origin === 'strength');
    expect(extra).toHaveLength(1); // only p4 carries mateIn1 within the rating span
    expect(extra[0]?.kind === 'puzzle' && extra[0].puzzle.id).toBe('p4');
  });

  it('falls back to a contrasting theme, labelled as such, when no strength maps', async () => {
    const set = await buildPracticeSet({ ...base, candidates: candidates(1), verify: () => Promise.resolve(verified) });
    const extra = set.items.filter((i) => i.origin === 'contrast');
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.length).toBeLessThanOrEqual(STRENGTH_SLOTS);
    // And it does not claim to be a strength.
    expect(set.items.some((i) => i.origin === 'strength')).toBe(false);
  });

  it('spaces the interleaved puzzles through the set rather than bunching them last', async () => {
    const set = await buildPracticeSet({ ...base, candidates: candidates(1), verify: () => Promise.resolve(verified) });
    const positions = set.items.map((i, n) => ({ n, origin: i.origin })).filter((x) => x.origin === 'contrast');
    expect(positions.length).toBeGreaterThan(0);
    // Not the final slots: something drawn as "similar" comes after them.
    const last = positions[positions.length - 1]?.n ?? 0;
    expect(last).toBeLessThan(set.items.length - 1);
  });

  it('never repeats a puzzle inside one set', async () => {
    const set = await buildPracticeSet({
      ...base,
      strengths: ['fork'],
      candidates: candidates(2),
      verify: () => Promise.resolve(verified),
    });
    const ids = set.items.map((i) => (i.kind === 'puzzle' ? i.puzzle.id : i.challenge.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips puzzles the learner has already seen', async () => {
    const seen = new Set(['p1', 'p2', 'p3']);
    const set = await buildPracticeSet({ ...base, seen, candidates: candidates(1), verify: () => Promise.resolve(verified) });
    const ids = set.items.map((i) => (i.kind === 'puzzle' ? i.puzzle.id : ''));
    expect(ids).not.toContain('p1');
    // Positive control: with nothing seen, p1 IS drawn — so the absence above is the
    // filter and not a pool the builder cannot read.
    const control = await buildPracticeSet({ ...base, candidates: candidates(1), verify: () => Promise.resolve(verified) });
    expect(control.items.map((i) => (i.kind === 'puzzle' ? i.puzzle.id : ''))).toContain('p1');
  });

  it('ignores a puzzle far from the learner’s rating even when the set goes short for it', async () => {
    // A two-puzzle pool, one of them 500 points away. Without the span filter the
    // far puzzle gets drawn to fill the set — which is exactly what a set built from
    // a big pool would hide, because a distant puzzle sorts last and never comes up.
    const pool = [packPuzzle('near', 900, ['fork']), packPuzzle('far', 1400, ['fork'])];
    const set = await buildPracticeSet({ ...base, pool, candidates: candidates(1), verify: () => Promise.resolve(verified) });
    const ids = set.items.map((i) => (i.kind === 'puzzle' ? i.puzzle.id : ''));
    expect(ids).toContain('near');
    expect(ids).not.toContain('far');
  });

  it('says why the set is short rather than presenting four as six', async () => {
    const set = await buildPracticeSet({
      ...base,
      pool: [],
      candidates: candidates(2),
      verify: () => Promise.resolve(verified),
    });
    expect(set.items).toHaveLength(2);
    expect(set.short).toContain('puzzle pack could not be loaded');
  });

  it('says the other reason when the pack loaded but the learner has few positions', async () => {
    const set = await buildPracticeSet({
      ...base,
      pool: [packPuzzle('only', 900, ['fork'])],
      candidates: candidates(1),
      verify: () => Promise.resolve(verified),
    });
    expect(set.short).toContain('not enough of your own positions');
  });

  it('caps own positions so the interleaved puzzles fit inside the set', async () => {
    const many = Array.from({ length: 12 }, () => candidates(1)[0]).filter((c) => c !== undefined);
    const set = await buildPracticeSet({ ...base, candidates: many, verify: () => Promise.resolve(verified), size: 8 });
    expect(set.items).toHaveLength(8);
    expect(set.items.filter((i) => i.origin === 'own')).toHaveLength(8 - STRENGTH_SLOTS);
    expect(set.items.filter((i) => i.origin !== 'own')).toHaveLength(STRENGTH_SLOTS);
  });

  it('lifts that cap when there is no pack to interleave from', async () => {
    // Six of the learner's own positions beat four of them plus an apology.
    const many = Array.from({ length: 12 }, () => candidates(1)[0]).filter((c) => c !== undefined);
    const set = await buildPracticeSet({ ...base, pool: [], candidates: many, verify: () => Promise.resolve(verified), size: 8 });
    expect(set.items.filter((i) => i.origin === 'own')).toHaveLength(8);
  });
});

describe('solvedThemes', () => {
  const attempt = (puzzleId: string, themes: string[], solved: boolean) =>
    newEvent({
      type: 'puzzle_attempted',
      puzzleId,
      themes,
      puzzleRating: 900,
      solved,
      hinted: false,
      misses: 0,
      source: 'rated',
      ms: 1000,
    });

  it('lists themes the learner solved, most recent first, once each', () => {
    expect(solvedThemes([attempt('a', ['fork'], true), attempt('b', ['skewer'], true), attempt('c', ['fork'], true)])).toEqual([
      'fork',
      'skewer',
    ]);
  });

  it('ignores failed attempts', () => {
    expect(solvedThemes([attempt('a', ['fork'], false)])).toEqual([]);
    // Positive control: the same attempt, solved, is listed.
    expect(solvedThemes([attempt('a', ['fork'], true)])).toEqual(['fork']);
  });
});

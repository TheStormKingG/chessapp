import { expect, test } from 'vitest';
import { NO_BAND_STATS, type BandStatsSource } from './bandStats';
import { measureGame, totalsOf, type GameMetrics } from './metrics';
import {
  CLEAN_RUN_MIN_GAMES,
  GOOD_LINE_SCORE,
  LINE_MIN_GAMES,
  PHASE_GAP_POINTS,
  TOP_STRENGTHS,
  topStrengths,
  type StrengthContext,
} from './strengths';
import { aGame, type GameSpec } from './testGames';

function ctx(specs: GameSpec[], over: Partial<StrengthContext> = {}): StrengthContext {
  const games: GameMetrics[] = specs.map((s) => measureGame(aGame(s)));
  return {
    games,
    totals: totalsOf(games),
    bucket: null,
    source: NO_BAND_STATS,
    comparisonsAllowed: false,
    early: false,
    ...over,
  };
}

/** `n` clean games — a move, no errors. */
function clean(n: number, over: GameSpec = {}): GameSpec[] {
  return Array.from({ length: n }, () => ({ moves: [{ accuracy: 70 }], ...over }));
}

test('at most three strengths are shown', () => {
  // Four clean-habit candidates exist here (all four themes at zero), so the cap
  // is doing the limiting rather than there being nothing to cut.
  const s = topStrengths(ctx(clean(CLEAN_RUN_MIN_GAMES + 2)));
  expect(s).toHaveLength(TOP_STRENGTHS);
});

test('a learner with nothing demonstrable is shown nothing, not three invented things', () => {
  // Every theme occurring, no opening, one phase: no candidate qualifies.
  const s = topStrengths(
    ctx([
      {
        moves: [{ label: 'Mistake', drop: 20 }],
        errors: [
          { theme: 'hung_piece', ply: 0 },
          { theme: 'missed_capture', ply: 0 },
          { theme: 'missed_mate', ply: 0 },
          { theme: 'ignored_threat', ply: 0 },
        ],
      },
    ]),
  );
  expect(s).toEqual([]);
});

test('a clean run needs a minimum number of games before it is claimed', () => {
  // With two games, a learner who never reached a middlegame has a clean sheet on
  // every middlegame theme, and "you have not missed free material" would be about
  // the games not happening rather than about the learner.
  expect(topStrengths(ctx(clean(CLEAN_RUN_MIN_GAMES - 1)))).toEqual([]);
  expect(topStrengths(ctx(clean(CLEAN_RUN_MIN_GAMES))).length).toBeGreaterThan(0);
});

test('a clean habit states the run length, agreeing in number', () => {
  const s = topStrengths(ctx(clean(7)));
  const texts = s.map((x) => x.text).join(' ');
  expect(texts).toContain('in your last 7 games.');
  expect(texts).not.toContain('7 game.');
});

test('a theme that did occur is not claimed as a habit kept', () => {
  const games: GameSpec[] = [
    ...clean(6),
    { moves: [{ label: 'Mistake', drop: 20 }], errors: [{ theme: 'hung_piece', ply: 0 }] },
  ];
  const texts = topStrengths(ctx(games)).map((s) => s.text).join(' ');
  expect(texts).not.toContain('left a piece free to take');
  // Positive control: the other three themes ARE still clean and ARE claimed, so
  // the absence above is about hung_piece and not about a suppressed section.
  expect(texts).toContain('You have not missed free material');
});

test('an opening the learner scores well in is a strength, with the record stated', () => {
  const line = (result: 'win' | 'loss' | 'draw'): GameSpec => ({
    learner: 'w',
    result,
    opening: { name: 'Italian Game', leftBookAtPly: 9 },
    moves: [{ accuracy: 70, phase: 'opening' }],
    // An error in every game, so the clean-habit candidates cannot crowd this out
    // and the test is about the opening rather than about ranking.
    errors: [
      { theme: 'hung_piece', ply: 0 },
      { theme: 'missed_capture', ply: 0 },
      { theme: 'missed_mate', ply: 0 },
      { theme: 'ignored_threat', ply: 0 },
    ],
  });
  const s = topStrengths(ctx([line('win'), line('win'), line('draw')]));
  expect(s).toHaveLength(1);
  expect(s[0]?.kind).toBe('opening');
  expect(s[0]?.text).toBe('You score well in the Italian Game as White: 2 won, 1 drawn, 0 lost.');
  expect(s[0]?.evidence.games).toBe(3);
});

test('an opening is not claimed on too few games or too poor a score', () => {
  const line = (result: 'win' | 'loss' | 'draw'): GameSpec => ({
    learner: 'w',
    result,
    opening: { name: 'Italian Game', leftBookAtPly: 9 },
    moves: [{ accuracy: 70, phase: 'opening' }],
    errors: [
      { theme: 'hung_piece', ply: 0 },
      { theme: 'missed_capture', ply: 0 },
      { theme: 'missed_mate', ply: 0 },
      { theme: 'ignored_threat', ply: 0 },
    ],
  });
  // Below the game floor, even at a perfect score.
  const tooFew = Array.from({ length: LINE_MIN_GAMES - 1 }, () => line('win'));
  expect(topStrengths(ctx(tooFew))).toEqual([]);
  // Enough games, score below the bar: three games, one win, two losses = 0.33.
  expect(GOOD_LINE_SCORE).toBeGreaterThan(1 / 3);
  expect(topStrengths(ctx([line('win'), line('loss'), line('loss')]))).toEqual([]);
});

test('the self-relative phase strength says it is self-relative', () => {
  // F-SW-2 asks for phases above the learner's BAND. Without band data this is a
  // smaller claim, and the sentence has to say so or a learner will read it as the
  // bigger one.
  const s = topStrengths(
    ctx(
      [
        {
          moves: [
            { accuracy: 90, phase: 'endgame' },
            { accuracy: 50, phase: 'middlegame' },
          ],
          errors: [
            { theme: 'hung_piece', ply: 0 },
            { theme: 'missed_capture', ply: 0 },
            { theme: 'missed_mate', ply: 0 },
            { theme: 'ignored_threat', ply: 0 },
          ],
        },
      ],
      // Ten games' worth of sample so nothing is suppressed for size.
    ),
  );
  expect(s).toHaveLength(1);
  expect(s[0]?.kind).toBe('phase');
  expect(s[0]?.text).toContain('most accurate phase');
  expect(s[0]?.text).toContain('not with other players');
});

test('no phase is called strongest when the phases are close together', () => {
  const s = topStrengths(
    ctx([
      {
        moves: [
          { accuracy: 70, phase: 'endgame' },
          { accuracy: 70 - (PHASE_GAP_POINTS - 1), phase: 'middlegame' },
        ],
        errors: [
          { theme: 'hung_piece', ply: 0 },
          { theme: 'missed_capture', ply: 0 },
          { theme: 'missed_mate', ply: 0 },
          { theme: 'ignored_threat', ply: 0 },
        ],
      },
    ]),
  );
  expect(s).toEqual([]);
});

test('one measured phase alone is not a strongest phase', () => {
  // Nothing to be strongest THAN. A single phase reported as the best would be a
  // comparison with an empty set.
  const s = topStrengths(
    ctx([
      {
        moves: [{ accuracy: 95, phase: 'middlegame' }],
        errors: [
          { theme: 'hung_piece', ply: 0 },
          { theme: 'missed_capture', ply: 0 },
          { theme: 'missed_mate', ply: 0 },
          { theme: 'ignored_threat', ply: 0 },
        ],
      },
    ]),
  );
  expect(s).toEqual([]);
});

// ── The band-fed sources ────────────────────────────────────────────────────

test('with no band statistics no strength claims anything about other players', () => {
  const texts = topStrengths(ctx(clean(8))).map((s) => s.text).join(' ');
  expect(texts).not.toMatch(/\b\d+00s\b/);
  expect(texts).not.toContain('than most');
  // Positive control: strengths WERE produced, so the absence is about their
  // content and not about an empty list.
  expect(topStrengths(ctx(clean(8))).length).toBeGreaterThan(0);
});

test('POSITIVE CONTROL: with band statistics a pattern strength is produced and worded', () => {
  // The two band-fed sources of F-SW-2 are dead code until this passes. It is what
  // makes the "no claims about other players" test above a statement about the
  // absent DATA rather than about an absent mechanism.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 2 };
  const s = topStrengths(
    ctx(clean(12), { source, bucket: { floor: 800, name: '800s' }, comparisonsAllowed: true }),
  );
  const patterns = s.filter((x) => x.kind === 'pattern');
  expect(patterns.length).toBeGreaterThan(0);
  expect(patterns[0]?.text).toContain('most 800s');
  expect(patterns[0]?.evidence.typicalForBand).toBe(2);
});

test('band strengths obey F-SW-6s sample floor even when the statistics are there', () => {
  // Found by mutation: deleting the `comparisonsAllowed` guard from both band
  // sources broke nothing, because every test that set it false also used
  // NO_BAND_STATS and the source's own emptiness covered for the gate. A strength
  // shown under ten games would be the comparison F-SW-6 forbids, praising instead
  // of scolding. So: full statistics, sample floor closed.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 2 };
  const bucket = { floor: 800, name: '800s' };
  const closed = topStrengths(ctx(clean(12), { source, bucket, comparisonsAllowed: false }));
  expect(closed.filter((s) => s.kind === 'pattern')).toEqual([]);
  expect(closed.every((s) => !s.text.includes('800s'))).toBe(true);
  // Positive control: the same context with the floor open does produce them, so
  // the emptiness above is the gate and not the fixture.
  const open = topStrengths(ctx(clean(12), { source, bucket, comparisonsAllowed: true }));
  expect(open.filter((s) => s.kind === 'pattern').length).toBeGreaterThan(0);
});

test('a band phase strength outranks the self-relative one and replaces it', () => {
  // Otherwise the learner sees two sentences about the same phase, one of which is
  // the weaker version of the other.
  // A source with PHASE statistics only. Giving it pattern statistics too would
  // fill all three slots with rank-100 pattern strengths and this test would fail
  // for a reason that has nothing to do with what it is checking — which is
  // exactly what it did on the first run.
  const source: BandStatsSource = {
    hasData: true,
    typicalFor: (_b, metric) => (metric.startsWith('accuracy') ? 40 : null),
  };
  const specs: GameSpec[] = [
    {
      moves: [
        { accuracy: 90, phase: 'endgame' },
        { accuracy: 50, phase: 'middlegame' },
      ],
    },
  ];
  const s = topStrengths(
    ctx(specs, { source, bucket: { floor: 800, name: '800s' }, comparisonsAllowed: true }),
  );
  const phases = s.filter((x) => x.kind === 'phase');
  expect(phases.length).toBeGreaterThan(0);
  for (const p of phases) expect(p.text).not.toContain('not with other players');
});

test('a pattern is only a strength when it is clearly below the band, not merely below', () => {
  // A learner one per cent under the population median has not got a strength.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1.01 };
  const specs: GameSpec[] = Array.from({ length: 10 }, () => ({
    moves: [{ label: 'Mistake' as const, drop: 20 }],
    errors: [{ theme: 'hung_piece' as const, ply: 0 }],
  }));
  const s = topStrengths(
    ctx(specs, { source, bucket: { floor: 800, name: '800s' }, comparisonsAllowed: true }),
  );
  expect(s.filter((x) => x.id === 'band-hung_piece')).toEqual([]);
});

test('every strength carries evidence that could be checked', () => {
  const s = topStrengths(ctx(clean(9)));
  expect(s.length).toBeGreaterThan(0);
  for (const x of s) {
    expect(Object.keys(x.evidence).length, x.id).toBeGreaterThan(0);
    expect(x.text, x.id).toMatch(/\.$/);
    expect(x.text, x.id).not.toMatch(/undefined|NaN/);
  }
});

test('the order of strengths is stable', () => {
  const build = () => topStrengths(ctx(clean(8))).map((s) => s.id);
  expect(build()).toEqual(build());
});

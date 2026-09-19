import { applyMove } from '@/rules';
import { themeOf, errorsFrom, THEME_LESSON, TYPICAL_THEMES } from './errorLog';
import type { ReviewedMove } from './types';

function mv(o: Partial<ReviewedMove> & { ply: number; fenBefore: string }): ReviewedMove {
  // fenAfter defaults to the real position after the default move: themeOf
  // feeds it to the tagger, so a placeholder string would only ever measure the
  // tagger's error handling.
  const uci = o.uci ?? 'a2a3';
  return {
    san: 'a3',
    uci,
    fenAfter: o.fenAfter ?? after(o.fenBefore, uci),
    mover: 'w',
    best: { uci: 'e2e4', san: 'e4' },
    winBefore: 60,
    winAfterPlayed: 30,
    drop: 30,
    accuracy: 20,
    label: 'Blunder',
    book: false,
    phase: 'middlegame',
    ...o,
  };
}

/** fenAfter is never hand-written: the shipped rules module is the fact. */
function after(fen: string, uci: string): string {
  return applyMove(fen, uci).fen;
}

// White to move; Black's pawn on e5 is free to Nf3xe5.
const FREE_PAWN = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1';
// White to move; Ra8 is mate.
const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
// White to move; g6 already played, so Qh5 walks into gxh5.
const QUEEN_SORTIE = 'rnbqkbnr/pppp1p1p/6p1/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
// White to move; the d4 knight is attacked by e5 and cannot take (d6 defends).
const THREATENED_KNIGHT = '4k3/8/3p4/4p3/3N4/8/8/4K3 w - - 0 1';
// Bare kings: nothing the tagger can verify.
const QUIET = '8/8/4k3/8/8/4K3/8/8 w - - 0 1';

test('a move that leaves a piece free to take is tagged hung_piece', () => {
  expect(
    themeOf({
      fenBefore: QUEEN_SORTIE,
      fenAfter: after(QUEEN_SORTIE, 'd1h5'),
      playedUci: 'd1h5',
      bestUci: 'g1f3',
    }),
  ).toBe('hung_piece');
});

test('missing a free capture is tagged missed_capture', () => {
  expect(
    themeOf({
      fenBefore: FREE_PAWN,
      fenAfter: after(FREE_PAWN, 'a2a3'),
      playedUci: 'a2a3',
      bestUci: 'f3e5',
    }),
  ).toBe('missed_capture');
});

test('missing a mate in one is tagged missed_mate', () => {
  expect(
    themeOf({
      fenBefore: MATE_IN_ONE,
      fenAfter: after(MATE_IN_ONE, 'g1g2'),
      playedUci: 'g1g2',
      bestUci: 'a1a8',
    }),
  ).toBe('missed_mate');
});

test('a move that answers nothing while a threat stands is tagged ignored_threat', () => {
  expect(
    themeOf({
      fenBefore: THREATENED_KNIGHT,
      fenAfter: after(THREATENED_KNIGHT, 'e1e2'),
      playedUci: 'e1e2',
      bestUci: 'd4b5',
    }),
  ).toBe('ignored_threat');
});

test('an error the tagger cannot verify is unclassified, never guessed', () => {
  expect(
    themeOf({ fenBefore: QUIET, fenAfter: after(QUIET, 'e3d3'), playedUci: 'e3d3', bestUci: 'e3e4' }),
  ).toBe('unclassified');
});

test('only mistakes, misses and blunders reach the log', () => {
  const moves: ReviewedMove[] = [
    mv({ ply: 0, fenBefore: FREE_PAWN, label: 'Blunder' }),
    mv({ ply: 2, fenBefore: FREE_PAWN, label: 'Mistake' }),
    mv({ ply: 4, fenBefore: FREE_PAWN, label: 'Miss' }),
    mv({ ply: 6, fenBefore: FREE_PAWN, label: 'Inaccuracy' }),
    mv({ ply: 8, fenBefore: FREE_PAWN, label: 'Good' }),
    mv({ ply: 10, fenBefore: FREE_PAWN, label: 'Book', book: true }),
  ];
  const errs = errorsFrom(moves, { gameId: 'g1', learner: 'w', now: '2026-09-19T00:00:00.000Z' });
  expect(errs.map((e) => e.ply)).toEqual([0, 2, 4]);
});

test('the opponent’s errors are not the learner’s errors', () => {
  const moves: ReviewedMove[] = [
    mv({ ply: 0, fenBefore: FREE_PAWN, mover: 'w', label: 'Blunder' }),
    mv({ ply: 1, fenBefore: FREE_PAWN, mover: 'b', label: 'Blunder' }),
  ];
  const errs = errorsFrom(moves, { gameId: 'g1', learner: 'w', now: '2026-09-19T00:00:00.000Z' });
  expect(errs).toHaveLength(1);
  expect(errs[0]!.ply).toBe(0);
});

test('every entry carries the fields F-RV-6 asks for', () => {
  const errs = errorsFrom(
    [mv({ ply: 0, fenBefore: FREE_PAWN, fenAfter: after(FREE_PAWN, 'a2a3'), uci: 'a2a3', san: 'a3', best: { uci: 'f3e5', san: 'Nxe5' }, label: 'Blunder' })],
    { gameId: 'g1', learner: 'w', now: '2026-09-19T00:00:00.000Z' },
  );
  const e = errs[0]!;
  expect(e.gameId).toBe('g1');
  expect(e.theme).toBe('missed_capture');
  expect(e.phase).toEqual(expect.any(String));
  expect(e.clockMs).toBeNull(); // untimed
  expect(e.bestUci).toBe('f3e5');
  expect(e.bestSan).toBe('Nxe5');
  expect(typeof e.typical).toBe('boolean');
  expect(e.createdAt).toBe('2026-09-19T00:00:00.000Z');
});

test('clockMs is null even for a timed game, because no clock is persisted', () => {
  // There is no time control to pass any more: `clockMs` is null regardless of
  // it (spec §7.3), so the parameter was removed rather than left as a knob
  // that changes nothing.
  const errs = errorsFrom([mv({ ply: 0, fenBefore: FREE_PAWN, label: 'Blunder' })], {
    gameId: 'g1',
    learner: 'w',
    now: '2026-09-19T00:00:00.000Z',
  });
  expect(errs[0]!.clockMs).toBeNull();
});

test('a theme the curriculum teaches is typical; one it cannot classify is not', () => {
  // Driven through errorsFrom, not asserted about the constant: the flag on the
  // entry is what the fix-it drill reads.
  const classified = errorsFrom(
    [mv({ ply: 0, fenBefore: FREE_PAWN, fenAfter: after(FREE_PAWN, 'a2a3'), uci: 'a2a3', best: { uci: 'f3e5', san: 'Nxe5' }, label: 'Blunder' })],
    { gameId: 'g1', learner: 'w', now: 'now' },
  );
  expect(classified[0]!.theme).toBe('missed_capture');
  expect(classified[0]!.typical).toBe(true);

  const quiet = errorsFrom(
    [mv({ ply: 0, fenBefore: QUIET, fenAfter: after(QUIET, 'e3d3'), uci: 'e3d3', best: { uci: 'e3e4', san: 'Ke4' }, label: 'Blunder' })],
    { gameId: 'g1', learner: 'w', now: 'now' },
  );
  expect(quiet[0]!.theme).toBe('unclassified');
  expect(quiet[0]!.typical).toBe(false);
  expect(quiet[0]!.lessonId).toBeNull();
});

test('every typical theme maps to a lesson that exists in the curriculum', async () => {
  const { SECTION_1 } = await import('@/path/curriculum');
  const ids = new Set(SECTION_1.units.flatMap((u) => u.lessons.map((l) => l.id)));
  expect(TYPICAL_THEMES.length).toBeGreaterThan(0); // the sweep must have inputs
  for (const theme of TYPICAL_THEMES) {
    const lesson = THEME_LESSON[theme];
    expect(lesson, `theme ${theme} has no lesson`).toBeTruthy();
    expect(ids.has(lesson!), `lesson ${lesson} for theme ${theme} is not in the curriculum`).toBe(true);
  }
});

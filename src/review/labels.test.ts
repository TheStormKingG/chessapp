import { labelMove } from './labels';
import type { LabelInput } from './labels';

const base: LabelInput = {
  band: 1,
  drop: 0,
  playedIsBest: false,
  book: false,
  opponentPreviousWasBadMove: false,
  winBefore: 50,
  winAfterPlayed: 50,
  mateAllowed: false,
  moverWasMating: false,
  stillMating: false,
};

const at = (o: Partial<LabelInput>) => labelMove({ ...base, ...o });

test('band 1 boundaries are exactly Appendix C', () => {
  expect(at({ drop: 0 })).toBe('Best');
  expect(at({ drop: 0.04 })).toBe('Best');
  expect(at({ drop: 0.06 })).toBe('Excellent');
  expect(at({ drop: 2.9 })).toBe('Excellent');
  expect(at({ drop: 3 })).toBe('Good');
  expect(at({ drop: 7.9 })).toBe('Good');
  expect(at({ drop: 8 })).toBe('Inaccuracy');
  expect(at({ drop: 14.9 })).toBe('Inaccuracy');
  expect(at({ drop: 15 })).toBe('Mistake');
  expect(at({ drop: 24.9 })).toBe('Mistake');
  expect(at({ drop: 25 })).toBe('Blunder');
});

test('band 2 shares Appendix C’s Section 1 and 2 column, at the boundaries', () => {
  // Appendix C gives Sections 1 and 2 one column, so band 2 must land on the
  // same side of every boundary as band 1. Band 2 is otherwise never exercised
  // through labelMove, and an identity asserted only in bands.test.ts would not
  // catch a labelMove that read the wrong column.
  for (const drop of [0, 0.04, 0.06, 2.9, 3, 7.9, 8, 14.9, 15, 24.9, 25]) {
    expect(at({ band: 2, drop })).toBe(at({ band: 1, drop }));
  }
  expect(at({ band: 2, drop: 2.9 })).toBe('Excellent');
  expect(at({ band: 2, drop: 3 })).toBe('Good');
  expect(at({ band: 2, drop: 24.9 })).toBe('Mistake');
  expect(at({ band: 2, drop: 25 })).toBe('Blunder');
});

test('band 3 boundaries are exactly Appendix C', () => {
  expect(at({ band: 3, drop: 2.4 })).toBe('Excellent');
  expect(at({ band: 3, drop: 2.5 })).toBe('Good');
  expect(at({ band: 3, drop: 5.9 })).toBe('Good');
  expect(at({ band: 3, drop: 6 })).toBe('Inaccuracy');
  expect(at({ band: 3, drop: 11.9 })).toBe('Inaccuracy');
  expect(at({ band: 3, drop: 12 })).toBe('Mistake');
  expect(at({ band: 3, drop: 21.9 })).toBe('Mistake');
  expect(at({ band: 3, drop: 22 })).toBe('Blunder');
});

test('band 4 boundaries are exactly the PRD base column', () => {
  expect(at({ band: 4, drop: 1.9 })).toBe('Excellent');
  expect(at({ band: 4, drop: 2 })).toBe('Good');
  expect(at({ band: 4, drop: 4.9 })).toBe('Good');
  expect(at({ band: 4, drop: 5 })).toBe('Inaccuracy');
  expect(at({ band: 4, drop: 9.9 })).toBe('Inaccuracy');
  expect(at({ band: 4, drop: 10 })).toBe('Mistake');
  expect(at({ band: 4, drop: 19.9 })).toBe('Mistake');
  expect(at({ band: 4, drop: 20 })).toBe('Blunder');
});

test('a drop is never labelled worse in a lower band than in a higher one', () => {
  const rank = ['Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder'];
  for (let d = 0; d <= 30; d += 0.1) {
    const drop = Number(d.toFixed(2));
    const r1 = rank.indexOf(at({ band: 1, drop }));
    const r3 = rank.indexOf(at({ band: 3, drop }));
    const r4 = rank.indexOf(at({ band: 4, drop }));
    expect(r1).toBeLessThanOrEqual(r3);
    expect(r3).toBeLessThanOrEqual(r4);
  }
});

test('playing the engine move is Best whatever the arithmetic says', () => {
  expect(at({ drop: 0.4, playedIsBest: true })).toBe('Best');
});

test('Book beats every numeric label', () => {
  expect(at({ drop: 40, book: true })).toBe('Book');
  expect(at({ drop: 0, book: true })).toBe('Book');
});

test('Miss replaces Mistake and Blunder, and nothing better', () => {
  expect(at({ drop: 16, opponentPreviousWasBadMove: true })).toBe('Miss');
  expect(at({ drop: 30, opponentPreviousWasBadMove: true })).toBe('Miss');
  expect(at({ drop: 9, opponentPreviousWasBadMove: true })).toBe('Inaccuracy');
  expect(at({ drop: 1, opponentPreviousWasBadMove: true })).toBe('Excellent');
});

test('Miss does not apply to a book move', () => {
  expect(at({ drop: 30, book: true, opponentPreviousWasBadMove: true })).toBe('Book');
});

test('allowing a forced mate is a Blunder even when the numeric drop is small', () => {
  // Already bad but not hopeless: win% 30 down to 0 is a 30-point drop anyway,
  // so the interesting case is the one where the curve clamps and the drop
  // understates it.
  expect(at({ drop: 8, winBefore: 55, winAfterPlayed: 0, mateAllowed: true })).toBe('Blunder');
});

test('allowing mate from an already hopeless position uses the numeric band', () => {
  expect(at({ drop: 8, winBefore: 12, winAfterPlayed: 0, mateAllowed: true })).toBe('Inaccuracy');
  expect(at({ drop: 2, winBefore: 5, winAfterPlayed: 0, mateAllowed: true })).toBe('Excellent');
});

test('delaying a mate you already had carries no penalty', () => {
  expect(at({ drop: 12, moverWasMating: true, stillMating: true })).toBe('Best');
});

test('losing a mate you had is judged normally', () => {
  expect(at({ drop: 30, moverWasMating: true, stillMating: false })).toBe('Blunder');
});

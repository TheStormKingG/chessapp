import { labelMove, upgradeKeyMoment } from './labels';
import { BRILLIANT_MAX_WIN_BEFORE } from './bands';
import type { LabelInput, UpgradeInput } from './labels';

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

const up: UpgradeInput = {
  band: 1,
  label: 'Best',
  winBefore: 50,
  secondWin: null,
  materialSacrificed: 0,
  materialRegained: 0,
};

const upg = (o: Partial<UpgradeInput>) => upgradeKeyMoment({ ...up, ...o });

test('Great: the only move that avoided a mistake', () => {
  // Band 1's Mistake floor is 15. Second-best loses 16 points, so the played
  // move was the only one that did not blunder the position.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 44 })).toBe('Great');
});

test('not Great when a second move was nearly as good', () => {
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 52 })).toBe('Best');
});

test('not Great when there was no second move at all', () => {
  // A forced move is not a find. secondWin null means one legal move.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: null })).toBe('Best');
});

test('not Great when the played move was not best', () => {
  expect(upg({ label: 'Good', winBefore: 60, secondWin: 40 })).toBe('Good');
});

test('Brilliant: a sound sacrifice from a position that was not already winning', () => {
  expect(
    upg({ label: 'Best', winBefore: 55, secondWin: 50, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Brilliant');
});

test('not Brilliant when the material comes straight back', () => {
  expect(
    upg({ label: 'Best', winBefore: 55, secondWin: 50, materialSacrificed: 3, materialRegained: 3 }),
  ).toBe('Best');
});

test('not Brilliant from an already clearly winning position', () => {
  expect(
    upg({ label: 'Best', winBefore: 90, secondWin: 50, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Great');
});

test('not Brilliant when the move was only Good', () => {
  expect(
    upg({ label: 'Good', winBefore: 55, secondWin: 50, materialSacrificed: 5, materialRegained: 0 }),
  ).toBe('Good');
});

test('Brilliant outranks Great when both apply', () => {
  expect(
    upg({ label: 'Best', winBefore: 55, secondWin: 30, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Brilliant');
});

test('a Book move is never upgraded', () => {
  expect(
    upg({ label: 'Book', winBefore: 55, secondWin: 20, materialSacrificed: 3, materialRegained: 0 }),
  ).toBe('Book');
});

test('a second-best move that is merely an inaccuracy does not make the played move Great', () => {
  // Appendix C: Great is "the only move that keeps the evaluation from dropping
  // by a mistake or more". Band 1's Mistake floor is 15 (a drop of 8 to 14.9 is
  // an Inaccuracy). A second-best that drops 10 is an inaccuracy, not a
  // mistake, so the played move was not the only move.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 50 })).toBe('Best');
});

test('Great turns on the band’s Mistake floor exactly, not the Blunder floor', () => {
  // The discriminating band. Band 1: a second-best drop of 15 is the first drop
  // Appendix C calls a Mistake, and 25 is where Blunder starts. A rule keyed to
  // the Blunder floor agrees with every fixture below 15 and above 25, so the
  // two candidate thresholds can only be told apart in between.
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 45.1 })).toBe('Best'); // drop 14.9
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 45 })).toBe('Great'); // drop 15
  expect(upg({ label: 'Best', winBefore: 60, secondWin: 36 })).toBe('Great'); // drop 24
  // Band 4's Mistake floor is 10, so the same drop is Great one band lower.
  expect(upg({ band: 4, label: 'Best', winBefore: 60, secondWin: 50.1 })).toBe('Best'); // drop 9.9
  expect(upg({ band: 4, label: 'Best', winBefore: 60, secondWin: 50 })).toBe('Great'); // drop 10
});

test('Brilliant turns on BRILLIANT_MAX_WIN_BEFORE exactly', () => {
  // "Not already clearly winning" has no number in the PRD; design spec 9.3
  // fixes it at win per cent 80 (+376 cp on the shipped curve). The boundary is
  // exclusive, so 80 itself is already clearly winning.
  const sac = { label: 'Best', secondWin: 50, materialSacrificed: 3, materialRegained: 0 } as const;
  expect(upg({ ...sac, winBefore: 79.9 })).toBe('Brilliant');
  expect(upg({ ...sac, winBefore: BRILLIANT_MAX_WIN_BEFORE })).toBe('Great');
});

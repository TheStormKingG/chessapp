import { BOARD_TOKENS, FALLBACK_PALETTE } from '@/board/boardColors';
import { ACHIEVEMENTS, achievementsFrom, type Achievement } from './achievements';
import {
  COSMETICS,
  COSMETIC_TOKENS,
  PIECE_RULE_MIN,
  cosmeticTokensAreBoardTokens,
  isUnlocked,
  overridesFor,
  paletteWith,
  pieceRule,
  pieceRuleHolds,
  unlockedCosmetics,
  type CosmeticTheme,
} from './cosmetics';

const boards = COSMETICS.filter((c) => c.kind === 'board');
const pieces = COSMETICS.filter((c) => c.kind === 'pieces');

function withUnlocked(ids: readonly string[]): Achievement[] {
  return achievementsFrom({ events: [], bestStreakDays: 0 }).map((a) => ({
    ...a,
    unlocked: ids.includes(a.id),
  }));
}

/* ------------------------------------- "never anything that affects learning" */

test('a cosmetic can only set board colours, and nothing else exists to set', () => {
  // The structural half of F-EN-6's rule: the vocabulary a cosmetic is written in
  // contains no word for difficulty, hints, the engine or the path.
  expect([...COSMETIC_TOKENS]).toEqual(['--board-light', '--board-dark', '--piece-light', '--piece-dark']);
  expect(cosmeticTokensAreBoardTokens()).toBe(true);
  for (const c of COSMETICS) {
    for (const key of Object.keys(c.overrides)) {
      expect(COSMETIC_TOKENS as readonly string[], `${c.id} sets ${key}`).toContain(key);
    }
  }
});

test('no cosmetic touches the board marks, which carry meaning', () => {
  // `--mark-good` and `--mark-review` are board tokens and are deliberately NOT
  // cosmetic tokens: they say "this square is good" and "look at this square".
  for (const token of ['--mark-good', '--mark-review'] as const) {
    expect(BOARD_TOKENS as readonly string[]).toContain(token);
    expect(COSMETIC_TOKENS as readonly string[]).not.toContain(token);
  }
  // Positive control for the second assertion: a token that IS cosmetic is found
  // by the same check, so "not contained" is not a broken comparison.
  expect(COSMETIC_TOKENS as readonly string[]).toContain('--board-light');
});

test('applying every cosmetic leaves every non-cosmetic board token untouched', () => {
  const all = paletteWith(COSMETICS);
  for (const token of BOARD_TOKENS) {
    if ((COSMETIC_TOKENS as readonly string[]).includes(token)) continue;
    expect(all[token], token).toBe(FALLBACK_PALETTE[token]);
  }
  // And the cosmetic ones DID move, so the loop above is not comparing a palette
  // nothing changed.
  expect(all['--board-dark']).not.toBe(FALLBACK_PALETTE['--board-dark']);
});

/* -------------------------- an unreadable board is a change to learning */

test("every board and piece-set COMBINATION clears DESIGN-SYSTEM §3.1's piece rule", () => {
  expect(boards.length).toBeGreaterThan(1);
  expect(pieces.length).toBeGreaterThan(1);
  let combinations = 0;
  for (const board of boards) {
    for (const pieceSet of pieces) {
      const r = pieceRule([board, pieceSet]);
      combinations += 1;
      // FOUR rows, not the eight in §3.1's table: that table has two appearances
      // and this app ships one (`board/boardColors.ts`: "There is ONE
      // appearance"). Two piece colours times two squares is the whole space.
      expect(r.measurements).toHaveLength(4);
      for (const m of r.measurements) {
        expect(
          m.best,
          `${board.id} + ${pieceSet.id}: ${m.piece} piece on ${m.square} square measured ${m.best.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(PIECE_RULE_MIN);
      }
      expect(r.ok).toBe(true);
    }
  }
  // Each theme checked against the default alone would be `boards.length +
  // pieces.length` checks; the pair is what renders, so the count is the product.
  expect(combinations).toBe(boards.length * pieces.length);
});

test('the piece rule really can fail, so passing it is a measurement and not a tautology', () => {
  // The negative control the assertions above need. Without it, a `pieceRule`
  // that returned ok for everything would satisfy every test in this file.
  const invisible: CosmeticTheme = {
    id: 'test-invisible',
    name: 'Invisible',
    kind: 'pieces',
    unlock: null,
    // Both piece colours equal to the light square: fill 1:1 there, and the
    // outline is the same colour, so max(fill, outline) is 1:1 too.
    overrides: { '--piece-light': '#E9E1D2', '--piece-dark': '#E9E1D2' },
  };
  const r = pieceRule([invisible]);
  expect(r.ok).toBe(false);
  expect(pieceRuleHolds([invisible])).toBe(false);
  expect(Math.min(...r.measurements.map((m) => m.best))).toBeLessThan(PIECE_RULE_MIN);
});

test('square-to-square contrast is reported and stays in the range §3.1 argues for', () => {
  // §3.1: the default is 2.71:1 and "a physical tournament board is about 2:1";
  // pushing the squares higher "would make the board vibrate". So this is a
  // sanity band on a cosmetic, not a WCAG gate.
  for (const board of boards) {
    const r = pieceRule([board]);
    expect(r.squareToSquare, board.id).toBeGreaterThan(1.8);
    expect(r.squareToSquare, board.id).toBeLessThan(4.5);
  }
});

/* --------------------------------------------------- unlocking (F-EN-6) */

test('one board and one piece set are available from the start', () => {
  const free = COSMETICS.filter((c) => c.unlock === null);
  expect(free.filter((c) => c.kind === 'board')).toHaveLength(1);
  expect(free.filter((c) => c.kind === 'pieces')).toHaveLength(1);
  expect(unlockedCosmetics({ achievements: [], questCredits: 0 }).map((c) => c.id)).toEqual(free.map((c) => c.id));
});

test('an achievement-gated cosmetic is locked until that achievement is unlocked', () => {
  const gated = COSMETICS.filter((c) => c.unlock !== null && 'achievement' in c.unlock);
  expect(gated.length).toBeGreaterThan(0);
  for (const c of gated) {
    const id = c.unlock !== null && 'achievement' in c.unlock ? c.unlock.achievement : null;
    expect(id).not.toBeNull();
    expect(isUnlocked(c, { achievements: withUnlocked([]), questCredits: 0 }), c.id).toBe(false);
    expect(isUnlocked(c, { achievements: withUnlocked(id === null ? [] : [id]), questCredits: 0 }), c.id).toBe(true);
  }
});

test('every achievement a cosmetic names exists, and is not one of the blocked ones', () => {
  // A cosmetic gated on an achievement that can never unlock is a cosmetic
  // nobody can ever hold, which is indistinguishable from a typo.
  for (const c of COSMETICS) {
    if (c.unlock === null || !('achievement' in c.unlock)) continue;
    const needed = c.unlock.achievement;
    const def = ACHIEVEMENTS.find((a) => a.id === needed);
    expect(def, `${c.id} names an achievement that does not exist`).toBeDefined();
    expect(def?.blocked, `${c.id} is gated on a blocked achievement`).toBeNull();
  }
});

test('a credit-gated cosmetic unlocks at its threshold and not one credit earlier', () => {
  const gated = COSMETICS.filter((c) => c.unlock !== null && 'questCredits' in c.unlock);
  expect(gated.length).toBeGreaterThan(0);
  for (const c of gated) {
    const need = c.unlock !== null && 'questCredits' in c.unlock ? c.unlock.questCredits : 0;
    expect(need).toBeGreaterThan(0);
    expect(isUnlocked(c, { achievements: [], questCredits: need - 1 }), c.id).toBe(false);
    expect(isUnlocked(c, { achievements: [], questCredits: need }), c.id).toBe(true);
  }
});

test('an unlocked achievement that is not the one named does not unlock the cosmetic', () => {
  const moss = COSMETICS.find((c) => c.id === 'board-moss');
  expect(moss).toBeDefined();
  if (!moss) return;
  expect(isUnlocked(moss, { achievements: withUnlocked(['first-checkpoint']), questCredits: 0 })).toBe(false);
  expect(isUnlocked(moss, { achievements: withUnlocked(['full-section']), questCredits: 0 })).toBe(true);
});

/* --------------------------------------------------------------- applying */

test('the chosen board and pieces merge into one set of overrides', () => {
  const board = boards.find((c) => c.id === 'board-walnut');
  const pieceSet = pieces.find((c) => c.id === 'pieces-ivory');
  expect(board && pieceSet).toBeTruthy();
  if (!board || !pieceSet) return;
  const o = overridesFor([board, pieceSet]);
  expect(o['--board-dark']).toBe(board.overrides['--board-dark']);
  expect(o['--piece-dark']).toBe(pieceSet.overrides['--piece-dark']);
  expect(Object.keys(o).sort()).toEqual(['--board-dark', '--board-light', '--piece-dark', '--piece-light']);
});

test('choosing the default entries produces no overrides at all', () => {
  const defaults = COSMETICS.filter((c) => c.unlock === null);
  expect(overridesFor(defaults)).toEqual({});
  expect(paletteWith(defaults)).toEqual(FALLBACK_PALETTE);
});

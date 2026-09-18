import {
  BOARD_TOKENS,
  FALLBACK_PALETTE,
  contrastRatio,
  pickReadable,
  resolveBoardPalette,
  toRgb,
  withAlpha,
  type BoardPalette,
} from './boardColors';

const round = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------- the measurement itself */

test('contrastRatio reproduces the WCAG reference pairs', () => {
  expect(round(contrastRatio('#000000', '#ffffff'))).toBe(21);
  expect(round(contrastRatio('#777777', '#ffffff'))).toBe(4.48);
  expect(round(contrastRatio('#ffffff', '#ffffff'))).toBe(1);
  // order does not matter
  expect(contrastRatio('#0B3D2E', '#E9E1D2')).toBeCloseTo(contrastRatio('#E9E1D2', '#0B3D2E'));
});

test('toRgb reads hex, short hex and rgb()', () => {
  expect(toRgb('#E9E1D2')).toEqual([233, 225, 210]);
  expect(toRgb('#fff')).toEqual([255, 255, 255]);
  expect(toRgb('rgb(87, 79, 66)')).toEqual([87, 79, 66]);
  expect(toRgb('rgba(11, 61, 46, 0.35)')).toEqual([11, 61, 46]);
  expect(toRgb('not-a-colour')).toBeNull();
  expect(toRgb('')).toBeNull();
});

test('withAlpha keeps the channels and adds the alpha', () => {
  expect(withAlpha('#0B3D2E', 0.35)).toBe('rgba(11, 61, 46, 0.35)');
});

/* ------------------------------------------- DESIGN-SYSTEM.md 3.1 tables */

// These are the design lead's own measured figures, re-derived in
// NEUMORPHIC-DELTA.md 5 against the new ground. If a token moves, this test
// fails and the document's table is what has to be re-derived -- which is the
// point: the numbers are not allowed to drift silently.
test('the board marks clear 3:1 on BOTH squares', () => {
  const p = FALLBACK_PALETTE;
  for (const mark of ['--mark-good', '--mark-review'] as const) {
    for (const square of ['--board-light', '--board-dark'] as const) {
      expect(round(contrastRatio(p[mark], p[square])), `${mark} on ${square}`).toBeGreaterThanOrEqual(3);
    }
  }
});

test('the mark ratios match the document table exactly', () => {
  const p = FALLBACK_PALETTE;
  expect(round(contrastRatio(p['--mark-good'], p['--board-light']))).toBe(9.39);
  expect(round(contrastRatio(p['--mark-good'], p['--board-dark']))).toBe(3.46);
  expect(round(contrastRatio(p['--mark-review'], p['--board-light']))).toBe(9.15);
  expect(round(contrastRatio(p['--mark-review'], p['--board-dark']))).toBe(3.37);
});

// DESIGN-SYSTEM.md 3.1: "Every piece is drawn with a fill and a 1.5px outline
// in the opposing piece colour. For every piece-on-square combination,
// max(fill contrast, outline contrast) must be at least 3:1."
//
// NEUMORPHIC-DELTA.md 5: these four ratios (eight, counting fill and outline
// separately) are internal to the board, so re-grounding the PAGE cannot move
// them. Re-measured after the re-grounding, they are identical to the figures
// the previous two passes recorded -- which is the finding, not an omission.
test('max(fill, outline) clears 3:1 for all four piece-on-square combinations', () => {
  const p = FALLBACK_PALETTE;
  for (const piece of ['--piece-light', '--piece-dark'] as const) {
    const outline = piece === '--piece-light' ? p['--piece-dark'] : p['--piece-light'];
    for (const square of ['--board-light', '--board-dark'] as const) {
      const best = Math.max(contrastRatio(p[piece], p[square]), contrastRatio(outline, p[square]));
      expect(round(best), `${piece} on ${square}`).toBeGreaterThanOrEqual(3);
    }
  }
});

test('the eight piece-on-square figures match the document table exactly', () => {
  const p = FALLBACK_PALETTE;
  const r = (a: string, b: string) => round(contrastRatio(a, b));
  // light piece: fill on each square, then its opposing outline
  expect(r(p['--piece-light'], p['--board-light'])).toBe(1.24);
  expect(r(p['--piece-dark'], p['--board-light'])).toBe(13.58);
  expect(r(p['--piece-light'], p['--board-dark'])).toBe(3.38);
  expect(r(p['--piece-dark'], p['--board-dark'])).toBe(5);
});

// The library's hardcoded #000000 stroke used to fail dark-piece-on-dark-square
// in the DARK appearance (fill 2.21 / outline 2.60), which is why `Board.tsx`
// shipped its own stroke rule there. With one appearance that combination does
// not exist, so the override is gone; this test is the record of the ONE
// combination the library default has to clear now, and it does.
test('the library default stroke is not load-bearing in the one appearance', () => {
  const p = FALLBACK_PALETTE;
  expect(round(contrastRatio(p['--piece-dark'], p['--board-dark']))).toBe(5);
  expect(round(contrastRatio('#000000', p['--board-dark']))).toBe(5.95);
});

test('square-to-square contrast is the documented exemption, not an accident', () => {
  // DESIGN-SYSTEM.md 3.1 argues this down from 3:1 explicitly. Asserting the
  // measured value keeps a later "fix" from silently raising it.
  expect(round(contrastRatio(FALLBACK_PALETTE['--board-light'], FALLBACK_PALETTE['--board-dark']))).toBe(2.71);
});

// NEUMORPHIC-DELTA.md 5: the board is the one warm object on a cool ground and
// is deliberately not re-hued, which costs it a visible outer boundary. The
// figure is asserted so the cost is on the record rather than discovered later,
// and so a later pass cannot "fix" it with the well that Δ1 rule 4 forbids.
test('the light square has no boundary against the ground, and that is on the record', () => {
  const p = FALLBACK_PALETTE;
  expect(round(contrastRatio(p['--board-light'], p['--surface']))).toBe(1.03);
  expect(round(contrastRatio(p['--board-dark'], p['--surface']))).toBe(2.79);
});

/* ------------------------------------------------------------- square ink */

// C-2, after C1: the rank and file glyphs have left the squares for the gutter
// rail, and `showNotation` is off, so react-chessboard's wooden-board defaults
// -- #B58863 (2.47:1) and #F0D9B5 (1.88:1) -- can no longer render at all.
// `pickReadable` still governs the one thing the board draws on a square in its
// own ink, the keyboard cursor's outline, so the per-square pick is asserted
// here unchanged.
test('the leaked wooden-board notation colours are not in the palette', () => {
  const leaked = ['#b58863', '#f0d9b5'];
  const values = Object.values(FALLBACK_PALETTE).map((v) => v.toLowerCase());
  for (const bad of leaked) expect(values).not.toContain(bad);
});

test('the ink the board draws on a square clears 4.5:1 on both', () => {
  const p = FALLBACK_PALETTE;
  for (const square of ['--board-light', '--board-dark'] as const) {
    const ink = pickReadable([p['--content'], p['--surface']], p[square]);
    expect(round(contrastRatio(ink, p[square])), `board ink on ${square}`).toBeGreaterThanOrEqual(4.5);
  }
});

// The negative control, and the reason NEUMORPHIC-DELTA.md 5 says the board
// forced --content's value rather than the other way round. The reference's own
// body slate, rgb(51,65,85), is the obvious --content for a page grounded in
// preqal.org, and it FAILS as board ink on --board-dark at 2.94:1. The next
// step down, #1E293B, also fails at 4.15:1. Only the reference's heading slate
// clears it. Without this test the shipped value looks like a free choice.
test('the reference body slate fails as board ink, which is why --content is the heading slate', () => {
  const p = FALLBACK_PALETTE;
  expect(p['--content']).toBe('#0F172B');
  expect(round(contrastRatio('#334155', p['--board-dark']))).toBe(2.94);
  expect(round(contrastRatio('#1E293B', p['--board-dark']))).toBe(4.15);
  expect(round(contrastRatio(p['--content'], p['--board-dark']))).toBe(5.06);
  expect(round(contrastRatio(p['--content'], p['--board-light']))).toBe(13.73);
  // and the pick lands on --content on both squares, so no light ink is needed
  expect(pickReadable([p['--content'], p['--surface']], p['--board-dark'])).toBe(p['--content']);
  expect(pickReadable([p['--content'], p['--surface']], p['--board-light'])).toBe(p['--content']);
});

test('pickReadable returns the higher-contrast candidate, either way round', () => {
  expect(pickReadable(['#000000', '#ffffff'], '#111111')).toBe('#ffffff');
  expect(pickReadable(['#000000', '#ffffff'], '#eeeeee')).toBe('#000000');
  expect(pickReadable(['#123456'], '#123456')).toBe('#123456');
});

/* -------------------------------------------------------------- resolution */

test('every token resolves to a parseable colour', () => {
  const p: BoardPalette = resolveBoardPalette();
  for (const token of BOARD_TOKENS) expect(toRgb(p[token]), token).not.toBeNull();
});

test('an undefined custom property falls back to the document value', () => {
  // jsdom defines none of them, so every unit test in the suite measures the
  // FALLBACK_PALETTE table. It has to mirror `theme.css` exactly or the suite
  // stays green while measuring a palette the app no longer ships.
  expect(resolveBoardPalette()['--board-dark']).toBe('#94876F');
  expect(resolveBoardPalette()['--surface']).toBe('#E0E5EC');
  expect(resolveBoardPalette()['--content']).toBe('#0F172B');
});

test('a defined custom property wins over the fallback', () => {
  document.documentElement.style.setProperty('--board-dark', '#010203');
  try {
    expect(resolveBoardPalette()['--board-dark']).toBe('#010203');
  } finally {
    document.documentElement.style.removeProperty('--board-dark');
  }
});

test('red is off the board: no board token is the old danger red', () => {
  const values = Object.values(FALLBACK_PALETTE).map((v) => v.toLowerCase());
  expect(values).not.toContain('#a23b3b');
});

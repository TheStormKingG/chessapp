import {
  BOARD_TOKENS,
  FALLBACK_PALETTE,
  contrastRatio,
  pickReadable,
  resolveBoardPalette,
  toRgb,
  withAlpha,
  type Appearance,
  type BoardPalette,
} from './boardColors';

const APPEARANCES: Appearance[] = ['light', 'dark'];
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

// These are the design lead's own measured figures. If a token moves, this
// test fails and the document's table is what has to be re-derived -- which is
// the point: the numbers are not allowed to drift silently.
test.each(APPEARANCES)('%s: the board marks clear 3:1 on BOTH squares', (appearance) => {
  const p = FALLBACK_PALETTE[appearance];
  for (const mark of ['--mark-good', '--mark-review'] as const) {
    for (const square of ['--board-light', '--board-dark'] as const) {
      expect(
        round(contrastRatio(p[mark], p[square])),
        `${mark} on ${square} in the ${appearance} appearance`,
      ).toBeGreaterThanOrEqual(3);
    }
  }
});

test('the mark ratios match the document table exactly', () => {
  const l = FALLBACK_PALETTE.light;
  const d = FALLBACK_PALETTE.dark;
  expect(round(contrastRatio(l['--mark-good'], l['--board-light']))).toBe(9.39);
  expect(round(contrastRatio(l['--mark-good'], l['--board-dark']))).toBe(3.46);
  expect(round(contrastRatio(l['--mark-review'], l['--board-light']))).toBe(9.15);
  expect(round(contrastRatio(l['--mark-review'], l['--board-dark']))).toBe(3.37);
  expect(round(contrastRatio(d['--mark-good'], d['--board-light']))).toBe(3.23);
  expect(round(contrastRatio(d['--mark-good'], d['--board-dark']))).toBe(6.55);
  expect(round(contrastRatio(d['--mark-review'], d['--board-light']))).toBe(3.05);
  expect(round(contrastRatio(d['--mark-review'], d['--board-dark']))).toBe(6.19);
});

// DESIGN-SYSTEM.md 3.1: "Every piece is drawn with a fill and a 1.5px outline
// in the opposing piece colour. For every piece-on-square combination,
// max(fill contrast, outline contrast) must be at least 3:1."
test.each(APPEARANCES)(
  '%s: max(fill, outline) clears 3:1 for all four piece-on-square combinations',
  (appearance) => {
    const p = FALLBACK_PALETTE[appearance];
    for (const piece of ['--piece-light', '--piece-dark'] as const) {
      const outline = piece === '--piece-light' ? p['--piece-dark'] : p['--piece-light'];
      for (const square of ['--board-light', '--board-dark'] as const) {
        const best = Math.max(
          contrastRatio(p[piece], p[square]),
          contrastRatio(outline, p[square]),
        );
        expect(round(best), `${piece} on ${square} in the ${appearance} appearance`).toBeGreaterThanOrEqual(3);
      }
    }
  },
);

// The one combination that forced the outline override in Board.tsx: with
// react-chessboard's hardcoded #000000 stroke, a dark piece on the dark square
// in the dark appearance measures fill 2.21 / outline 2.60 and FAILS. This test
// is the record of why the board ships its own stroke rule there.
test('the library default black stroke fails dark-piece-on-dark-square in dark', () => {
  const d = FALLBACK_PALETTE.dark;
  expect(round(contrastRatio(d['--piece-dark'], d['--board-dark']))).toBe(2.21);
  expect(round(contrastRatio('#000000', d['--board-dark']))).toBe(2.6);
  // ...and the opposing-colour outline the board substitutes does clear it.
  expect(round(contrastRatio(d['--piece-light'], d['--board-dark']))).toBe(7.41);
});

test('square-to-square contrast is the documented exemption, not an accident', () => {
  // DESIGN-SYSTEM.md 3.1 argues this down from 3:1 explicitly. Asserting the
  // measured values keeps a later "fix" from silently raising them.
  expect(round(contrastRatio(FALLBACK_PALETTE.light['--board-light'], FALLBACK_PALETTE.light['--board-dark']))).toBe(2.71);
  expect(round(contrastRatio(FALLBACK_PALETTE.dark['--board-light'], FALLBACK_PALETTE.dark['--board-dark']))).toBe(2.03);
});

/* ------------------------------------------------------------- square ink */

// C-2, after C1: the rank and file glyphs have left the squares for the gutter
// rail, and `showNotation` is off, so react-chessboard's wooden-board defaults
// -- #B58863 (2.47:1) and #F0D9B5 (1.88:1) -- can no longer render at all.
// `pickReadable` still governs the one thing the board draws on a square in its
// own ink, the keyboard cursor's outline, so the per-square pick is asserted
// here unchanged. Keeping the leaked hexes out of the palette stays a test
// because a later chunk could reinstate notation without reading this comment.
test('the leaked wooden-board notation colours are not in any palette', () => {
  const leaked = ['#b58863', '#f0d9b5'];
  for (const appearance of APPEARANCES) {
    const values = Object.values(FALLBACK_PALETTE[appearance]).map((v) => v.toLowerCase());
    for (const bad of leaked) expect(values).not.toContain(bad);
  }
});

test.each(APPEARANCES)('%s: the ink the board draws on a square clears 4.5:1 on both', (appearance) => {
  const p = FALLBACK_PALETTE[appearance];
  for (const square of ['--board-light', '--board-dark'] as const) {
    const ink = pickReadable([p['--content'], p['--surface']], p[square]);
    expect(
      round(contrastRatio(ink, p[square])),
      `board ink on ${square} in the ${appearance} appearance`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('a single fixed ink cannot serve both appearances -- which is why it is picked per square', () => {
  // The negative control for pickReadable: --content alone, the obvious choice,
  // fails on the light square in the dark appearance at 3.34:1. Without this
  // the per-square pick looks like unnecessary machinery.
  //
  // PREMIUM-DELTA.md Δ1 deepened the dark ground from #121514 to #0E1110, so
  // the ink the pick lands on -- --surface, not --content -- is darker and the
  // measured ratio rises from 4.62:1 to 4.77:1. The mechanism is unchanged; the
  // figure is re-derived rather than relaxed, because the point of asserting it
  // exactly is that a token change is never allowed to move it silently.
  const d = FALLBACK_PALETTE.dark;
  expect(round(contrastRatio(d['--content'], d['--board-light']))).toBe(3.34);
  expect(pickReadable([d['--content'], d['--surface']], d['--board-light'])).toBe(d['--surface']);
  expect(round(contrastRatio(pickReadable([d['--content'], d['--surface']], d['--board-light']), d['--board-light']))).toBe(4.77);
});

test('pickReadable returns the higher-contrast candidate, either way round', () => {
  expect(pickReadable(['#000000', '#ffffff'], '#111111')).toBe('#ffffff');
  expect(pickReadable(['#000000', '#ffffff'], '#eeeeee')).toBe('#000000');
  expect(pickReadable(['#123456'], '#123456')).toBe('#123456');
});

/* -------------------------------------------------------------- resolution */

test('every token resolves to a parseable colour in both appearances', () => {
  for (const appearance of APPEARANCES) {
    const p: BoardPalette = resolveBoardPalette(appearance);
    for (const token of BOARD_TOKENS) expect(toRgb(p[token]), `${token} (${appearance})`).not.toBeNull();
  }
});

test('an undefined custom property falls back to the document value for that appearance', () => {
  // jsdom defines none of them, so this is the pre-A1 state: the board must
  // still be correct in both appearances rather than silently using one.
  expect(resolveBoardPalette('dark')['--board-dark']).toBe('#574F42');
  expect(resolveBoardPalette('light')['--board-dark']).toBe('#94876F');
});

test('a defined custom property wins over the fallback', () => {
  document.documentElement.style.setProperty('--board-dark', '#010203');
  try {
    expect(resolveBoardPalette('light')['--board-dark']).toBe('#010203');
  } finally {
    document.documentElement.style.removeProperty('--board-dark');
  }
});

test('red is off the board: no board token is the old danger red', () => {
  for (const appearance of APPEARANCES) {
    const values = Object.values(FALLBACK_PALETTE[appearance]).map((v) => v.toLowerCase());
    expect(values).not.toContain('#a23b3b');
  }
});

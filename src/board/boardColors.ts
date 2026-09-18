/**
 * A3: every colour the board paints is a token from `theme.css`, resolved at
 * render time rather than written as a literal in a component.
 *
 * Why resolve rather than emit `var(--board-light)` inline: the board hands
 * colours to `react-chessboard`, which puts some of them on SVG presentation
 * attributes (`stroke` on an arrow path). `var()` is not substituted there, and
 * the audit helpers read those attributes back. Resolving once per appearance
 * gives every consumer -- inline style, SVG attribute, Playwright probe -- the
 * same concrete value.
 *
 * DESIGN-SYSTEM.md 3.1 is the authority for the board values; PREMIUM-DELTA.md
 * Δ1 re-grounds `--surface` (#F4F2ED -> #EAE5DA light, #121514 -> #0E1110 dark),
 * and this table mirrors `theme.css` exactly so the jsdom measurements are
 * measurements of the shipping palette. The fallbacks below
 * exist only so the board is correct in both appearances before chunk A1 lands
 * the tokens; once `theme.css` defines them, the computed value always wins.
 */

export const BOARD_TOKENS = [
  '--board-light',
  '--board-dark',
  '--piece-light',
  '--piece-dark',
  '--mark-good',
  '--mark-review',
  '--content',
  '--surface',
] as const;

export type BoardToken = (typeof BOARD_TOKENS)[number];
export type BoardPalette = Record<BoardToken, string>;
export type Appearance = 'light' | 'dark';

/** DESIGN-SYSTEM.md 3.1, verbatim. Used only when the token is not defined. */
export const FALLBACK_PALETTE: Record<Appearance, BoardPalette> = {
  light: {
    '--board-light': '#E9E1D2',
    '--board-dark': '#94876F',
    '--piece-light': '#FBFAF7',
    '--piece-dark': '#17191A',
    '--mark-good': '#0B3D2E',
    '--mark-review': '#4A3306',
    '--content': '#1A1D1B',
    '--surface': '#EAE5DA',
  },
  dark: {
    '--board-light': '#8A7E6C',
    '--board-dark': '#574F42',
    '--piece-light': '#F7F5F0',
    '--piece-dark': '#16181A',
    '--mark-good': '#B6F5D8',
    '--mark-review': '#F7DFAC',
    '--content': '#E9ECE9',
    '--surface': '#0E1110',
  },
};

/* ------------------------------------------------------------- measurement */

function channel(v: number): number {
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Parses `#rgb`, `#rrggbb` or `rgb()/rgba()` into 0-255 triples. */
export function toRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)?.[1];
  if (hex) {
    const h = hex.length === 3 ? [...hex].map((d) => d + d).join('') : hex;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return [r ?? 0, g ?? 0, b ?? 0];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(c)?.[1];
  if (fn) {
    const [r, g, b] = fn.split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if ([r, g, b].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return [r as number, g as number, b as number];
    }
  }
  return null;
}

export function relativeLuminance(color: string): number {
  const rgb = toRgb(color);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => channel(v / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The candidate that contrasts most with `bg`.
 *
 * Board glyphs and the keyboard cursor sit on a square whose lightness flips
 * between the two appearances: `--board-light` is a pale stone in the light
 * appearance and a mid stone in the dark one. A single fixed ink therefore
 * cannot clear 4.5:1 on both squares in both appearances -- `--content` on
 * `--board-light` measures 13.08:1 light but only 3.34:1 dark. Picking per
 * square keeps all four combinations above 4.5:1 without hardcoding which
 * token wins where, so the rule survives a token revision.
 */
export function pickReadable(candidates: string[], bg: string): string {
  return candidates.reduce((best, c) =>
    contrastRatio(c, bg) > contrastRatio(best, bg) ? c : best,
  );
}

/** `#rrggbb` plus an alpha, as an `rgba()` string. Non-hex input is returned as-is. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = toRgb(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
}

/* ------------------------------------------------------------- resolution */

export function currentAppearance(): Appearance {
  return typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Reads the board tokens off the document, falling back per appearance. */
export function resolveBoardPalette(appearance = currentAppearance()): BoardPalette {
  const fallback = FALLBACK_PALETTE[appearance];
  if (typeof document === 'undefined') return { ...fallback };
  const computed = getComputedStyle(document.documentElement);
  const out = {} as BoardPalette;
  for (const token of BOARD_TOKENS) {
    const value = computed.getPropertyValue(token).trim();
    out[token] = toRgb(value) ? value : fallback[token];
  }
  return out;
}

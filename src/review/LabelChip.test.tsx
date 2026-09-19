import { render, screen } from '@testing-library/react';
import { LabelChip } from './LabelChip';
import { LABEL_GLYPH, TONE } from './labelStyle';
import type { MoveLabel } from './types';

const ALL: MoveLabel[] = [
  'Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
];

test('every label has a glyph, and the set is the complete label set', () => {
  expect(ALL).toHaveLength(10); // lower bound: the sweep has inputs
  for (const l of ALL) expect(LABEL_GLYPH[l], `${l} has no glyph`).toBeTruthy();
  expect(Object.keys(LABEL_GLYPH).sort()).toEqual([...ALL].sort());
});

test('the glyphs are distinct, so the second channel actually discriminates', () => {
  expect(new Set(Object.values(LABEL_GLYPH)).size).toBe(ALL.length);
});

test('the accessible name is the label word, never the glyph', () => {
  for (const l of ALL) {
    const { unmount } = render(<LabelChip label={l} />);
    expect(screen.getByText(l)).toBeInTheDocument();
    unmount();
  }
});

test('the glyph is hidden from assistive technology', () => {
  render(<LabelChip label="Blunder" />);
  const glyph = screen.getByText(LABEL_GLYPH.Blunder, { ignore: 'script' });
  expect(glyph).toHaveAttribute('aria-hidden', 'true');
});

test('colour is never the only channel — the word is always rendered', () => {
  render(<LabelChip label="Mistake" />);
  // The word is present in the DOM, not conveyed by a class alone.
  expect(screen.getByText('Mistake')).toBeVisible();
});

// The tone classes must resolve to a real Tailwind colour utility. `--mark-good`
// and `--mark-review` are BOARD tokens: they are not in theme.css's `@theme
// inline` block, so `text-mark-good` would generate nothing and a label would
// carry no colour at all — which none of the tests above can see, because the
// word and the glyph would still be there. This pins the tones to tokens the
// theme actually exports.
test('every tone is a colour utility the theme actually generates', () => {
  const EXPORTED = ['accent', 'content', 'content-dim', 'signal', 'danger'];
  for (const l of ALL) {
    const tone = TONE[l];
    expect(tone.startsWith('text-'), `${l}: ${tone}`).toBe(true);
    expect(EXPORTED, `${l} uses ${tone}`).toContain(tone.slice('text-'.length));
  }
});

import type { MoveLabel } from './types';

/**
 * PRD F-RV-2: "All icons and colours are the product's own design."
 *
 * Three channels per label: the WORD (always rendered, and the accessible
 * name), a distinct GLYPH (aria-hidden), and one of the semantic colour tokens
 * the app already has. No new colour tokens: eight new hues would be eight new
 * obligations for tests/audit-platform/controls.spec.ts's contrast sweep and
 * would buy nothing the word and the glyph do not already carry.
 * Design spec section 5.4.
 *
 * These live in their own module rather than beside the component because
 * eslint's `react-refresh/only-export-components` is fatal here
 * (`--max-warnings 0`) and a .tsx file may export components only.
 */

export const LABEL_GLYPH: Record<MoveLabel, string> = {
  Brilliant: '!!',
  Great: '!',
  Best: '★',
  Excellent: '◆',
  Good: '✓',
  Book: '▤',
  Inaccuracy: '?!',
  Mistake: '?',
  Miss: '⊘',
  Blunder: '??',
};

/**
 * DEVIATION from the plan's draft, which named `text-mark-good` and
 * `text-mark-review`. `--mark-good` and `--mark-review` are BOARD tokens: they
 * are declared in theme.css but deliberately left out of its `@theme inline`
 * block, so Tailwind generates no `text-mark-*` utility and those class names
 * would resolve to nothing — a label with no colour at all, which the word and
 * the glyph would hide from every other test. Their contrast is also measured
 * against the board squares, not against `--surface`.
 *
 * These five are the off-board semantic tokens the theme does export, and are
 * the same ones CoachBubble uses for the same purpose.
 */
export const TONE: Record<MoveLabel, string> = {
  Brilliant: 'text-accent',
  Great: 'text-accent',
  Best: 'text-accent',
  Excellent: 'text-accent',
  Good: 'text-content',
  Book: 'text-content-dim',
  Inaccuracy: 'text-signal',
  Mistake: 'text-signal',
  Miss: 'text-danger',
  Blunder: 'text-danger',
};

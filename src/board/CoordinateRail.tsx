import type { ReactNode } from 'react';
import { RAIL_REM, RAIL_TYPE } from './rail';

/**
 * C1 -- the coordinate rail. DESIGN-SYSTEM.md §4 is the authority.
 *
 * One mono, full-contrast index column, in the gutter rather than on the
 * content, repeated at the same x-position on every surface: the ranks 8 to 1
 * beside a board, the unit numbers beside the path, the challenge index beside
 * a lesson. Rank-and-file indexing is chess's own wayfinding, so the thing that
 * orients a learner inside a position is the same thing that orients them
 * inside the app.
 *
 * Three properties are load bearing and every consumer inherits them from here
 * rather than restating them, so the rail cannot drift apart between surfaces:
 *
 *   - `--font-index` at `index-small` (12px / 16px, weight 600, +0.04em,
 *     tabular numerals). 12px clears the 11pt floor in
 *     `typography.md > Ensuring legibility`, and 600 answers the same page's
 *     "in general, avoid light font weights" for small text.
 *   - `--content` at full contrast, on the page ground. Measured against
 *     `--surface`: 15.19:1 light, 15.43:1 dark (DESIGN-SYSTEM.md §3.1). This is
 *     the structural half of the C-2 fix -- the glyphs leave the squares, where
 *     no ink clears 4.5:1 on all four square-and-appearance combinations, for a
 *     gutter where nothing can sit behind them.
 *   - `RAIL_REM` wide: 1rem, which is exactly the compact page gutter every
 *     board surface is already inset by, so the rail costs the board no width.
 *     `branding.md > Best practices`: "Ensure branding always defers to
 *     content."
 *
 * The rail is decoration to assistive technology and is `aria-hidden`
 * throughout. It is a second, visual channel onto information the accessible
 * layer already carries in full: a board square is announced by
 * `describeSquare`, and a path node carries its unit number in its accessible
 * name. Exposing the rail as well would say every coordinate twice.
 */

/**
 * The board's rank column and file row. `items` are already in reading order;
 * each cell is an eighth of the board's own extent, so a glyph lines up with
 * the centre of its rank or file at any board size.
 */
export function CoordinateRail({
  axis,
  items,
}: {
  axis: 'rank' | 'file';
  items: string[];
}) {
  const rank = axis === 'rank';
  return (
    <div
      aria-hidden="true"
      data-rail={axis}
      className={`grid select-none text-content ${RAIL_TYPE}`}
      style={
        rank
          ? { gridTemplateRows: `repeat(${String(items.length)}, 1fr)`, width: `${String(RAIL_REM)}rem` }
          : { gridTemplateColumns: `repeat(${String(items.length)}, 1fr)`, height: `${String(RAIL_REM)}rem` }
      }
    >
      {items.map((i) => (
        <span key={i} className="flex items-center justify-center">
          {i}
        </span>
      ))}
    </div>
  );
}

/**
 * One rail cell for a list surface: the path's unit numbers today, the lesson's
 * challenge index when chunk C1's other half lands.
 *
 * A list index is wider than a single rank glyph -- "1.1.2" is five characters
 * -- so the rail is sized in `ch` of the same mono face rather than at
 * `RAIL_REM`. What is identical across surfaces is what makes the rail read as
 * one thing: the face, the size, the ink, and the left edge it starts at.
 */
export function RailIndex({
  children,
  tone = 'inherit',
}: {
  children: ReactNode;
  /**
   * `inherit` is the default on purpose. A list row often sets its own ink --
   * a completed node is filled in `--accent` and reads in `--accent-on` -- and
   * a rail that hardcoded `--content` would be the one element on the row
   * below 4.5:1. Full contrast is the rule; which token delivers it belongs to
   * the row, exactly as `pickReadable` picks the board's ink per square.
   */
  tone?: 'full' | 'dim' | 'inherit';
}) {
  const ink = tone === 'dim' ? 'text-content-dim' : tone === 'full' ? 'text-content' : '';
  return (
    <span
      aria-hidden="true"
      data-rail="index"
      className={`w-[5ch] shrink-0 select-none ${RAIL_TYPE} ${ink}`}
    >
      {children}
    </span>
  );
}

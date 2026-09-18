import type { ReactNode } from 'react';
import { RAIL_REM, RAIL_TYPE, railMeterPercent } from './rail';

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
   * a checkpoint that is due reads in `--signal` on its own tint -- and a rail
   * that hardcoded `--content` would be the one element on the row
   * below 4.5:1. Full contrast is the rule; which token delivers it belongs to
   * the row, exactly as `pickReadable` picks the board's ink per square.
   *
   * `accent` is the completed state (PREMIUM-DELTA.md Δ3): a finished unit's
   * rail segment is filled in `--accent`, which measures 5.90:1 light and
   * 8.69:1 dark on `--surface` and 7.10:1 / 7.48:1 on `--surface-raised`, so
   * the fill is a body-text-legal ink rather than a decoration. It is never
   * the only channel -- the row also carries weight 600 and a `✓`.
   */
  tone?: 'full' | 'dim' | 'accent' | 'inherit';
}) {
  const ink =
    tone === 'dim'
      ? 'text-content-dim'
      : tone === 'full'
        ? 'text-content'
        : tone === 'accent'
          ? 'text-accent'
          : '';
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

/**
 * The progress meter, PREMIUM-DELTA.md Δ3 -- and deliberately *not* a progress
 * bar under a heading.
 *
 * A horizontal bar would have introduced a second progress language beside the
 * coordinate rail, which is the design's signature. Instead the meter is a
 * state of the rail: it runs vertically, in the rail's own gutter column, at
 * the same x and the same `RAIL_REM` width as the board's rank index, and it
 * fills from the bottom up exactly as the ranks count upward from 1. The thing
 * that tells a learner where they are in the app is the same object that tells
 * them where they are on the board.
 *
 * Three properties it inherits or owes:
 *
 *   - `--track` is the groove: `#cfd6e0`, **1.16:1** below `--surface` on the
 *     one ground the app now ships (NEUMORPHIC-DELTA.md §3.5; the two-appearance
 *     figures this comment used to carry were re-derived, not copied). A groove,
 *     not a border -- it is never the sole separator of anything, so it carries
 *     no contrast duty of its own. Chunk N3 gives it `n-inset-soft` as well, so
 *     it is cut into the page rather than tinted on top of it: at 1.16:1 the
 *     tint alone is close to invisible, and the shadow pair is what actually
 *     makes the unfilled part of the meter read as empty.
 *   - The fill is `--accent` `#12614a`, measured on `--track` at **5.06:1**,
 *     clear of the 3:1 non-text requirement with margin.
 *   - **Nothing is conveyed by colour alone.** The meter is `aria-hidden`
 *     decoration over a count the caller renders as real text beside it
 *     ("3 of 8 done"), which is what a screen reader reads and what survives a
 *     forced-colours or monochrome rendering. `railMeterLabel` builds that
 *     string so the bar and the sentence can never disagree.
 *
 * Nothing here animates: the fill is a static height, so there is no motion to
 * answer for under `prefers-reduced-motion`.
 */
export function RailMeter({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const pct = railMeterPercent(done, total);
  return (
    <div
      aria-hidden="true"
      data-rail="meter"
      data-fill={String(pct)}
      className={`flex shrink-0 justify-center ${className ?? ''}`}
      style={{ width: `${String(RAIL_REM)}rem` }}
    >
      {/*
        One character wide, like a single rank glyph. `1ch` of --font-index is
        the rail's own measure, so the groove is exactly as wide as the numbers
        that sit above it on a board surface.

        Bounded and sticky, both found by looking at the rendered page rather
        than at the code. A groove stretched to a 29-lesson list is 1418px tall
        on a 390px phone, so a fill anchored to its bottom -- which is what
        "fills upward" means -- starts life below the fold and is invisible
        until the learner scrolls to the end of the list, which is the one place
        they do not need it. Sixteen rem is a rank-index-sized object that fits
        any viewport, and `sticky` keeps it beside whatever part of the list is
        on screen. In `rem`, so it grows with the system text size.
      */}
      <div
        className={`n-inset-soft sticky top-4 h-64 w-[1ch] self-start overflow-hidden rounded-full bg-track ${RAIL_TYPE}`}
      >
        <div className="absolute inset-x-0 bottom-0 bg-accent" style={{ height: `${String(pct)}%` }} />
      </div>
    </div>
  );
}

/**
 * The tab bar's symbols (DESIGN-SYSTEM.md chunk B2, H-2).
 *
 * One family, drawn here rather than pulled from an icon set, because the set
 * is five glyphs and the shapes are the ones the design document already writes
 * in its wireframes: ▣ Today, ◈ Path, ◉ Puzzles, a piece for Play, ▤ Progress.
 * Three primitives — square, diamond, circle — plus a pawn and a bar chart, all
 * on one 24-unit grid at one stroke weight, so the row reads as a set.
 *
 * `tab-bars.md > Best practices`: "Prefer filled symbols or icons for
 * consistency with the platform" and "Include tab labels to help with
 * navigation" — so the active tab is the filled variant and every tab keeps its
 * text label. The label is the accessible name; the symbol is decoration on top
 * of it and is `aria-hidden`, which is also why nothing here is the sole
 * carrier of which tab is current (weight, colour, the filled symbol and
 * `aria-current` all say it).
 *
 * Inactive is stroked at 1.6 on a 24-unit grid rendered at 22px — about 1.5px,
 * matching the stem of the 12px label beside it. Active is filled, matching the
 * semibold label. Vector only; never an emoji (hard constraint 8).
 */
export type TabSymbol = 'today' | 'path' | 'puzzles' | 'play' | 'progress';

/**
 * Outer shape plus an optional inner shape knocked out of it. With
 * `fill-rule: evenodd` the inner subpath is a hole when the glyph is filled and
 * a second outline when it is not, which is how one path gives both states
 * without any internal detail disappearing into the fill.
 */
const PATHS: Record<TabSymbol, string> = {
  // ▣ a board square with its centre marked: the day's cell.
  today: 'M4 4h16v16H4V4Z M9 9h6v6H9V9Z',
  // ◈ a diamond, stepped: the unit you are on.
  path: 'M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z M12 8 16 12l-4 4-4-4 4-4Z',
  // ◉ a target: the puzzle to solve.
  puzzles: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  // A pawn: the only tab where a piece actually moves.
  play: 'M12 3.2a3.3 3.3 0 0 1 2.1 5.85c1.05 1.2 1.6 2.65 1.8 4.45H8.1c.2-1.8.75-3.25 1.8-4.45A3.3 3.3 0 0 1 12 3.2Z M6 15.2h12V21H6v-5.8Z',
  // ▤ the record, rising.
  progress: 'M4 14h4v7H4v-7Z M10 9h4v12h-4V9Z M16 4h4v17h-4V4Z',
};

export function TabIcon({ name, active }: { name: TabSymbol; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      fill={active ? 'currentColor' : 'none'}
      fillRule="evenodd"
      clipRule="evenodd"
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.6}
      strokeLinejoin="miter"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The coordinate rail's shared constants, in a module of their own so both the
 * board's rails and any list surface's `RailIndex` read the same numbers.
 * The rail's design rationale lives in `CoordinateRail.tsx`.
 */

/**
 * The rail's width, in rem. Matches the `p-4` gutter every board surface uses,
 * which is what lets the board keep its full width on a 390px phone.
 */
export const RAIL_REM = 1;

/** `index-small` from DESIGN-SYSTEM.md §3.2, in one place. */
export const RAIL_TYPE =
  'font-index text-[0.75rem] font-semibold leading-4 tracking-[0.04em] tabular-nums';

const FILES = 'abcdefgh';
const RANKS = '12345678';

/** Ranks as the player sees them, top to bottom. */
export function railRanks(orientation: 'w' | 'b'): string[] {
  const top = [...RANKS].reverse();
  return orientation === 'w' ? top : [...RANKS];
}

/** Files as the player sees them, left to right. */
export function railFiles(orientation: 'w' | 'b'): string[] {
  const left = [...FILES];
  return orientation === 'w' ? left : left.reverse();
}

/* --------------------------------------------------- the rail's fill state */

/**
 * The progress meter's fill, clamped, as a whole percentage.
 *
 * PREMIUM-DELTA.md Δ3 puts progress *in* the rail rather than in a bar beside
 * it, so the arithmetic lives here with the rail's other shared numbers: the
 * component draws it, the Path counts it, and neither owns the rule.
 * A total of zero is an empty rail rather than a division by zero.
 */
export function railMeterPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(Math.max(done, 0), total) / total) * 100);
}

/**
 * The count the meter is only the second channel for.
 *
 * It leads with the numbers because PREMIUM-DELTA.md §2.2's one borrowable
 * idea is that progress is a count, stated before it is decorated -- and
 * because a meter that said nothing in words would be conveying its state by
 * colour and height alone.
 */
export function railMeterLabel(done: number, total: number): string {
  return `${String(done)} of ${String(total)} done`;
}

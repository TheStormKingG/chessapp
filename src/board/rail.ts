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

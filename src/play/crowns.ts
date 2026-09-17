/**
 * Crowns for a finished game (PRD F-PL-4): three with no hints or take-backs,
 * two with one to three, one with four or more. The three branches partition
 * the whole non-negative range, so the last one is reachable.
 */
export function crowns(s: { hints: number; takebacks: number }): 1 | 2 | 3 {
  const n = s.hints + s.takebacks;
  if (n === 0) return 3;
  if (n <= 3) return 2;
  return 1;
}

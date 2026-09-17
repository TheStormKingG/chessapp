/**
 * Star rating for a completed lesson (PRD 7.3):
 * three for a clean run (no hints, at most one miss), two when hints were used
 * or a second miss happened, one for merely completing it.
 */
export function stars(s: { hints: number; misses: number }): 1 | 2 | 3 {
  if (s.hints === 0 && s.misses <= 1) return 3;
  if (s.misses <= 2 && (s.hints > 0 || s.misses === 2)) return 2;
  return 1;
}

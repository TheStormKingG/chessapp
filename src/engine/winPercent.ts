import type { Score } from './uci';

/** Lichess published curve, PRD 10.6. Centipawns from the side to move's view. */
export function toWinPercent(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function scoreToWinPercent(s: Score): number {
  if ('mate' in s) return s.mate > 0 ? 100 : 0;
  return toWinPercent(s.cp);
}

/** PRD 10.6 per-move accuracy from the drop in win per cent. */
export function moveAccuracy(winDrop: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, winDrop)) - 3.1669));
}

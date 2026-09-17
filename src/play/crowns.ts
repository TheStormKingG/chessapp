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

export type GameResult = 'win' | 'loss' | 'draw';

/**
 * How the crowns read at the end of a game. Crowns grade the help used, never the result
 * (PRD F-PL-4), so every finished game earns them; on a loss or a draw they are reported as
 * "played without help" rather than celebrated, and the result line leads.
 */
export function crownsNote(result: GameResult, n: 1 | 2 | 3): string {
  if (result === 'win') return n === 3 ? 'Three crowns: no hints, no take-backs.' : `${n} of 3 crowns for the help used.`;
  if (n === 3) return 'Played without help: three crowns.';
  return `Played with some help: ${n} of 3 crowns.`;
}

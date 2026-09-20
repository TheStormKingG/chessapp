import type { Theme } from './types';

/**
 * The eight themes PRD Appendix B assigns to Sections 1 and 2.
 *
 * Names and definitions are the Lichess theme list (CC0, PRD Appendix D).
 * Ordered by Appendix B's median puzzle rating, easiest first, so any UI that
 * lists them is ordered by difficulty without needing a second table.
 */
export const THEMES: readonly Theme[] = [
  'backRankMate',    // 859
  'mateIn1',         // 927
  'smotheredMate',   // 978
  'attackingF2F7',   // 1121
  'mateIn2',         // 1126
  'skewer',          // 1303
  'fork',            // 1325
  'discoveredAttack',// 1453
] as const;

/** The Lichess dump's own tag for each theme, for the pipeline's filter. */
export const LICHESS_TAG: Record<Theme, string> = {
  backRankMate: 'backRankMate',
  mateIn1: 'mateIn1',
  smotheredMate: 'smotheredMate',
  mateIn2: 'mateIn2',
  attackingF2F7: 'attackingF2F7',
  skewer: 'skewer',
  fork: 'fork',
  discoveredAttack: 'discoveredAttack',
};

export const THEME_LABEL: Record<Theme, string> = {
  backRankMate: 'Back-rank mate',
  mateIn1: 'Mate in one',
  smotheredMate: 'Smothered mate',
  mateIn2: 'Mate in two',
  attackingF2F7: 'Attacking f2 or f7',
  skewer: 'Skewer',
  fork: 'Fork',
  discoveredAttack: 'Discovered attack',
};

export const THEME_DEFINITION: Record<Theme, string> = {
  backRankMate: 'Mate the king on its own back rank, trapped behind its own pawns.',
  mateIn1: 'Find the single move that delivers checkmate.',
  smotheredMate: 'A knight mates a king hemmed in entirely by its own pieces.',
  mateIn2: 'Force checkmate in two moves, whatever the defence plays.',
  attackingF2F7: 'Strike at f2 or f7, the square each king alone defends at the start.',
  skewer: 'Attack two pieces on a line so the valuable one must move and expose the other.',
  fork: 'Attack two pieces at once with a single piece.',
  discoveredAttack: 'Move one piece out of the way so the piece behind it attacks.',
};

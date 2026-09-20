/**
 * The puzzles feature's public surface (PRD 8.4, design spec §§3-5).
 *
 * Everything outside `src/puzzles` imports from here. Modules inside it import
 * each other directly — a barrel that a module re-enters through is a cycle,
 * and the one that bit the review feature took an afternoon to find.
 *
 * `THEMES`, `THEME_LABEL` and `THEME_DEFINITION` are exported because the
 * lesson close screen names a motif (F-PZ-2 d) and the licences screen cites
 * the CC0 theme list. `parsePack` and `loadPack` are exported because the
 * routes fetch a band; `__resetPacks` is deliberately NOT, because it is a test
 * seam and the application has no business calling it.
 */

export { PuzzlePlayer } from './PuzzlePlayer';
export { PuzzlesScreen } from '@/screens/PuzzlesScreen';
export { ThemedPractice } from './ThemedPractice';
export { DailyPuzzle } from './DailyPuzzle';

export { DAILY_ATTEMPTS, dailyIndex, localDateKey } from './daily';
export { explainPuzzle } from './explainPuzzle';
export { buildQueue, type FixDrill, type LessonLink, type Queue } from './queue';
export { pickNext, windowFor, type Pick } from './select';
export { initial, reduce, result, type SessionState } from './session';
export { nextRating } from './rating';
export { findByRating, loadPack, parsePack } from './packs';
export { THEMES, THEME_DEFINITION, THEME_LABEL } from './themes';

export type {
  AttemptResult,
  Puzzle,
  PuzzleRating,
  PuzzleSource,
  RatingBand,
  Theme,
} from './types';

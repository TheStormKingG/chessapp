/**
 * The puzzles feature's public surface (PRD 8.4, design spec §§3-5).
 *
 * Everything outside `src/puzzles` imports from here. Modules inside it import
 * each other directly — a barrel that a module re-enters through is a cycle,
 * and the one that bit the review feature took an afternoon to find.
 *
 * `THEMES`, `THEME_LABEL` and `THEME_DEFINITION` are exported because the
 * lesson close screen names a motif (F-PZ-2 d). They are ChessApp's own
 * wording, not Lichess's, so the licences screen has nothing to say about
 * them; what it does list is the puzzle DATABASE the packs are derived from.
 * `parsePack` and `loadPack` are exported because the
 * routes fetch a band; `__resetPacks` is deliberately NOT, because it is a test
 * seam and the application has no business calling it.
 */

export { PuzzlePlayer } from './PuzzlePlayer';
export { PuzzleStream } from './PuzzleStream';
/*
  The puzzles home — the tab — which with the four solving routes is the ONLY
  part of this feature that reads Dexie and the network. Everything they render
  takes plain props, which is what keeps the screens testable without a
  database.

  The four SOLVING routes are deliberately NOT re-exported here. They live in
  `./PuzzleRoutes`, which `src/app/routes.tsx` reaches through `React.lazy` so
  that a learner who never opens a puzzle never downloads them. Naming them
  here would put them on the static graph of every importer of this barrel and
  quietly undo the split — a re-export is an import.
*/
export { PuzzlesHomeRoute } from './PuzzlesHomeRoute';
export { PuzzlesScreen } from '@/screens/PuzzlesScreen';
export { ThemedPractice } from './ThemedPractice';
export { DailyPuzzle } from './DailyPuzzle';
export { FixMyMistakes } from './FixMyMistakes';

export { DAILY_ATTEMPTS, dailyIndex, localDateKey } from './daily';
export { explainPuzzle } from './explainPuzzle';
export { buildQueue, type FixDrill, type LessonLink, type Queue } from './queue';
export { pickNext, windowFor, type Pick } from './select';
export { initial, reduce, result, type SessionState } from './session';
export { nextRating } from './rating';
export { bandFor, findByRating, loadPack, parsePack } from './packs';
export { THEMES, THEME_DEFINITION, THEME_LABEL } from './themes';

export type {
  AttemptResult,
  Puzzle,
  PuzzleRating,
  PuzzleSource,
  RatingBand,
  Theme,
} from './types';

export * from './band';
export * from './schedule';
export * from './choose';
export * from './verify';
export * from './ownPositions';
export * from './tailoredLesson';
export * from './practiceSet';
export * from './targetedGame';
export * from './closeOut';
export * from './seed';
export * from './store';
export * from './buildSession';
export * from './useTailoredSession';
export { TailoredSessionScreen } from './TailoredSessionScreen';

/*
 * The screen is exported BY NAME, for the reason src/profile/index.ts gives: a barrel
 * that star-exports a .tsx module re-exports its non-component exports too, and
 * `react-refresh/only-export-components` is fatal here (`--max-warnings 0`).
 *
 * `testReviews.ts` is deliberately NOT exported. It builds synthetic reviews for the
 * tests, and a barrel export is one import away from a screen rendering invented chess
 * at a learner.
 */

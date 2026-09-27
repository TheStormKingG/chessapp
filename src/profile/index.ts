export * from './types';
export * from './sampleSize';
export * from './recency';
export * from './cost';
export * from './bandStats';
export * from './themes';
export * from './metrics';
export * from './skills';
export * from './strengths';
export * from './weaknesses';
export * from './whatChanged';
export * from './buildProfile';
export * from './games';
export * from './exportProfile';
export * from './download';
export * from './seen';
export * from './useProfile';
export { ProfileView } from './ProfileView';

/*
 * Components are exported BY NAME, not with `export *`, for the reason
 * src/review/index.ts and src/import/index.ts both give: a barrel that
 * star-exports a .tsx module re-exports its non-component exports too, and
 * `react-refresh/only-export-components` is fatal here (`--max-warnings 0`).
 *
 * `testGames.ts` is deliberately NOT exported. It builds synthetic reviews for the
 * tests, and a barrel export is one import away from a screen rendering invented
 * chess at a learner.
 */

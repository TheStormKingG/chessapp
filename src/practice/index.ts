export * from './drills';
export * from './results';
export { PracticeScreen } from './PracticeScreen';
export { PracticeHomeRoute } from './PracticeHomeRoute';

/*
 * `DrillsScreen`, `DrillRoute` and the vision trainer are deliberately NOT
 * exported here. They are the LAZY half of this feature (src/app/routes.tsx), and
 * a barrel that re-exported them would put the drill list, the lesson loader and
 * chess.js back on the shell's first-paint graph the moment anything imported
 * `@/practice` — which the Practice tab does. src/puzzles/index.ts stops
 * re-exporting its four solving routes for exactly this reason.
 *
 * Components are exported BY NAME rather than with `export *` because a barrel
 * that star-exports a .tsx module re-exports its non-component exports too, and
 * `react-refresh/only-export-components` is fatal under `--max-warnings 0`.
 */

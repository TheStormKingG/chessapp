/**
 * Every screen the accessibility sweep visits, and the single list that says so.
 *
 * WHY A LIST AND NOT A CRAWL. A crawler finds the screens a learner can reach by
 * clicking, which is not the same set: several of these are reachable only by
 * deep link, and one (`/licences`) is a legal obligation that no flow leads to.
 * A list is also the only shape a coverage guard can check -- see
 * `src/app/screenSweep.test.ts`, which reads `routes.tsx` and fails when a route
 * is added without being added here. A sweep that quietly stops covering a new
 * screen is the failure mode F-AX-5 is about.
 *
 * `param` screens are listed with a real value rather than being skipped. A
 * screen that only renders with an id is still a screen.
 */
export interface Screen {
  /** The URL to visit, relative, since the e2e build uses `--base=/`. */
  path: string;
  /** What must be on the page before axe runs, so the sweep never audits a spinner. */
  ready: string;
  /**
   * Set when this screen cannot be audited as-is, with the reason. Never a
   * convenience: a skip is a hole in F-AX-5 and has to be argued for.
   */
  skip?: string;
}

export const SCREENS: Screen[] = [
  { path: './', ready: 'h1' },
  { path: './path', ready: 'h1' },
  { path: './practice', ready: 'h1' },
  { path: './practice/drills', ready: 'h1' },
  { path: './practice/vision', ready: 'h1' },
  { path: './puzzles', ready: 'h1' },
  { path: './play', ready: 'h1' },
  { path: './progress', ready: 'h1' },
  { path: './import', ready: 'h1' },
  { path: './play/review', ready: 'h1' },
  { path: './settings', ready: 'h1' },
  { path: './licences', ready: 'h1' },
  // A real unit, so the guidebook renders rather than showing its not-found
  // state. 1.1 is the first unit of Section 1 and is built.
  { path: './guidebook/1.1', ready: 'h1' },
  // The not-found screen is a screen. It is easy to leave out of a11y work
  // precisely because nobody designs it.
  { path: './no-such-page', ready: 'h1' },

  // ── The modal tasks ────────────────────────────────────────────────────────
  //
  // These are not shell screens and several take a parameter, which is why an
  // a11y pass is easy to leave them out of. A learner spends most of their time
  // in them, so leaving them out would make "every screen" mean "every screen
  // that was easy". Real parameters, and real ids from the built curriculum.
  { path: './lesson/1.1.1', ready: 'h1, [role="application"]' },
  { path: './checkpoint/1.1', ready: 'h1, [role="application"]' },
  { path: './tailored', ready: 'h1' },
  { path: './puzzles/rated', ready: 'h1, [role="application"]' },
  { path: './puzzles/themed', ready: 'h1' },
  { path: './puzzles/daily', ready: 'h1, [role="application"]' },
  { path: './puzzles/fix', ready: 'h1' },
  { path: './onboarding', ready: 'h1' },
];

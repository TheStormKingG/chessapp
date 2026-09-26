import { FIRST_PATH_UNIT } from './placement';
import type { LearnerLevel } from './types';

/**
 * F-ON-2: what each level answer means for where the learner goes next.
 *
 * > "The second screen asks the learner's level with four options mapped to a
 * > starting point on the path: new to chess (Section 1, unit 1), I know the
 * > rules (Section 2 after a short check), I play casually (placement test), I
 * > play online already (import my games, F-IM-5, with the placement test as
 * > the fallback when there are fewer than ten games)."
 */
export type Destination =
  /** Straight onto the path at `unit`, with no assessment. */
  | { kind: 'path'; unit: string }
  /** F-ON-5's five-challenge rules check. */
  | { kind: 'rules-check' }
  /** F-ON-5's adaptive placement test. */
  | { kind: 'placement' }
  /** F-IM-5's game import. Not built; see the seam below. */
  | { kind: 'import' };

/** F-IM-5 / F-ON-2: import is used only from ten games up. */
export const IMPORT_MIN_GAMES = 10;

/**
 * ─── THE IMPORT SEAM (F-IM-5) ───────────────────────────────────────────────
 *
 * `importableGames` is how many of the learner's online games import could
 * actually read. `null` means "this build cannot ask", which is the state today:
 * nothing in `src/` implements F-IM-5, there is no provider to query and no
 * screen to send the learner to.
 *
 * F-ON-2 already specifies what to do in that case — "with the placement test
 * as the fallback when there are fewer than ten games" — so the fallback is
 * taken, and it is taken through the SAME expression that will one day take the
 * import branch. This is the only place in the feature that decides between
 * import and placement. When F-IM-5 lands it passes a real count here and the
 * `'import'` branch opens; nothing else in onboarding has to change, and
 * `route.test.ts` already exercises that branch with a count so it is not code
 * that has never run.
 *
 * The parameter defaults to `null` so every current caller takes the fallback
 * without having to know why.
 */
export function levelDestination(level: LearnerLevel, importableGames: number | null = null): Destination {
  switch (level) {
    case 'new':
      return { kind: 'path', unit: FIRST_PATH_UNIT };
    case 'know_rules':
      return { kind: 'rules-check' };
    case 'casual':
      return { kind: 'placement' };
    case 'plays_online':
      return importableGames !== null && importableGames >= IMPORT_MIN_GAMES
        ? { kind: 'import' }
        : { kind: 'placement' };
  }
}

/** The route a destination is reached at. */
export function destinationPath(d: Destination): string {
  switch (d.kind) {
    case 'rules-check':
    case 'placement':
      return '/onboarding/placement';
    case 'import':
      // Unreachable while `levelDestination` is called without a game count. It
      // is written rather than thrown so the seam is one function call wide:
      // F-IM-5 replaces this string and nothing else.
      return '/onboarding/import';
    case 'path':
      return '/';
  }
}

/** Whether a level answer owes the learner an assessment it has not had yet. */
export function needsAssessment(level: LearnerLevel | null): boolean {
  if (!level) return false;
  const kind = levelDestination(level).kind;
  return kind === 'rules-check' || kind === 'placement';
}

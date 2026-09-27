import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from './types';

/**
 * F-SW-1's second clause: the profile "is also reachable from Today when it has
 * changed".
 *
 * "When it has changed" needs a memory of what the learner last saw, so this is a
 * setting rather than an event — the same call src/import/settings.ts makes, and
 * for the same reason: it is current state read on every open, not a history to be
 * replayed. Persisted to localStorage through zustand's `persist`, exactly as
 * `useImportSettings` and `src/app/settings.ts` do.
 *
 * ── WHAT COUNTS AS A CHANGE ──────────────────────────────────────────────────
 *
 * Not every recomputation. The profile re-derives on every visit to the Progress
 * tab, and a signature over the whole of it would change when a single accuracy
 * moved by a tenth of a point — which would put a "your profile has changed" link
 * on Today permanently, and a notice that is always on is not a notice.
 *
 * So the signature is the two things F-TS-1 says are material: how many games it
 * rests on, and which weaknesses are in the top three. That is the same test the
 * tailored session uses to decide it is worth offering ("a new weakness enters the
 * top three, or an import completes"), so Today's link and the session offer cannot
 * disagree about whether anything happened.
 *
 * The order of the top three is part of it: a learner whose first and second
 * weaknesses have swapped has something new to read.
 */

export function profileSignature(profile: Profile): string {
  return [String(profile.games), ...profile.weaknesses.map((w) => w.theme)].join('|');
}

interface SeenState {
  /** The signature the learner last had the profile screen open for. */
  lastSeen: string | null;
  /**
   * How many reviewed games the projection held at that moment.
   *
   * Recorded separately because Today has to answer "has it changed?" WITHOUT
   * building a profile — see `reviewedGamesChanged`.
   */
  lastSeenReviews: number | null;
  markSeen: (signature: string, reviews: number) => void;
}

export const useProfileSeen = create<SeenState>()(
  persist(
    (set) => ({
      lastSeen: null,
      lastSeenReviews: null,
      markSeen: (signature, reviews) => {
        set({ lastSeen: signature, lastSeenReviews: reviews });
      },
    }),
    { name: 'chessapp-profile-seen' },
  ),
);

/**
 * Today's cheap version of the same question.
 *
 * ── WHY TODAY DOES NOT BUILD A PROFILE ───────────────────────────────────────
 *
 * Building one is three Dexie table reads. Today is the launch screen, and this
 * screen's own comments already refuse to put a feature's cost on it "for a
 * subtitle". So Today compares `Progress.reviews` — which is already in memory,
 * because it is a field on the event-log projection the screen is reading anyway —
 * against the count recorded when the profile was last opened. Zero extra I/O.
 *
 * `Progress.reviews` counts distinct `game_reviewed` events, and an imported game
 * banks the same event an in-app game does (src/import/reviewSource.ts), so it moves
 * for both kinds. Two ways it disagrees with the profile's own count, both stated
 * because a reader will otherwise assume they are the same number:
 *
 *  - A new BULLET game increments it while the profile excludes bullet by default
 *    (F-IM-2). So Today can offer a profile that has not visibly changed. A notice
 *    that occasionally has nothing behind it is a small cost; a notice that misses
 *    a real change is not, and this direction is the survivable one.
 *  - Re-analysing a game already reviewed does NOT increment it (`reduceProgress`
 *    counts a gameId once), so a profile that changed because a partial review was
 *    replaced by a full one is not announced. The profile is still correct when the
 *    learner next opens the tab; only the offer is missed.
 */
export function reviewedGamesChanged(reviews: number, lastSeenReviews: number | null): boolean {
  if (reviews === 0) return false;
  return reviews !== lastSeenReviews;
}

/**
 * Whether Today should offer the profile.
 *
 * An empty profile never has anything to announce, which is the first condition:
 * a learner with no analysed games would otherwise be sent to a screen that says
 * it has nothing, by a link that implied it had something.
 *
 * A learner who has NEVER seen the profile and has games is a change: `lastSeen`
 * is null, which does not equal any signature, so the first profile announces
 * itself. That is the case the requirement most obviously wants.
 */
export function profileHasChanged(profile: Profile | null, lastSeen: string | null): boolean {
  if (profile === null || profile.games === 0) return false;
  return profileSignature(profile) !== lastSeen;
}

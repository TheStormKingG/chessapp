import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { useImportSettings } from '@/import/settings';
import { NO_BAND_STATS } from './bandStats';
import { buildProfile } from './buildProfile';
import { profileGamesFrom } from './games';
import type { Profile } from './types';

/**
 * The profile, read from the three tables it is derived from.
 *
 * Reads, never writes. The profile is a projection (buildProfile.ts), so this hook
 * is one Dexie read of each input plus a pure call, and there is no profile table
 * to keep in step with anything.
 *
 * ── THE BAND-STATISTICS SOURCE IS WIRED HERE, AND IT IS THE EMPTY ONE ────────
 *
 * `NO_BAND_STATS`. This is the line that changes on the day the mining pass in
 * bandStats.ts has run, and it is the only line: every comparison in the feature
 * goes through the seam, so wiring a real source turns the whole of F-SW-5 on at
 * once. Until then every comparison is absent and the screen says which of the two
 * reasons it is.
 *
 * ── AND THE RATING IS NULL ───────────────────────────────────────────────────
 *
 * Also deliberately. F-SW-5's band is a GAME rating. `Progress.puzzleRating` is a
 * puzzle rating on the puzzle ladder's own scale, and handing it over as though it
 * were an over-the-board rating would bucket the learner against a population they
 * are not in — a wrong comparison rather than an absent one. F-AC-5 gates the other
 * candidate, an imported game's own Elo, behind the learner confirming the account
 * is theirs; `confirmedOwn` exists on `LinkedAccount` and there is still no
 * rating-ESTIMATE model to feed it into, which is a separate requirement.
 */

export interface ProfileState {
  profile: Profile | null;
  /** Reviews that could not be dated — see games.ts. Zero in a healthy app. */
  undateable: number;
}

export function useProfile(): ProfileState {
  const includeBullet = useImportSettings((s) => s.includeBullet);
  const [state, setState] = useState<ProfileState>({ profile: null, undateable: 0 });

  useEffect(() => {
    let live = true;
    Promise.all([db.reviews.toArray(), db.imported.toArray(), db.events.toArray()])
      .then(([reviews, imported, events]) => {
        if (!live) return;
        const { games, undateable } = profileGamesFrom({ reviews, imported, events });
        setState({
          profile: buildProfile(games, { rating: null, source: NO_BAND_STATS, includeBullet }),
          undateable,
        });
      })
      .catch(() => {
        // An unreadable Dexie is not a reason to take down the Progress tab: the
        // path and the totals below the profile read from the event-log projection
        // and are unaffected. An empty profile renders as its own honest empty
        // state, which is what a learner with no analysed games sees anyway.
        if (live) setState({ profile: buildProfile([], { includeBullet }), undateable: 0 });
      });
    return () => {
      live = false;
    };
  }, [includeBullet]);

  return state;
}

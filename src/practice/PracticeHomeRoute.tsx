import { useEffect, useState } from 'react';
import { db } from '@/data';
import { useErrors } from '@/puzzles/routeData';
import { PracticeScreen } from './PracticeScreen';

/**
 * The Practice tab, with the two counts F-PR-3's entries need.
 *
 * Its own module, away from the drill list and the vision trainer, for the reason
 * `PuzzlesHomeRoute` gives about itself: this is the TAB, so it is on the shell's
 * first-paint graph by definition, while `/practice/drills` and
 * `/practice/vision` are lazy routes and must stay off it. It reuses
 * `useErrors` from src/puzzles/routeData.ts — the module that exists precisely so
 * a home route and a lazy route can share a read without merging their chunks.
 */
export function PracticeHomeRoute() {
  const errors = useErrors();
  const reviewCount = useUnreviewedGames();
  return <PracticeScreen fixCount={errors?.length ?? 0} reviewCount={reviewCount} />;
}

/**
 * How many finished games have no review yet — F-PR-3's "review queue".
 *
 * Finished games minus reviewed ones, both from tables that already exist. A
 * game still in play is not waiting to be reviewed, which is why `finishedAt`
 * rather than the row's mere existence is the test.
 */
function useUnreviewedGames(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([db.games.toArray(), db.reviews.toArray()])
      .then(([games, reviews]) => {
        if (!live) return;
        const reviewed = new Set(reviews.map((r) => r.gameId));
        setCount(games.filter((g) => g.finishedAt !== null && !reviewed.has(g.id)).length);
      })
      .catch(() => {
        // An unreadable Dexie must not take the tab down. Zero renders as "nothing
        // waiting", which is what a learner with no games sees anyway.
        if (live) setCount(0);
      });
    return () => {
      live = false;
    };
  }, []);
  return count;
}

import { PuzzlesScreen } from '@/screens/PuzzlesScreen';
import { useErrors, useRating } from './routeData';

/**
 * The puzzles home, with the fix-my-mistakes count F-PZ-3 orders the screen by.
 *
 * The count is the number of logged errors, not the number of drills: an
 * unclassified mistake produces a lesson link and no drill, and it is still a
 * mistake waiting. Counting drills would report zero for the common case,
 * because the tagger classifies four of sixteen motifs.
 *
 * Its own module, away from the four solving routes, because it is the only
 * one of the five that is NOT lazy: it is the Puzzles TAB, reachable from the
 * shell's navigation, so it is on the shell's graph by definition. The four
 * solving routes are not, and `PuzzleRoutes.tsx` is the chunk they split into.
 */
export function PuzzlesHomeRoute() {
  const errors = useErrors();
  const rating = useRating();
  return <PuzzlesScreen fixCount={errors?.length ?? 0} rating={rating} />;
}

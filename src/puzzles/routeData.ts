import { useEffect, useState } from 'react';
import { db, useProgress } from '@/data';
import type { ErrorEntry } from '@/review/types';
import type { PuzzleRating } from './types';

/**
 * The two reads the puzzles HOME and the four solving routes share.
 *
 * They live apart from both for one reason: `src/app/routes.tsx` loads the
 * solving routes with `React.lazy`, so anything those routes import lands in
 * the split chunk — and anything the home route imports stays in the shell.
 * A single module holding both would put the whole solving feature back on
 * first paint, which is the thing the split exists to prevent.
 */

/**
 * Every error the review feature has logged, newest game first.
 *
 * The reviews table is the store: `Review.errors` is written when a game is
 * reviewed, so this reads them rather than re-analysing anything.
 */
export function useErrors(): ErrorEntry[] | null {
  const [errors, setErrors] = useState<ErrorEntry[] | null>(null);
  useEffect(() => {
    let on = true;
    db.reviews
      .toArray()
      .then((reviews) => {
        if (!on) return;
        setErrors(
          [...reviews]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .flatMap((r) => r.errors),
        );
      })
      .catch(() => {
        if (on) setErrors([]);
      });
    return () => {
      on = false;
    };
  }, []);
  return errors;
}

export function useRating(): PuzzleRating {
  return useProgress((s) => s.progress.puzzleRating);
}

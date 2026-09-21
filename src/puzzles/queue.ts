import { THEME_LESSON, type Theme as ReviewTheme } from '@/review/errorLog';
import type { ErrorEntry } from '@/review/types';
import type { Puzzle, PuzzleRating, Theme } from './types';

/**
 * F-PZ-3, "fix my mistakes": the learner's own errors come first in the
 * stream, their exact positions before merely similar ones.
 *
 * The important thing about this module is which path is the main one. The
 * review tagger implements four of PRD §10.3's sixteen motifs, so MOST errors
 * arrive `unclassified`, and F-PZ-3 says an unclassifiable mistake produces a
 * lesson link rather than a drill. That is the common path, not the fallback,
 * and it is built accordingly.
 */

/** F-PZ-3: "a puzzle rating within 150 points". */
const SIMILAR_RATING_SPAN = 150;
/** How many similar puzzles one error is worth. Enough to practise, not a session. */
const SIMILAR_PER_ERROR = 3;

/**
 * The puzzle theme each review theme drills.
 *
 * Only `missed_mate` has a counterpart among the eight Section 1-2 themes, and
 * that is not an omission: `hung_piece`, `missed_capture` and `ignored_threat`
 * are habits the curriculum teaches, not puzzle motifs the packs are filtered
 * on. Mapping them onto a motif anyway would point the drill at the wrong
 * idea, which errorLog.ts already argues is worse than no theme at all.
 */
const DRILL_THEME: Record<ReviewTheme, Theme | null> = {
  missed_mate: 'mateIn1',
  hung_piece: null,
  missed_capture: null,
  ignored_threat: null,
  unclassified: null,
};

/**
 * `ErrorEntry.theme` is a bare `string`, so an entry from an older log — or
 * from a tagger that gains a motif — can carry a theme this module has never
 * heard of. Unknown means unclassified: a lesson link and no drill. It must
 * never fall through to a puzzle-theme comparison, or a review theme that
 * happened to be spelled like a puzzle theme would silently become a drill.
 */
function reviewThemeOf(theme: string): ReviewTheme {
  return Object.prototype.hasOwnProperty.call(THEME_LESSON, theme)
    ? (theme as ReviewTheme)
    : 'unclassified';
}

export interface FixDrill {
  /** `own` is the learner's exact position; `similar` is a pack puzzle. */
  source: 'own' | 'similar';
  puzzle: Puzzle;
  /**
   * Which ply of `puzzle.solution` the learner plays. 0 for an own drill —
   * they are already to move — and 1 for a pack puzzle, whose `solution[0]` is
   * the opponent's move. Passed straight to `session.initial`.
   */
  firstLearnerPly: 0 | 1;
  /** The mistake this drill came from, so the screen can show what happened. */
  error: ErrorEntry;
}

export interface LessonLink {
  error: ErrorEntry;
  /**
   * From `THEME_LESSON` — the review feature's single map, reused rather than
   * copied. Null for `unclassified`, and null is the honest answer: the tagger
   * named no idea, so there is no lesson that teaches it. The screen shows the
   * position and says the mistake was not identified; it does not link nowhere.
   */
  lessonId: string | null;
}

export interface Queue {
  fix: FixDrill[];
  lessonLinks: LessonLink[];
}

export interface QueueInput {
  errors: readonly ErrorEntry[];
  pool: readonly Puzzle[];
  rating: PuzzleRating;
  seen: ReadonlySet<string>;
}

/** A drill from the learner's own position: they are to move, and `bestUci` is the answer. */
function ownPuzzle(e: ErrorEntry, theme: Theme | null, rating: number): Puzzle {
  return {
    id: `own:${e.gameId}:${e.ply}`,
    fen: e.fenBefore,
    // One ply, and the learner plays it. `firstLearnerPly: 0` is what stops a
    // player replaying this AS the opponent's move.
    solution: [e.bestUci],
    // The position has no puzzle rating of its own. The learner's own rating is
    // the least distorting stand-in: the expected score is then ~0.5, so the
    // attempt neither inflates nor deflates the projection systematically.
    rating,
    themes: theme ? [theme] : [],
  };
}

export function buildQueue({ errors, pool, rating, seen }: QueueInput): Queue {
  const fix: FixDrill[] = [];
  const lessonLinks: LessonLink[] = [];
  // Across the whole queue, not per error: two mistakes with the same theme
  // must not hand the learner the same puzzle twice.
  const used = new Set<string>(seen);

  for (const error of errors) {
    const theme = reviewThemeOf(error.theme);

    if (theme === 'unclassified') {
      lessonLinks.push({ error, lessonId: THEME_LESSON.unclassified });
      continue;
    }

    lessonLinks.push({ error, lessonId: THEME_LESSON[theme] });

    const drillTheme = DRILL_THEME[theme];
    const own = ownPuzzle(error, drillTheme, rating.rating);
    if (!used.has(own.id)) {
      used.add(own.id);
      fix.push({ source: 'own', puzzle: own, firstLearnerPly: 0, error });
    }

    if (drillTheme === null) continue;

    // "Similar" is F-PZ-3's own definition: the same primary theme and a
    // puzzle rating within 150 points of the learner.
    const similar = pool
      .filter(
        (p) =>
          !used.has(p.id) &&
          p.themes.includes(drillTheme) &&
          Math.abs(p.rating - rating.rating) <= SIMILAR_RATING_SPAN,
      )
      .sort((a, b) => Math.abs(a.rating - rating.rating) - Math.abs(b.rating - rating.rating))
      .slice(0, SIMILAR_PER_ERROR);

    for (const p of similar) {
      used.add(p.id);
      fix.push({ source: 'similar', puzzle: p, firstLearnerPly: 1, error });
    }
  }

  return { fix, lessonLinks };
}

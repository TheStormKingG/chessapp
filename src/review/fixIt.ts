import type { Challenge, Lesson } from '@/lesson';
import type { ErrorEntry } from './types';

/**
 * PRD F-RV-7: "The review ends with a three-to-five-puzzle drill built from the
 * error log and a single suggested next lesson."
 *
 * SCOPE, stated plainly: F-RV-7 and PRD 6.1 describe "similar positions" drawn
 * from a puzzle ladder and scheduled at growing intervals. No puzzle ladder and
 * no scheduler exist (src/screens/PuzzlesScreen.tsx is a placeholder), so this
 * replays the learner's OWN positions from this game. That is retrieval
 * practice on the exact position they just got wrong — narrower than F-RV-7 and
 * honestly narrower. Design spec section 6.4 names the destination for the rest.
 */

export const MIN_DRILL = 3;
export const MAX_DRILL = 5;

export interface Drill extends Lesson {
  suggestedLessonId: string | null;
}

const FALLBACK_PROMPT = 'There was a better move here. Find it.';

const PROMPT: Record<string, string> = {
  hung_piece: 'You left a piece to be taken here. Find the move that keeps it.',
  missed_capture: 'Something was free here. Take it.',
  missed_mate: 'There is a checkmate in one. Find it.',
  ignored_threat: 'Your opponent was threatening something. Deal with it.',
  unclassified: FALLBACK_PROMPT,
};

/**
 * Returns null when there are fewer than MIN_DRILL errors. F-RV-7 asks for a
 * drill "where the game produced enough errors to build one": a two-question
 * "three to five puzzle drill" would have to lie in its own copy, and a review
 * of a clean game ends on the last key moment rather than on a stub.
 */
export function drillFrom(errors: ErrorEntry[]): Drill | null {
  if (errors.length < MIN_DRILL) return null;

  const picked = [...errors]
    .sort((a, b) => rank(b) - rank(a) || a.ply - b.ply)
    .slice(0, MAX_DRILL)
    .sort((a, b) => a.ply - b.ply);

  const first = picked[0];
  if (!first) return null; // unreachable: picked has at least MIN_DRILL entries.

  const challenges: Challenge[] = picked.map((e) => ({
    type: 'find_the_move',
    id: `fix-${e.gameId}-${String(e.ply)}`,
    fen: e.fenBefore,
    prompt: PROMPT[e.theme] ?? FALLBACK_PROMPT,
    concept: e.theme,
    // Both notations, because the player accepts either and the learner may be
    // in text-entry mode.
    answer: { moves: [e.bestUci, e.bestSan] },
  }));

  return {
    id: `fix-${first.gameId}`,
    unit: 'review',
    title: 'Fix it',
    // XP for a review is awarded once by the game_reviewed event. A drill that
    // also awarded XP would pay twice for one loop.
    xp: 0,
    card: { idea: 'The positions from this game where something went wrong. One move each.', diagrams: [] },
    explain: [],
    challenges,
    takeaway: 'Same positions, second chance. That is where the improvement comes from.',
    suggestedLessonId: mostCommonLesson(picked),
  };
}

/** Blunders before mistakes before misses; within a class, the later the worse. */
function rank(e: ErrorEntry): number {
  return e.label === 'Blunder' ? 3 : e.label === 'Miss' ? 2 : 1;
}

function mostCommonLesson(errors: ErrorEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const e of errors) if (e.lessonId) counts.set(e.lessonId, (counts.get(e.lessonId) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [id, c] of counts) if (c > n) { best = id; n = c; }
  return best;
}

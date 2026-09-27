import { THEME_LESSON, type Theme } from '@/review/errorLog';
import { SECTIONS } from '@/path/curriculum';

/**
 * F-SW-3's "a plain name ('Knight forks against you')" and "the lesson and drill
 * that fix it".
 *
 * ── HOW MANY WEAKNESSES CAN BE NAMED, AND WHY IT IS FOUR ─────────────────────
 *
 * PRD §10.3 lists sixteen motifs for the tagger. src/tagger/tagger.ts implements
 * four, so src/review/errorLog.ts tags four and marks everything else
 * `unclassified`, and it refuses to guess: "a wrong theme points the fix-it drill
 * at the wrong idea, which is worse than no theme."
 *
 * The profile inherits that exactly. F-SW-3's own example weakness — "Knight
 * forks against you" — is one of the twelve motifs the tagger does not implement,
 * so the profile cannot name it today. It is not fabricated to match the
 * requirement's illustration: the vocabulary grows when the tagger does, and this
 * table grows with it in one place.
 *
 * `unclassified` is a real and COMMON weakness, and it gets a plain name of its
 * own rather than being hidden. A learner whose costliest weakness is mistakes
 * the tagger cannot classify is owed that sentence — the cost is real even when
 * the cause is not yet nameable — and the drill built from their own positions
 * works on it regardless.
 */

/** The learner-facing name of each theme. F-SW-3's "plain name". */
export const THEME_NAME: Record<Theme, string> = {
  hung_piece: 'Leaving pieces free to take',
  missed_capture: 'Missing free material',
  missed_mate: 'Missing mate in one',
  ignored_threat: 'Ignoring your opponent’s threat',
  unclassified: 'Mistakes with no pattern yet identified',
};

/** One line saying what the weakness IS, for the detail behind a weakness. */
export const THEME_DESCRIPTION: Record<Theme, string> = {
  hung_piece: 'A move that left one of your own pieces able to be taken for nothing.',
  missed_capture: 'A move played while something of your opponent’s was free to take.',
  missed_mate: 'A move played while checkmate in one was available.',
  ignored_threat: 'A move that did not answer something your opponent was threatening.',
  unclassified:
    'Mistakes the analysis could see but could not name. The tagger recognises four patterns so far, so most mistakes land here.',
};

/**
 * The lesson title for a lesson id, from the authored curriculum and nowhere
 * else.
 *
 * There is deliberately no second table of lesson titles in this module, for the
 * reason src/review/errorLog.ts gives about `THEME_LESSON`: the curriculum is the
 * single source, and a copy drifts silently the first time a lesson is renamed. A
 * test asserts every id `THEME_LESSON` names still resolves here.
 */
export function lessonTitle(lessonId: string): string | null {
  for (const section of SECTIONS) {
    for (const unit of section.units) {
      const lesson = unit.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson.title;
    }
  }
  return null;
}

/**
 * F-SW-3's drill.
 *
 * Two real destinations, both of which already exist and are already reachable:
 *
 *  - Themed practice, where the theme has a counterpart among the eight motifs
 *    the packs carry. Only `missed_mate` does, and src/puzzles/queue.ts explains
 *    at length why the other three must NOT be mapped onto a motif — they are
 *    habits the curriculum teaches, not motifs the packs are filtered on, and a
 *    mapping would point the drill at the wrong idea.
 *  - "Fix my mistakes" (`/puzzles/fix`), which replays the learner's own
 *    positions from the error log. For the three habit themes and for
 *    `unclassified` this is the drill that actually fixes them, and it is not a
 *    consolation prize: retrieval practice on the exact position they got wrong
 *    is what src/review/fixIt.ts is built on.
 *
 * Never null, therefore. Every weakness the profile can rank has a drill, because
 * the error log itself is the drill's content.
 */
export function drillFor(theme: Theme): { to: string; name: string } {
  if (theme === 'missed_mate') {
    return { to: '/puzzles/themed?theme=mateIn1', name: 'Mate in one practice' };
  }
  return { to: '/puzzles/fix', name: 'Fix my mistakes' };
}

/** The lesson that fixes a theme, with its authored title. */
export function lessonFor(theme: Theme): { id: string; title: string } | null {
  const id = THEME_LESSON[theme];
  if (id === null) return null;
  const title = lessonTitle(id);
  // A theme whose lesson id no longer resolves is a curriculum drift, not a
  // reason to show the learner a link to nowhere. The id is still returned so the
  // route works; the title falls back to the id, which is what PathScreen shows
  // for an unbuilt lesson, and the test in this module's suite is what actually
  // notices the drift.
  return { id, title: title ?? id };
}

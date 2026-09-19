import { LessonPlayer } from '@/lesson';
import type { Drill } from './fixIt';

/**
 * PRD F-RV-7 and Wireframes screen 16.
 *
 * This is the whole drill: the shipped LessonPlayer, handed a Lesson built at
 * runtime. No new player, no new challenge type, no content pipeline.
 *
 * The two callbacks are deliberately separate, and this is a DEVIATION from the
 * plan's draft, which wired one `onDone` to both `onOutcome` and `onExit`:
 *
 * - `onBanked` rides on `onOutcome`, which the player fires exactly once when
 *   the close screen is REACHED. That is the banking point — the review must be
 *   recorded before any screen says it is done (design spec §8, F-RV-7c).
 * - `onDone` rides on `onComplete` and `onExit`, i.e. on the learner LEAVING.
 *
 * Folding them together would have navigated away the instant the close screen
 * mounted, so "Review done" would never have been seen — the banking would have
 * been correct and the screen it exists to justify would not have existed.
 */
export function FixItDrill({
  drill,
  onBanked,
  onDone,
  onLesson,
  textEntry,
}: {
  drill: Drill;
  /** The review is complete. Append the event here, before the close screen paints. */
  onBanked: () => void;
  /** The learner has left the drill. */
  onDone: () => void;
  onLesson: (lessonId: string) => void;
  textEntry?: boolean;
}) {
  return (
    <LessonPlayer
      lesson={drill}
      textEntry={textEntry}
      hintsAllowed={false}
      showXp={false}
      title="Fix it"
      exitLabel="Exit review"
      closeHeading="Review done"
      closeAction="Back to the path"
      onOutcome={onBanked}
      onComplete={() => {
        // F-RV-7b: a single suggested next lesson, offered on the way out.
        if (drill.suggestedLessonId !== null) onLesson(drill.suggestedLessonId);
        onDone();
      }}
      onExit={onDone}
    />
  );
}

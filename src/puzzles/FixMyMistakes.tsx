import { useState } from 'react';
import { Link } from 'react-router';
import { btn } from '@/app/Button';
import { Board } from '@/board';
import { SECTION_1 } from '@/path/curriculum';
import type { ErrorEntry } from '@/review/types';
import { PuzzlePlayer } from './PuzzlePlayer';
import type { FixDrill, Queue } from './queue';
import type { AttemptResult } from './types';

/**
 * Fix my mistakes (F-PZ-3, design spec §3.4).
 *
 * Two kinds of entry, and the SECOND is the common one:
 *
 * 1. A drill — the learner's own position, or a pack puzzle with the same
 *    motif. `queue.ts` builds these; this screen plays them.
 * 2. A mistake the tagger could not classify. The review tagger implements
 *    four of PRD §10.3's sixteen motifs, so MOST errors arrive `unclassified`,
 *    and `THEME_LESSON.unclassified` is null by design.
 *
 * WHAT AN UNCLASSIFIED MISTAKE GETS. F-PZ-3 says an unclassifiable mistake
 * "produces a link to the relevant lesson instead of a drill", and there is no
 * relevant lesson: the tagger named no idea, so no lesson teaches it. The
 * decision taken is to show the learner their own position and their best
 * move, and to say plainly that this one could not be matched to a lesson.
 *
 * Every other option available was worse:
 *
 * - **Invent a destination.** There isn't one.
 * - **Link to a generic lesson.** That is the failure `errorLog.ts` already
 *   argues against — pointing at the wrong idea is worse than naming none.
 * - **Drop the entry.** A mistake silently omitted is one the learner is never
 *   shown again, and the count on the puzzles screen would be a lie.
 *
 * What is left is the most useful part anyway: their mistake, on a board, with
 * the move that was there. It is the same discipline `explain.ts` follows —
 * say nothing rather than something unverified — applied to a destination
 * rather than to a sentence.
 */

const LESSON_TITLE = new Map(
  SECTION_1.units.flatMap((u) => u.lessons.map((l) => [l.id, l.title] as const)),
);

export function FixMyMistakes({
  queue,
  onAttempt,
}: {
  queue: Queue;
  onAttempt: (r: AttemptResult) => void;
}) {
  const [drilling, setDrilling] = useState<number | null>(null);
  const drill = drilling === null ? undefined : queue.fix[drilling];

  if (drill) {
    return (
      <PuzzlePlayer
        key={drill.puzzle.id}
        puzzle={drill.puzzle}
        source="fix"
        // Straight from the queue, never inferred: an own drill starts at ply
        // 0 because the learner is already to move, and a pack puzzle starts at
        // ply 1 because its first move is the opponent's. Guessing between them
        // asks the learner to play the wrong side, and every position still
        // looks legal.
        firstLearnerPly={drill.firstLearnerPly}
        onDone={onAttempt}
        onExit={() => {
          setDrilling(null);
        }}
      />
    );
  }

  return (
    <section className="p-4">
      <h1 className="t-display">Fix my mistakes</h1>

      {queue.lessonLinks.length === 0 && queue.fix.length === 0 && (
        <p className="t-body mt-3">
          No mistakes waiting. They arrive here after a game has been reviewed.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {queue.lessonLinks.map((link, i) => {
          /*
            EVERY drill this mistake produced, not just the learner's own
            position. `queue.ts` also builds `source: 'similar'` drills —
            F-PZ-3 c, same primary theme and a rating within 150 — and this
            screen used to resolve only `'own'`, so each one was built and then
            had nowhere to go. The queue's own order is kept: an error's exact
            position first, then the similar ones behind it, which is what
            F-PZ-3 asks for read per mistake rather than across the list.
          */
          const drills = queue.fix.flatMap((d, index) =>
            d.error === link.error ? [{ drill: d, index }] : [],
          );
          return (
            <li
              key={`${link.error.gameId}:${String(link.error.ply)}`}
              className="n-panel n-edge rounded-card bg-panel p-4"
            >
              <Mistake
                error={link.error}
                lessonId={link.lessonId}
                drills={drills}
                onDrill={setDrilling}
                index={i}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Mistake({
  error,
  lessonId,
  drills,
  onDrill,
  index,
}: {
  error: ErrorEntry;
  lessonId: string | null;
  /** Every drill the queue built for this mistake, with its index in `queue.fix`. */
  drills: { drill: FixDrill; index: number }[];
  onDrill: (index: number) => void;
  index: number;
}) {
  return (
    <>
      <h2 className="t-title">Move {Math.floor(error.ply / 2) + 1}</h2>
      <p className="t-body mt-1 text-content-dim">
        You played {error.playedSan}. {error.bestSan} was there.
      </p>
      <div className="mt-3 max-w-xs">
        {/* The position, because it is the most useful thing this entry has
            whether or not anything could be said about it. */}
        <Board
          fen={error.fenBefore}
          orientation={error.fenBefore.split(' ')[1] === 'b' ? 'b' : 'w'}
          mode="static"
          decorative
          size={200}
          testId={`mistake-${String(index)}`}
        />
      </div>

      {lessonId === null ? (
        <p className="t-body mt-3">
          {/* Said plainly, and not dressed up as something else. */}
          This one could not be matched to a lesson, so there is nothing to send you to. The
          position and the move above are what we can show you for it.
        </p>
      ) : (
        <p className="t-body mt-3">
          <Link className="underline decoration-accent" to={`/lesson/${lessonId}`}>
            {LESSON_TITLE.get(lessonId) ?? `Lesson ${lessonId}`}
          </Link>{' '}
          teaches this idea.
        </p>
      )}

      {/*
        A plain wrapper and not a list, deliberately: the mistakes themselves
        are the `<li>`s of the screen's one list, and nesting a second list
        inside each would change what "one entry per mistake" means to every
        reader — assistive technology and test alike.
      */}
      {drills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {drills.map((entry) => (
            <button
              key={entry.drill.puzzle.id}
              type="button"
              className={btn.secondary}
              data-testid={`drill-${String(entry.index)}`}
              onClick={() => {
                onDrill(entry.index);
              }}
            >
              {entry.drill.source === 'own'
                ? 'Drill this position'
                : /* Numbered from the SIMILAR ones only. Counting position in
                     `drills` would label the first similar drill "1" or "2"
                     depending on whether the own drill survived `seen`, and a
                     learner who has already done their own position would be
                     offered a "Similar position 2" with no 1. */
                  `Similar position ${String(
                    drills.filter((d) => d.drill.source === 'similar').indexOf(entry) + 1,
                  )}`}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

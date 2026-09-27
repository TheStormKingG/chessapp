import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { btn } from '@/app/Button';
import { plural } from '@/app/plural';
import { localDay } from '@/data/events';
import { useProgress } from '@/data';
import { LessonPlayer } from '@/lesson';
import { PlayItOut } from '@/lesson/challenges/PlayItOut';
import { PuzzlePlayer } from '@/puzzles/PuzzlePlayer';
import type { AttemptResult } from '@/puzzles/types';
import { CHECK_DAYS, closingVerdict } from './closeOut';
import type { PracticeItem } from './practiceSet';
import { useTailored } from './store';
import { type Session, useTailoredSession, type SessionOptions } from './useTailoredSession';

/**
 * F-TS-1's session, as one screen with four stages.
 *
 * ── WHAT IS REUSED, WHICH IS ALMOST EVERYTHING ───────────────────────────────
 *
 * `LessonPlayer` plays the tailored lesson — the shipped player, handed a `Lesson`
 * built at runtime, exactly as `FixItDrill` does it. `PuzzlePlayer` plays each
 * practice item, one at a time, which is the only way it works and the reason it takes
 * a plain data prop. `PlayItOut` plays an unverifiable own position. The targeted game
 * is the shipped `/play/game` route with F-TS-5's parameters.
 *
 * Nothing here is a second player, a second grader or a second progress store.
 *
 * ── WHY THE GAME IS A LINK AND NOT A STAGE ───────────────────────────────────
 *
 * F-TS-1 names four parts: the lesson, the practice set, "one targeted game or
 * mini-game", and "the review of that game". A game is a modal task on its own route
 * that ends in its own review, and it has to be, because that is where
 * `game_finished` and the review pipeline live. So the session hands the learner into
 * it and the closing panel is what they come back to. What the session does NOT do is
 * pretend to contain the game: the stage says plainly that the game and its review
 * happen on their own screens, and F-TS-6's verdict is computed from the review once
 * it exists.
 */

type Stage = 'intro' | 'lesson' | 'practice' | 'close';

export function TailoredSessionScreen(options: SessionOptions = {}) {
  const [params] = useSearchParams();
  const theme = params.get('theme');
  const state = useTailoredSession({ ...options, theme: theme ?? options.theme ?? null });

  if (state.status === 'loading') {
    return (
      <section className="p-4">
        <h1 className="t-title">Building your session…</h1>
      </section>
    );
  }
  if (state.status === 'unavailable') {
    return (
      <section className="p-4">
        <h1 className="t-title">No tailored session right now</h1>
        <p className="t-body mt-2 text-content-dim">{state.note}</p>
        <p className="mt-4">
          <Link className={btn.primary} to="/">
            Back to today
          </Link>
        </p>
      </section>
    );
  }
  return <Run session={state.session} now={options.now} />;
}

function Run({ session, now }: { session: Session; now?: Date }) {
  const nav = useNavigate();
  const record = useTailored((s) => s.record);
  const setNextCheck = useTailored((s) => s.setNextCheck);
  const decline = useTailored((s) => s.decline);
  const append = useProgress((s) => s.append);
  const completed = useProgress((s) => s.progress.lessons[session.lesson.authoredId]?.completed ?? false);
  const [stage, setStage] = useState<Stage>('intro');
  const today = localDay(now ?? new Date());

  const start = () => {
    // Recorded at the moment the session starts, because that is the day the path did
    // not move. Recording it at the end would let a learner take four in a week by
    // abandoning three.
    record({ day: today, theme: session.target.primary.theme, lessonId: session.lesson.authoredId, signature: session.signature });
    setNextCheck({ theme: session.target.primary.theme, day: closing.nextCheckDay });
    setStage('lesson');
  };

  const closing = closingVerdict({
    name: session.target.primary.name,
    // Before the game is played there is nothing in it, so the verdict is about the
    // rate the learner arrives with. It is recomputed from the game's own review on
    // the review screen, which is where F-TS-6's sentence finally belongs.
    inThisGame: 0,
    previousPerGame: session.previousPerGame,
    today,
    days: CHECK_DAYS,
  });

  if (stage === 'lesson') {
    return (
      <LessonPlayer
        lesson={session.lesson.lesson}
        title={`Tailored: ${session.lesson.lesson.title}`}
        exitLabel="Leave session"
        closeHeading="Lesson done"
        closeAction="Practice set"
        onExit={() => {
          setStage('intro');
        }}
        onComplete={() => {
          setStage('practice');
        }}
        onOutcome={(o) => {
          // The AUTHORED lesson's id, and `replay` exactly as LessonRoute computes it:
          // F-TS-3's "if a learner has already completed the lesson on the path, the
          // tailored version counts as a review lesson", which is F-PA-7's half XP.
          append({
            type: 'lesson_completed',
            lessonId: session.lesson.authoredId,
            stars: o.stars,
            xp: session.lesson.lesson.xp,
            replay: completed,
          });
        }}
      />
    );
  }

  if (stage === 'practice') {
    return (
      <Practice
        items={session.practice.items}
        short={session.practice.short}
        onDone={() => {
          setStage('close');
        }}
      />
    );
  }

  if (stage === 'close') {
    return (
      <section className="p-4">
        <h1 className="t-title">One game to finish</h1>
        {session.game.kind === 'none' ? (
          <p className="t-body mt-2 text-content-dim">{session.game.reason}</p>
        ) : (
          <>
            <p className="t-body mt-2">{session.game.reason}</p>
            <p className="mt-4">
              <Link className={btn.primary} to={session.game.to}>
                {session.game.kind === 'opening-line' ? 'Face that opening' : 'Play it from there'}
              </Link>
            </p>
            <p className="t-caption mt-2 text-content-dim">
              The game and its review happen on their own screens, with the coach on. Come back here
              afterwards.
            </p>
          </>
        )}
        <h2 className="t-heading mt-6">Where this weakness stands</h2>
        <p className="t-body mt-1">{closing.line}</p>
        <p className="t-caption mt-2 text-content-dim">
          Next check on {closing.nextCheckDay}. Reviewing the game is what moves it: the profile is
          rebuilt from your reviews, so there is nothing else to update.
        </p>
        <p className="mt-6">
          <Link className={btn.quiet} to="/progress">
            Back to the profile
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="p-4">
      <h1 className="t-title">Today is tailored</h1>
      <p className="t-body mt-2">{session.target.reason}</p>
      <ul className="t-body mt-4 list-disc pl-5">
        <li>
          A lesson rebuilt around your own positions — {plural(session.lesson.own, 'position')} of yours,{' '}
          {plural(session.lesson.fromBank + session.lesson.fromAuthored, 'other')}.
        </li>
        <li>{plural(session.practice.items.length, 'puzzle')} to practise.</li>
        <li>
          {session.game.kind === 'none'
            ? 'No targeted game this time.'
            : session.size.game === 'included'
              ? 'One game against the bot, aimed at this.'
              : 'One game against the bot, if you have time for it.'}
        </li>
      </ul>
      {session.lesson.rate.checked > 0 && (
        <p className="t-caption mt-3 text-content-dim">
          {session.lesson.rate.verified} of {session.lesson.rate.checked} of your positions had a
          single clear answer the engine could confirm. The rest are practised as they are.
        </p>
      )}
      <p className="t-caption mt-1 text-content-dim">
        Built from {plural(session.games, 'game')}.
      </p>
      <p className="mt-6 flex flex-wrap gap-3">
        <button type="button" className={btn.primary} onClick={start}>
          Start the session
        </button>
        <button
          type="button"
          className={btn.quiet}
          onClick={() => {
            // F-HM-7: "the learner can decline it and keep the path's plan".
            decline(session.signature);
            void nav('/');
          }}
        >
          Not today
        </button>
      </p>
    </section>
  );
}

/**
 * The practice stage. Exported so it can be driven on its own: reaching it through
 * the screen means answering a whole lesson first, and a stage nothing can mount is a
 * stage nothing has tested.
 */
export function Practice({
  items,
  short,
  onDone,
}: {
  items: readonly PracticeItem[];
  short: string | null;
  onDone: () => void;
}) {
  const [at, setAt] = useState(0);
  const append = useProgress((s) => s.append);
  const item = items[at];
  const next = () => {
    if (at + 1 >= items.length) onDone();
    else setAt(at + 1);
  };

  if (!item) {
    return (
      <section className="p-4">
        <h1 className="t-title">Nothing to practise</h1>
        <p className="t-body mt-2 text-content-dim">{short ?? 'No positions were available.'}</p>
        <p className="mt-4">
          <button type="button" className={btn.primary} onClick={onDone}>
            Carry on
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="t-title">Practice</h1>
        <p className="t-index text-content-dim">
          {at + 1} of {items.length}
        </p>
      </header>
      {item.provenance !== null && <p className="t-caption mt-1 text-content-dim">From {item.provenance}.</p>}
      {short !== null && at === 0 && <p className="t-caption mt-1 text-content-dim">{short}</p>}
      {item.kind === 'puzzle' ? (
        <PuzzlePlayer
          key={item.puzzle.id}
          puzzle={item.puzzle}
          source="fix"
          firstLearnerPly={item.firstLearnerPly}
          onDone={(r: AttemptResult) => {
            // `source: 'fix'` and `ratingCounts` as the session reducer computed it:
            // F-PZ-2 keeps practice out of the rating, and a tailored set is practice.
            append({
              type: 'puzzle_attempted',
              puzzleId: r.puzzleId,
              themes: item.puzzle.themes,
              puzzleRating: item.puzzle.rating,
              solved: r.solved,
              hinted: r.hinted,
              misses: r.misses,
              source: 'fix',
              ms: r.ms,
            });
          }}
          /* `onExit` is the ✕, and in `FixMyMistakes` — the only other caller that
             plays a list — it means "leave this drill and go back". Kept to that
             meaning: it ends the practice run and moves to the close, rather than
             quietly acting as a second Next. Skipping one position has its own
             control below, so a learner who cannot solve a position is neither
             stranded on it nor thrown out of the set by the only button on screen. */
          onExit={onDone}
        >
          <button type="button" className={btn.primary} onClick={next}>
            Next
          </button>
        </PuzzlePlayer>
      ) : (
        <div className="mt-2">
          <p className="t-body">{item.challenge.prompt}</p>
          <PlayItOut
            key={item.challenge.id}
            c={item.challenge}
            onResult={() => {
              /* A drill with no single answer scores no attempt: there is nothing to
                 be right about, and recording one would put a made-up result into the
                 puzzle history. The learner played it out, which was the point. */
            }}
          />
          <p className="mt-4">
            <button type="button" className={btn.primary} onClick={next}>
              Next
            </button>
          </p>
        </div>
      )}
      {item.kind === 'puzzle' && (
        <p className="mt-4">
          <button type="button" className={btn.quiet} onClick={next}>
            Skip this one
          </button>
        </p>
      )}
    </section>
  );
}

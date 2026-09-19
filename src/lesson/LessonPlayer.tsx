import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { plural } from '../app/plural';
import { btn } from '@/app/Button';
import { Board } from '@/board';
import { CoachBubble, CoachService } from '@/coach';
import type { Square } from '@/rules';
import { useSettings } from '@/app/settings';
import { initLesson, reduce, currentChallenge, type Highlights, type LessonState } from './LessonMachine';
import { ChallengeView } from './challenges/ChallengeView';
import type { WrongMove } from './challenges/Sequence';
import { useEngineRefutation } from './useEngineRefutation';
import type { Lesson } from './types';
import type { LessonResume } from '@/data/resume';

export interface LessonOutcome {
  lessonId: string;
  stars: 1 | 2 | 3;
  xp: number;
  results: LessonState['results'];
}

/** F-PZ-4, stated where the learner decides, not only in the rules. */
const HINT_COST = 'A move after a hint still earns progress, but no mastery credit.';

export function LessonPlayer({
  lesson,
  onComplete,
  onOutcome,
  onExit,
  textEntry: forceText,
  hintsAllowed = true,
  title,
  exitLabel = 'Exit lesson',
  closeHeading = 'Lesson done',
  closeAction = 'Back to the path',
  showXp = true,
  resume = null,
  onProgress,
}: {
  lesson: Lesson;
  onComplete: (o: LessonOutcome) => void;
  /** Fired once when the close screen is reached, for recording the outcome. */
  onOutcome?: (o: LessonOutcome) => void;
  onExit: () => void;
  textEntry?: boolean;
  hintsAllowed?: boolean;
  title?: string;
  /* The player is reused outside the lesson path (checkpoints, remediation), so
     every string that says "lesson" or assumes the path is the next screen is a
     prop with the lesson wording as its default. */
  exitLabel?: string;
  closeHeading?: string;
  closeAction?: string;
  /** XP is awarded by the caller; a caller that awards none must not claim any. */
  showXp?: boolean;
  /** A place to come back to, loaded by the caller. Null means start at the card. */
  resume?: LessonResume | null;
  /**
   * Called with the current place each time the run reaches a challenge, and with
   * null once the lesson closes. The caller owns persistence: a graded assessment
   * simply does not pass this, and then nothing is saved.
   */
  onProgress?: (r: LessonResume | null) => void;
}) {
  const coachMuted = useSettings((s) => s.coachMuted);
  const settingTextEntry = useSettings((s) => s.textEntry);
  const textEntry = forceText ?? settingTextEntry;
  const coach = useMemo(() => {
    const c = new CoachService();
    c.muted = coachMuted;
    return c;
  }, [coachMuted]);
  const [s, dispatch] = useReducer(reduce, lesson, (l) => seedLesson(l, hintsAllowed, resume));
  const [lastWrong, setLastWrong] = useState<WrongMove | null>(null);
  useEngineRefutation(s, lastWrong, dispatch, coach);

  const c = currentChallenge(s);
  const ph = s.phase;

  /*
    The close screen states the lesson is done and reports the stars and the
    XP, so the outcome is a fact the moment it renders. Recording it on the
    button instead made the report conditional on one exit route: chunk B1 gave
    this screen its own close control, and leaving by that control -- or by a
    reload, or the tab bar on a wide layout -- discarded a lesson the interface
    had already said was finished. `onOutcome` is the recording and `onComplete` is the learner
    dismissing the screen: the checkpoint reuses this player and makes its
    close button advance to a score, so the two must not be one callback. A
    ref, not state, because this fires exactly once per close and must not
    itself cause a render.
  */
  const recorded = useRef(false);
  useEffect(() => {
    if (ph.kind !== 'close') {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    onOutcome?.({ lessonId: lesson.id, stars: ph.stars, xp: ph.xp, results: s.results });
  }, [ph, lesson.id, onOutcome, s.results]);
  // The wrong move belongs to the challenge it was played on. Clearing it here
  // makes that an invariant of the player rather than something the engine
  // refutation hook is left to infer. Adjusted during render, as elsewhere.
  const [prevId, setPrevId] = useState<string | null>(c?.id ?? null);
  if ((c?.id ?? null) !== prevId) {
    setPrevId(c?.id ?? null);
    setLastWrong(null);
  }
  const hintLabel = s.hintLevel === 0 ? 'Hint' : s.hintLevel === 1 ? 'Second hint' : 'No more hints';
  const busy = ph.kind === 'challenge' && ph.status !== 'attempting' && ph.status !== 'retry';

  /* F-AX-1: the control that advanced the run is unmounted with the challenge, so
     focus has to be placed deliberately or it falls to <body> — six to ten times
     a lesson for a keyboard or screen-reader user. The new challenge's prompt
     takes it, and the live region names the transition. */
  const promptRef = useRef<HTMLParagraphElement>(null);
  const challengeId = ph.kind === 'challenge' ? (c?.id ?? null) : null;
  useEffect(() => {
    if (challengeId) promptRef.current?.focus();
  }, [challengeId]);

  /* The place is reported as the run reaches each challenge, and withdrawn at the
     close — so a completed lesson has no record left to resume from. */
  const results = s.results;
  useEffect(() => {
    if (!onProgress) return;
    if (ph.kind === 'challenge' && challengeId) {
      onProgress({
        lessonId: lesson.id,
        challengeId,
        index: ph.index,
        challengeCount: lesson.challenges.length,
        results,
        totalHints: s.totalHints,
        totalMisses: s.totalMisses,
        savedAt: new Date().toISOString(),
      });
    } else if (ph.kind === 'close') {
      onProgress(null);
    }
    // `ph.index` and `ph.kind` are read through the narrowed phase above.
  }, [onProgress, lesson.id, lesson.challenges.length, challengeId, ph, results, s.totalHints, s.totalMisses]);

  const [confirmingExit, setConfirmingExit] = useState(false);
  const midRun = ph.kind === 'challenge' || ph.kind === 'explain';
  const exit = () => {
    if (midRun) setConfirmingExit(true);
    else onExit();
  };

  return (
    /* Concept Note 2 and DESIGN-SYSTEM.md §3.3: above `md` the parts sit side by
       side -- the board centred in its own column on the left, the prompt, the
       coach, the controls and the challenge index on the right -- with the board
       column capped to the viewport height so an 800px board can no longer push
       its own top off-screen. The lesson is a modal task (chunk B1), so this
       screen owns the whole window width rather than the 832px that was left
       over beside the tab rail; that width is what the right column fills.
       Below `md` this is the untouched single phone column, which is why every
       placement below is a `md:` grid coordinate rather than a change of DOM
       order.

       `min-h-dvh`, not `min-h-full`: a percentage min-height resolves against a
       parent with an explicit height, and this column's parent has only its own
       `min-h-full`, so `100%` computed to nothing and the close screen's
       anchored action (chunk C6) had nothing to be anchored inside of. */
    /* PREMIUM-DELTA §1.1 and §1.3 -- the pairing, corrected at `lg`.
       The reference's pairing is a RATIO, not a constant. Literal 1:1 comes
       from the marketing hero (424 board / 424 column / 48 gutter at 1024) and
       cannot be had here: the board is height-constrained to 624px at 800px
       tall, and 624 + 48 + 624 exceeds a 1280px viewport. The right reference
       for a lesson is §1.3's in-product puzzles screen at the same 1280px --
       a 571px board against a right column of at most 453px, about 1.4:1, one
       item per row. At `lg` a 27rem column with a 48px gutter lands the board
       at 624 and the column at 432: 1.44:1, the reference gutter exactly, and
       a column within 2% of the 424px the hero pairs with -- with the board
       not shrunk by a pixel, so the 49% viewport share §1.1 credits us with
       survives.
       `lg`, not `md`: below 1024 there is no slack left in the container, and
       a 27rem column would eat the board rather than the margin (at 768 it
       would leave 240px). 768-1023 keeps the 22rem column it has today, and
       the phone column below `md` is untouched. */
    <section className="flex min-h-dvh flex-col p-4 md:mx-auto md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-x-6 md:px-6 md:grid-rows-[auto_auto_1fr] lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-x-12">
      {/* The header reserves the two controls' space and gives the title what is
          left, rather than letting all three compete for the row.

          At 390 the old row put the title at x=60 -- flush against the right
          edge of a 44px close control, with no gutter at all -- and let it wrap
          there, so a long one ("1.4.3 · Touch move, draws, resigning, notation,
          the clock", "1.6.3 · Your first full game with the coach") read as
          tucked under the ✕. Nothing was overlapping; the title simply had no
          space of its own.

          So: `shrink-0` on the control and on the counter, because neither is
          the thing that should give way; `gap-3` for a real gutter on both
          sides; `min-w-0 flex-1` on the title so it wraps INSIDE its own column
          instead of pushing its neighbours. `min-w-0` is the load-bearing half
          -- a flex item's default `min-width:auto` refuses to shrink below its
          longest word, which is what pushed the title against the control.

          No title is shortened, because none needs to be. Measured at 390 with
          the counter at its widest ("12 of 12", 72px), the title column is
          218px and the longest title in Section 1 takes two 18px lines = 36px,
          inside the 44px the control already sets. The header does not grow,
          and nothing is elided -- which is why this is a layout fix and not a
          rewording: the string is the lesson's name, and it is also the h2 on
          the card below and the label on the Path. `lesson-header.spec.ts`
          measures this for every lesson rather than trusting the arithmetic. */}
      <header className="flex items-center justify-between gap-3 md:col-span-2">
        <button type="button" className="tap icon-control shrink-0" aria-label={exitLabel} onClick={exit}>
          ✕
        </button>
        <h1 className="t-caption min-w-0 flex-1 text-center text-content-dim">
          {title ?? `${lesson.id} · ${lesson.title}`}
        </h1>
        {/* The counter is the announcement: giving the text already on screen a
            live region names the transition for a screen reader without adding a
            second, competing statement of where the learner is. */}
        <span
          role="status"
          aria-live="polite"
          aria-label="Challenge progress"
          className="t-index shrink-0 text-content-dim"
        >
          {ph.kind === 'challenge' ? `${ph.index + 1} of ${lesson.challenges.length}` : ''}
        </span>
      </header>

      {confirmingExit && (
        <div className="mt-6 rounded-lg border border-edge-strong p-4 md:col-span-2">
          <h2 className="t-title">{`Leave the ${onProgress ? 'lesson' : 'attempt'}?`}</h2>
          <p className="t-body mt-2">
            {onProgress
              ? 'Your place is saved. You can pick up where you left off.'
              : 'This attempt will not be saved, and you would start it again from the beginning.'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`${btn.primary} flex-1`}
              onClick={() => {
                setConfirmingExit(false);
              }}
            >
              Keep going
            </button>
            <button
              type="button"
              className={`${btn.secondary} flex-1`}
              onClick={onExit}
            >
              Leave
            </button>
          </div>
        </div>
      )}

      {!confirmingExit && ph.kind === 'card' && (
        <>
          <div className="mt-6 md:col-start-2 md:row-start-2">
            <h2 className="t-title">{lesson.title}</h2>
            <p className="t-body mt-3">{lesson.card.idea}</p>
            {/* PREMIUM-DELTA.md §5: `--accent-soft` meant five different things,
                which is the rule §3.1 built the palette around. It keeps one job —
                the selected segment of a segmented control — so the prose chip
                becomes plain prose with a 2px left rule in `--accent`. The rule is
                a mark, not a text background: the prose carries `--content` on
                `--surface-raised`, measured below. */}
            {lesson.card.habit && (
              <p className="t-body mt-3 border-l-2 border-accent bg-surface-raised py-2 pl-3">
                Habit: {lesson.card.habit}
              </p>
            )}
          </div>
          {lesson.card.diagrams[0] && (
            <div className="mt-4 md:col-start-1 md:row-start-2 md:row-span-2 md:mt-6">
              <div className="md:mx-auto md:max-w-[calc(100dvh-11rem)]">
                <Board fen={lesson.card.diagrams[0]} orientation="w" mode="static" />
              </div>
            </div>
          )}
          <button
            type="button"
            className={`${btn.primary} mt-6 w-full md:col-start-2 md:row-start-3`}
            onClick={() => dispatch({ type: 'next' })}
          >
            Start
          </button>
        </>
      )}

      {!confirmingExit && ph.kind === 'explain' &&
        (() => {
          const e = lesson.explain[ph.index];
          if (!e) return null;
          const highlights: Highlights = {};
          for (const sq of e.highlights ?? []) highlights[sq] = 'accent';
          return (
            <>
              <div className="mt-4 md:col-start-1 md:row-start-2 md:sticky md:top-4">
               <div className="md:mx-auto md:max-w-[calc(100dvh-11rem)]">
                <Board
                  fen={e.fen}
                  orientation="w"
                  mode="static"
                  arrows={(e.arrows ?? []).map(([from, to]: [Square, Square]) => ({ from, to }))}
                  highlights={highlights}
                />
               </div>
              </div>
              <div className="md:col-start-2 md:row-start-2 md:mt-4">
                <CoachBubble text={e.text} />
                <button
                  type="button"
                  className={`${btn.primary} mt-4 w-full`}
                  onClick={() => dispatch({ type: 'next' })}
                >
                  Next
                </button>
              </div>
            </>
          );
        })()}

      {!confirmingExit && ph.kind === 'challenge' && c && (
        <>
          <p
            id="challenge-prompt"
            className="t-body-strong mt-4 md:col-start-2 md:row-start-2"
            tabIndex={-1}
            ref={promptRef}
          >
            {c.prompt}
          </p>
          {/* A retry has to reset the challenge's own answering surface as well as
              the machine, so the key carries the miss count as a retry generation
              (see ChallengeView). The answering surface travels with the board:
              the squares to pick, the options to choose, the drill to play out. */}
          <div className="mt-3 md:col-start-1 md:row-start-2 md:row-span-2 md:mt-4 md:sticky md:top-4">
          <div className="md:mx-auto md:max-w-[calc(100dvh-11rem)]">
          <ChallengeView
            key={`${c.id}#${s.results[c.id]?.misses ?? 0}`}
            c={c}
            highlights={s.highlights}
            refutation={s.refutation}
            busy={busy}
            textEntry={textEntry}
            dispatch={dispatch}
            onWrongMove={setLastWrong}
          />
          </div>
          </div>
          {/* PREMIUM-DELTA.md §1.3 and §4.2: the reference's right column is one
              vertical stack with a single filled control anchored at its bottom.
              The board spans rows 2-3, so this row is the `1fr` that holds the
              column's free height -- but the section aligns its items to
              `start`, so the block was only as tall as its content and the
              freed slack fell below it. `md:self-stretch` overrides that
              alignment for this item alone, which gives the flex column a real
              height for `md:mt-auto` to resolve against; without it the auto
              margin is the same class of silently inert rule as the `min-h-full`
              this file already carries a note about. Verified by measuring this
              container's own top and bottom against the column's foot
              (`tests/audit/lesson-desktop.spec.ts`), not from a screenshot.
              All `md:`, so the phone column is untouched. */}
          <div className="md:col-start-2 md:row-start-3 md:flex md:flex-col md:self-stretch">
          <CoachBubble text={s.feedback} tone={s.feedbackTone} />
          <div className="mt-4 flex gap-2 md:order-2">
            {!busy && s.hintsAllowed && (
              <>
                <button
                  type="button"
                  className={`${btn.secondary} flex-1 disabled:opacity-60`}
                  onClick={() => dispatch({ type: 'hint' })}
                  disabled={s.hintLevel >= 2}
                  title={HINT_COST}
                  aria-describedby="hint-cost"
                >
                  {hintLabel}
                </button>
                {/* The cost is announced, not only hovered (F-AX-1). */}
                <p id="hint-cost" className="sr-only">
                  {HINT_COST}
                </p>
              </>
            )}
            {!busy && (
              <button
                type="button"
                className={`${btn.secondary} flex-1`}
                onClick={() => dispatch({ type: 'reveal' })}
              >
                Show me
              </button>
            )}
            {busy && (
              <button
                type="button"
                className={`${btn.primary} flex-1`}
                onClick={() => dispatch({ type: 'next' })}
              >
                Next
              </button>
            )}
          </div>
          <ChallengeIndex count={lesson.challenges.length} at={ph.index} />
          </div>
        </>
      )}

      {/*
        Chunk C6 (M-3, M-4). The takeaway is the reason the lesson happened, so
        it is set left-aligned in body type under its own heading rather than
        centred inside an accent-tinted chip that read as a success banner.

        PREMIUM-DELTA.md Δ2 and Δ4.3. This is the moment the whole learning loop
        exists to produce and it was set at the 22px `title` role, with ≈500px of
        empty paper beneath it (§3.2, §3.4). Two changes:

        - The heading takes `display-lg` (40/44), one of exactly two places the
          top of the ladder is spent, and it carries its mandatory `--font-index`
          notation line immediately beneath: the run's own counts, tabular, in
          the index face. The count states the result before the star row
          decorates it (Δ3's rule), so the glyph row now follows its own words
          rather than preceding them — three channels, unchanged, reordered.
        - The block fills the column and the free space is spent as two equal
          auto margins around the content group, which puts the content at the
          optical centre and drops the action onto the bottom edge. `flex-1`
          alone does that below `md`, where the section is a `min-h-dvh` column;
          at `md` the section is a grid whose rows are auto-sized and whose items
          are `items-start`, so the block has to be given a height of its own or
          `flex-1` resolves against nothing — the same class of silently inert
          rule as the `min-h-full` this file already carries a note about.
          Verified by measuring the container and the button's bottom edge, not
          from a screenshot.
      */}
      {ph.kind === 'close' && (
        <div className="mt-6 flex min-h-[calc(100dvh-8rem)] flex-1 flex-col md:col-span-2">
          <div className="my-auto">
            <h2 className="t-display-lg">{closeHeading}</h2>
            <p className="t-index mt-2 text-content-dim">
              {plural(ph.stars, 'star')} · {plural(s.totalHints, 'hint')} ·{' '}
              {plural(s.totalMisses, 'miss', 'misses')}
            </p>
            <Stars earned={ph.stars} />
            <p className="t-body mt-4">{lesson.takeaway}</p>
            {showXp && <p className="t-index mt-4 text-content-dim">+{ph.xp} XP</p>}
          </div>
          <button
            type="button"
            className={`${btn.primary} w-full md:mx-auto md:max-w-sm`}
            onClick={() =>
              onComplete({ lessonId: lesson.id, stars: ph.stars, xp: ph.xp, results: s.results })
            }
          >
            {closeAction}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Earned and unearned stars (M-4, chunk C6).
 *
 * Three channels carry the score, and any one of them alone would be enough:
 *
 * 1. **Shape** — `★` filled against `☆` hollow.
 * 2. **Colour** — `--accent` against `--content-dim`. Accent because §3.1 gives
 *    it exactly two meanings, primary action and *completed work*, and an
 *    earned star is completed work. 6.62:1 light and 8.41:1 dark on the page
 *    ground, against a 3:1 requirement for a 30px glyph.
 * 3. **Words** — the "N stars · …" line directly above, which is the only thing
 *    a screen reader gets: the row itself is `aria-hidden` so the count is
 *    announced once rather than as three separate glyph names. It reads above
 *    rather than below since Δ2 made that line the heading's notation pair;
 *    adjacency is what the third channel needs, not an order.
 *
 * The previous version had only the first, and at 2 of 3 the difference was a
 * glyph outline at small size. The rule the design lead is applying is not
 * "add a colour" but "never let one channel be the only one" (hard constraint
 * 6), which is why the ink change alone would not have closed this.
 */
function Stars({ earned }: { earned: number }) {
  return (
    <p aria-hidden className="t-display mt-3 flex gap-1 leading-none">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < earned ? 'text-accent' : 'text-content-dim'}>
          {i < earned ? '★' : '☆'}
        </span>
      ))}
    </p>
  );
}

/**
 * The right column's index at regular width (DESIGN-SYSTEM.md §3.3 and §4): the
 * run's own challenge numbers, in the index face, in the column that was empty
 * at 1280 (H-3). It is the place in the run and nothing else — not the prompts,
 * which are the challenge's own text and must appear once, and not whether an
 * answer was right, which a graded checkpoint renders through this same player
 * and must not disclose mid-attempt.
 *
 * Hidden below `md`: the phone column is a single focused task and a list of
 * what is coming is exactly the distraction it is designed not to have. The
 * header's "3 of 6" already carries the same fact in one line, which is also why
 * this is `aria-hidden` rather than a second thing for a screen reader to read.
 * State is a glyph and a weight, never a colour on its own (hard constraint 6).
 */
function ChallengeIndex({ count, at }: { count: number; at: number }) {
  return (
    <ol aria-hidden className="t-index mt-8 hidden text-content-dim md:order-1 md:mt-auto md:block">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={`flex gap-2 py-0.5 ${i === at ? 'font-semibold text-content' : ''}`}>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span>{i < at ? '✓' : i === at ? '●' : '○'}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Start at the card, unless a saved place still matches this lesson's content.
 * The saved run comes back at the top of the challenge it was interrupted on:
 * the coach's transient state (feedback, arrows, half-typed answers) is not
 * worth reviving, and a fresh attempt at that challenge is what the learner
 * expects on coming back.
 */
function seedLesson(l: Lesson, hintsAllowed: boolean, r: LessonResume | null): LessonState {
  const base = initLesson(l, hintsAllowed);
  if (!r || r.lessonId !== l.id) return base;
  if (r.challengeCount !== l.challenges.length) return base;
  if (!(r.index >= 0 && r.index < l.challenges.length)) return base;
  if (l.challenges[r.index]?.id !== r.challengeId) return base;
  return {
    ...base,
    phase: { kind: 'challenge', index: r.index, status: 'attempting' },
    results: r.results,
    totalHints: r.totalHints,
    totalMisses: r.totalMisses,
  };
}

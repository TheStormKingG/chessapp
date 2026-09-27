import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { track } from '@/analytics';
import { btn } from '@/app/Button';
import { useProgress } from '@/data';
import { LessonPlayer, type LessonOutcome } from '@/lesson/LessonPlayer';
import type { Challenge, Lesson } from '@/lesson/types';
import { unitById } from '@/path/curriculum';
import {
  challengeCredit,
  clearsBar,
  earlierPlacement,
  placeFromRulesCheck,
  placeLearner,
  scoreUnit,
  unitLabel,
  type Placement,
  type UnitScore,
} from './placement';
import {
  PLACEMENT_ROUNDS,
  RULES_CHECK_SIZE,
  RUNG_SIZE,
  nextRung,
  type PlacementRung,
  type RungOutcome,
} from './placementBank';
import { loadRulesCheck, loadRung, roundLesson } from './placementContent';
import { useOnboarding } from './store';

/**
 * The placement test and the rules check (PRD 8.1 F-ON-5).
 *
 * WHAT THIS FILE DOES AND DOES NOT DECIDE. It sequences rounds, scores them and
 * commits the result. It decides nothing about WHERE the learner lands: that is
 * `placement.ts`, a pure function with its own tests, and this route only hands
 * it the scores and renders what comes back. The two are deliberately separable,
 * because the placement rule is worth checking at its edges and a rule that can
 * only be reached by answering twelve chess questions is a rule nobody checks.
 *
 * HOW THE RESULT REACHES PROGRESS. Through the existing append-only log and
 * nothing else. Each round appends one `challenge_attempted` per challenge, as a
 * checkpoint attempt does, with `context: 'placement'`. The placement itself
 * appends one `unit_tested_out` per unit before the placement point — the same
 * event a learner already appends by passing a checkpoint early — so
 * `reduceProgress` marks those units `passed` and `testedOut`, `pathNodes` reads
 * them exactly as it reads a tested-out unit today, and the learning rank counts
 * them as passed. There is no placement event type, no second store and no
 * second notion of "passed"; F-ON-5's "marked tested out and count as passed" is
 * satisfied by a mechanism that already existed.
 *
 * WHY THE COMMIT IS A TAP AND NOT THE END OF THE LAST ROUND. F-ON-5 gives the
 * result screen a "start earlier" option, so the placement is a proposal until
 * the learner accepts it. Writing the tested-out events at the end of the last
 * round would mean writing them again after every press of "start earlier",
 * and an append-only log cannot take one back.
 */

type Stage =
  | { kind: 'intro' }
  | { kind: 'loading' }
  | { kind: 'round'; round: number; unit: string; challenges: Challenge[]; lesson: Lesson }
  | { kind: 'result'; placement: Placement }
  /** The manifest named a unit whose bank will not load. */
  | { kind: 'unavailable' };

export function PlacementRoute() {
  const nav = useNavigate();
  const level = useOnboarding((s) => s.level);
  const markPlaced = useOnboarding((s) => s.markPlaced);
  const append = useProgress((s) => s.append);

  /* F-ON-5: "I know the rules" runs the five-challenge rules check instead. */
  const rulesCheck = level === 'know_rules';

  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [outcomes, setOutcomes] = useState<RungOutcome[]>([]);
  const [scores, setScores] = useState<UnitScore[]>([]);
  const [committing, setCommitting] = useState(false);

  const toToday = useCallback(() => {
    void nav('/', { replace: true });
  }, [nav]);

  /** Load and open the rung the adaptive rule asks for next, or show the result. */
  const openRound = useCallback(
    (done: RungOutcome[], gathered: UnitScore[]) => {
      const rung: PlacementRung | null = nextRung(done);
      if (!rung) {
        setStage({ kind: 'result', placement: placeLearner(gathered) });
        return;
      }
      setStage({ kind: 'loading' });
      loadRung(rung)
        .then((challenges) => {
          const round = done.length + 1;
          setStage({
            kind: 'round',
            round,
            unit: rung.unit,
            challenges,
            lesson: roundLesson(
              `placement.${rung.unit}`,
              `Round ${round}`,
              challenges,
              'Round done.',
            ),
          });
        })
        .catch(() => {
          setStage({ kind: 'unavailable' });
        });
    },
    [],
  );

  /** F-ON-5's five-challenge rules check: one round over three units. */
  const openRulesCheck = useCallback(() => {
    setStage({ kind: 'loading' });
    loadRulesCheck()
      .then((challenges) => {
        setStage({
          kind: 'round',
          round: 1,
          unit: 'rules',
          challenges,
          lesson: roundLesson('placement.rules', 'Rules check', challenges, 'Rules check done.'),
        });
      })
      .catch(() => {
        setStage({ kind: 'unavailable' });
      });
  }, []);

  /**
   * One finished round: bank the attempts, score the rung, and go on.
   *
   * The attempts are appended here rather than at the commit because they are a
   * record of work the learner actually did, and a learner who answers nine
   * questions and closes the app did that work whether or not they ever accept a
   * placement. The tested-out events are the opposite kind of fact and are
   * written only on the commit below.
   */
  const finishRound = useCallback(
    async (unit: string, challenges: Challenge[], o: LessonOutcome) => {
      for (const [challengeId, r] of Object.entries(o.results)) {
        await append({
          type: 'challenge_attempted',
          lessonId: unit,
          challengeId,
          correct: r.correct,
          hints: r.hints,
          misses: r.misses,
          mastery: r.mastery,
          context: 'placement',
        });
      }
      if (unit === 'rules') {
        const scored = challenges.reduce((sum, c) => sum + challengeCredit(o.results[c.id]), 0);
        track('placement_round', { mode: 'rules', scored, asked: challenges.length });
        setStage({ kind: 'result', placement: placeFromRulesCheck(scored, challenges.length) });
        return;
      }
      const s = scoreUnit(unit, challenges, o.results);
      const gathered = [...scores, s];
      const done = [...outcomes, { unit, passed: clearsBar(s) }];
      setScores(gathered);
      setOutcomes(done);
      track('placement_round', { mode: 'ladder', unit, scored: s.scored, asked: s.asked });
      openRound(done, gathered);
    },
    [append, openRound, outcomes, scores],
  );

  /** Accept the placement: write it to the log, remember it, and leave. */
  const commit = useCallback(
    async (p: Placement) => {
      setCommitting(true);
      for (const unit of p.testedOut) await append({ type: 'unit_tested_out', unit });
      markPlaced(p.unit);
      track('placement_committed', {
        unit: p.unit,
        testedOut: p.testedOut.length,
        capped: p.capped,
        mode: rulesCheck ? 'rules' : 'ladder',
      });
      toToday();
    },
    [append, markPlaced, rulesCheck, toToday],
  );

  /* A learner who has already been placed has no business re-running the test:
     the tested-out events are in the log and appending a second set would say
     nothing new. Sent to Today rather than shown a refusal, because there is
     nothing here for them to decide. */
  const placedUnit = useOnboarding((s) => s.placedUnit);
  useEffect(() => {
    if (placedUnit) toToday();
  }, [placedUnit, toToday]);

  if (stage.kind === 'loading') return <section className="t-body p-4 text-content-dim">Loading…</section>;

  if (stage.kind === 'unavailable')
    return (
      <section className="p-4">
        <h1 className="t-display">The test is not available</h1>
        <p className="t-body mt-3">
          The placement questions could not be loaded. You can start at the beginning instead, and
          nothing is lost — passing a unit&rsquo;s checkpoint still lets you skip past it.
        </p>
        <button type="button" className={`${btn.primary} mt-6 w-full`} onClick={toToday}>
          Start at the beginning
        </button>
      </section>
    );

  if (stage.kind === 'intro')
    return (
      <section className="p-4">
        <h1 className="t-display">{rulesCheck ? 'A quick check on the rules' : 'Find your level'}</h1>
        <p className="t-index mt-1 text-content-dim">
          {rulesCheck
            ? `${RULES_CHECK_SIZE} questions`
            : `${PLACEMENT_ROUNDS * RUNG_SIZE} questions · ${PLACEMENT_ROUNDS} rounds of ${RUNG_SIZE}`}
        </p>
        <p className="t-body mt-4">
          {rulesCheck
            ? 'Five questions on the board, on check and mate, and on castling. Pass and you start past the rules; miss a few and you start with check, mate and draws.'
            : 'Rounds of three questions on positions you have not seen. Each round is chosen from how the last one went, so the questions get harder or easier as you go. No hints, and nothing here counts against you.'}
        </p>
        <button
          type="button"
          className={`${btn.primary} mt-6 w-full`}
          onClick={() => {
            track('placement_started', { mode: rulesCheck ? 'rules' : 'ladder' });
            if (rulesCheck) openRulesCheck();
            else openRound([], []);
          }}
        >
          Start
        </button>
        {/* Every screen in the modal frame owns a way out, and this one's way out
            is a real choice rather than a dismissal: a learner who would rather
            not be tested starts at the beginning. */}
        <button type="button" className={`${btn.secondary} mt-2 w-full`} onClick={toToday}>
          Skip and start at the beginning
        </button>
      </section>
    );

  if (stage.kind === 'round') {
    const { unit, challenges, lesson, round } = stage;
    return (
      <LessonPlayer
        /*
         * A NEW PLAYER PER ROUND, not the same one handed a new lesson.
         * `LessonPlayer` seeds its reducer in `useReducer`'s initialiser, which
         * runs on mount and never again, so re-rendering it with round 2's
         * lesson would run round 2's challenges against round 1's results,
         * scores and phase. The key is what makes each round its own run.
         */
        key={`${unit}#${round}`}
        lesson={lesson}
        // An assessment. Hints would make the score a measurement of the hint
        // button, exactly as they would in a checkpoint.
        hintsAllowed={false}
        // The card would repeat the intro screen, three more times.
        skipCard
        title={rulesCheck ? 'Rules check' : `Placement · round ${round}`}
        exitLabel={rulesCheck ? 'Exit the rules check' : 'Exit the placement test'}
        closeHeading={rulesCheck ? 'Rules check complete' : 'Round complete'}
        // Neutral on purpose: which screen comes next depends on a score this
        // button has not been told yet.
        closeAction="Continue"
        showXp={false}
        onExit={toToday}
        onComplete={(o) => {
          void finishRound(unit, challenges, o);
        }}
      />
    );
  }

  const { placement } = stage;
  const earlier = earlierPlacement(placement);
  const unit = unitById(placement.unit);
  const out = placement.testedOut;
  const firstOut = out[0];
  const lastOut = out[out.length - 1];
  return (
    <section className="p-4">
      <h1 className="t-display">Where you start</h1>
      <p className="t-index mt-1 text-content-dim">
        {out.length === 0
          ? 'Nothing tested out'
          : `${out.length} ${out.length === 1 ? 'unit' : 'units'} tested out`}
      </p>

      <p className="t-title mt-5">{unitLabel(placement.unit)}</p>
      {unit && (
        <p className="t-label mt-1 text-content-dim">
          {unit.lessons.length} {unit.lessons.length === 1 ? 'lesson' : 'lessons'}, starting with{' '}
          {unit.lessons[0]?.title ?? 'the first one'}
        </p>
      )}

      {/*
        F-ON-5: "says which unit and why, in one sentence". The sentence is the
        only thing on this screen that CHANGES — "start earlier" rewrites it —
        so it is the only thing that is a live region, and it is the text already
        on screen rather than a second announcement beside it. Same reasoning as
        the lesson player's challenge counter: give the words that change a live
        region, do not add words that compete with them.
      */}
      <p role="status" aria-live="polite" className="t-body mt-4">
        {placement.reason}
      </p>

      {firstOut && lastOut && (
        <p className="t-label mt-3 text-content-dim">
          {/* Agreement is done here rather than by splicing "is"/"are" into one
              sentence: the verb at the far end has to agree too, and a sentence
              assembled from two independent fragments reads "1.1 is marked
              tested out and count as passed" the first time one unit qualifies. */}
          {firstOut === lastOut
            ? `${unitLabel(firstOut)} is marked tested out and counts as passed.`
            : `${unitLabel(firstOut)} to ${unitLabel(lastOut)} are marked tested out and count as passed.`}{' '}
          Those lessons stay open if you want them.
        </p>
      )}

      <button
        type="button"
        className={`${btn.primary} mt-6 w-full`}
        disabled={committing}
        onClick={() => {
          void commit(placement);
        }}
      >
        Start at {placement.unit}
      </button>
      {/* F-ON-5: "moves the placement back by whole units". One press, one unit,
          and the control goes when there is nothing earlier to move to — rather
          than sitting there disabled, offering a move that does not exist. */}
      {earlier && (
        <button
          type="button"
          className={`${btn.secondary} mt-2 w-full`}
          disabled={committing}
          onClick={() => {
            setStage({ kind: 'result', placement: earlier });
            track('placement_start_earlier', { from: placement.unit, to: earlier.unit });
          }}
        >
          Start earlier, at {earlier.unit}
        </button>
      )}
    </section>
  );
}

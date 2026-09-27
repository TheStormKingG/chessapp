import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { btn } from '@/app/Button';
import { CoachBubble } from '@/coach';
import { destinationPath, onboardingStart } from './route';
import { useOnboarding } from './store';
import {
  GOAL_OPTIONS,
  LEVEL_DETAIL,
  LEVEL_OPTIONS,
  WHY_OPTIONS,
  type Option,
} from './types';

/**
 * The three questions onboarding asks (PRD 8.1 F-ON-1, F-ON-2, F-ON-3).
 *
 * One screen per question, one question per screen, in the PRD's own order, each
 * a route of its own so the browser's back button works and a reload does not
 * restart the flow (the answers are in the persisted store, not in component
 * state).
 *
 * THE VISUAL GRAMMAR IS THE HOUSE'S AND NOTHING HERE IS NEW. The frame is a
 * `p-4` section with a `t-display` title and a `t-index` step line, the options
 * are `btn.secondary` in a `fieldset` with a `legend` — the same set-of-options
 * shape `ChooseOpponent.tsx` uses — and the one action per screen is
 * `btn.primary` (DESIGN-SYSTEM.md §7: one per screen). `display-lg` is
 * deliberately not used: §3.2 spends it in exactly two places and this is
 * neither.
 *
 * WHAT CHOSEN LOOKS LIKE, AND WHY IT IS NOT A COLOUR. `ChooseOpponent` marks a
 * chosen option with `border-accent bg-accent-soft` alone. Hard constraint 6
 * (never let one channel be the only one) makes that a shape short, so a chosen
 * option here carries three channels: a `✓` glyph, the accent border and fill,
 * and `aria-pressed`, which is what a screen reader actually gets. Remove the
 * colour and the answer is still visible; remove the glyph and it is still
 * announced.
 *
 * WHY EVERY SCREEN CAN BE LEFT. `ModalTask`'s docblock requires every task in
 * its frame to own a dismiss control, and onboarding cannot use a bare ✕: Today
 * sends an unanswered learner back here, so a silent dismissal would be a loop
 * with no way out. The control is therefore a named one — "Skip setup" — which
 * records that the questions were asked and puts the learner on the path at the
 * beginning. F-ON-4's "sign-up is never required" is a rule about accounts;
 * this is the same courtesy applied to the questions.
 */

/** "Step 2 of 3" and the way out, above the question. */
function Frame({
  step,
  title,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const markAnswered = useOnboarding((s) => s.markAnswered);
  return (
    <section className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="t-display min-w-0 flex-1">{title}</h1>
        <button
          type="button"
          className={`${btn.quiet} shrink-0`}
          onClick={() => {
            // The questions were asked and declined. Recording that is what
            // stops Today asking them again, and the learner starts at the
            // beginning of the path with nothing assumed about them.
            markAnswered();
            void nav('/', { replace: true });
          }}
        >
          Skip setup
        </button>
      </div>
      <p className="t-index mt-1 text-content-dim">Step {step} of 3</p>
      {children}
    </section>
  );
}

/**
 * A single-choice list. `fieldset` and `legend` because these are a set of
 * options answering one question, which is what the pair is for, and what lets a
 * screen reader announce the question with each option rather than once at the
 * top.
 */
function Choices<T extends string | number>({
  legend,
  options,
  chosen,
  onChoose,
  detail,
}: {
  legend: string;
  options: readonly Option<T>[];
  chosen: T | null;
  onChoose: (v: T) => void;
  detail?: (v: T) => string;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="t-label">{legend}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {options.map((o) => {
          const on = chosen === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onChoose(o.value);
              }}
              // `items-start` only where an option carries a second line: a
              // centred glyph beside two lines of text reads as belonging to
              // neither of them.
              className={`${btn.secondary} w-full justify-start text-left ${detail ? 'items-start py-3' : ''} ${on ? 'border-accent bg-accent-soft' : ''}`}
            >
              {/* The glyph column is fixed width so the labels line up whether
                  or not one of them is chosen, and it is `aria-hidden` because
                  `aria-pressed` above already says the same thing in the one
                  channel a screen reader reads. */}
              <span aria-hidden="true" className="t-index mr-2 inline-block w-4 shrink-0 text-center">
                {on ? '✓' : ''}
              </span>
              <span className="min-w-0">
                {o.label}
                {detail && (
                  <span className="t-label mt-0.5 block font-normal text-content-dim">
                    {detail(o.value)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The primary action, plus the one line that says why it is not yet available. */
function Advance({ label, ready, onGo }: { label: string; ready: boolean; onGo: () => void }) {
  return (
    <>
      <button
        type="button"
        className={`${btn.primary} mt-6 w-full`}
        disabled={!ready}
        aria-describedby={ready ? undefined : 'advance-hint'}
        onClick={onGo}
      >
        {label}
      </button>
      {/* Visible as well as announced: a control that is off and does not say
          why is the failure this replaces. */}
      {!ready && (
        <p id="advance-hint" className="t-label mt-2 text-content-dim">
          Choose one to carry on.
        </p>
      )}
    </>
  );
}

/** F-ON-1. The screen that introduces the coach and asks "Why chess?". */
export function WhyScreen() {
  const nav = useNavigate();
  const why = useOnboarding((s) => s.why);
  const setWhy = useOnboarding((s) => s.setWhy);
  return (
    <Frame step={1} title="Why chess?">
      {/* F-ON-1: "introduces the coach". The coach's own grammar, not a card
          about them — `CoachBubble` is the one voice this app has. */}
      <CoachBubble text="I am your coach. I will be here for every lesson, every game and every mistake. Tell me what you are after and I will aim the lessons at it." />
      <Choices
        legend="Pick the one that fits best"
        options={WHY_OPTIONS}
        chosen={why}
        onChoose={setWhy}
      />
      <Advance
        label="Next"
        ready={why !== null}
        onGo={() => {
          void nav('/onboarding/level');
        }}
      />
    </Frame>
  );
}

/** F-ON-2. The level question, and what each answer means. */
export function LevelScreen() {
  const nav = useNavigate();
  const level = useOnboarding((s) => s.level);
  const setLevel = useOnboarding((s) => s.setLevel);
  return (
    <Frame step={2} title="How much chess have you played?">
      <Choices
        legend="Pick the one that fits best"
        options={LEVEL_OPTIONS}
        chosen={level}
        onChoose={setLevel}
        // The consequence of the answer, stated before it is given: three of the
        // four lead somewhere different, and a learner who cannot see that
        // cannot choose between them.
        detail={(v) => LEVEL_DETAIL[v]}
      />
      <Advance
        label="Next"
        ready={level !== null}
        onGo={() => {
          void nav('/onboarding/goal');
        }}
      />
    </Frame>
  );
}

/** F-ON-3. The daily goal, and the sentence that says what it is for. */
export function GoalScreen() {
  const nav = useNavigate();
  const dailyGoal = useOnboarding((s) => s.dailyGoal);
  const setDailyGoal = useOnboarding((s) => s.setDailyGoal);
  const level = useOnboarding((s) => s.level);
  const markAnswered = useOnboarding((s) => s.markAnswered);
  return (
    <Frame step={3} title="How long a day?">
      {/* F-ON-3: "explains that the daily plan will be sized to it". */}
      <p className="t-body mt-4">
        Each day&rsquo;s plan is cut to fit the time you pick, so finishing it is the whole of what a
        day asks of you.
      </p>
      <Choices
        legend="Minutes a day"
        options={GOAL_OPTIONS}
        chosen={dailyGoal}
        onChoose={setDailyGoal}
      />
      <Advance
        label="Start learning"
        // The goal always has a value, so this screen's action is always ready:
        // the default is a real answer, and forcing a tap to confirm it would be
        // a question the learner has already been shown the answer to.
        ready
        onGo={() => {
          markAnswered();
          /*
           * Where F-ON-2 sends this learner. F-IM-5 is now built, so
           * "I play online already" reaches the import screen rather than falling
           * straight through to the placement test: `onboardingStart` sends them
           * there to produce the game count, and the import screen then calls
           * `levelDestination` with the real number, which is what decides between
           * import and the placement-test fallback. See the import seam in
           * `route.ts` — that one expression is still the only place the decision
           * is made.
           */
          void nav(destinationPath(onboardingStart(level ?? 'new')), { replace: true });
        }}
      />
    </Frame>
  );
}

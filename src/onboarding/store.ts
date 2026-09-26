import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_DAILY_GOAL, type DailyGoal, type LearnerLevel, type WhyChess } from './types';

/**
 * The three onboarding answers, and whether the flow has been through
 * (PRD 8.1 F-ON-1, F-ON-2, F-ON-3).
 *
 * WHY THIS IS NOT IN THE EVENT LOG, AND WHAT IS. The learner's PROGRESS is an
 * append-only log of events in Dexie, projected by pure reducers (`data/`), and
 * the placement OUTCOME goes there like everything else: `PlacementRoute`
 * appends `unit_tested_out` for every unit before the placement point, which is
 * the same event a learner testing out of a checkpoint already appends, read by
 * the same reducer and rendered by the same path. There is no second progress
 * store and no second notion of "passed".
 *
 * These three answers are not progress. They are answers about the learner that
 * route content and notification copy, they are replaced rather than accumulated,
 * and they have no history worth projecting — the same shape `app/settings.ts`
 * already keeps in zustand + persist. They live in their own key rather than
 * inside `chessapp-settings` because they are a one-time profile rather than a
 * device preference, and because keeping them separate means a learner clearing
 * their preferences does not re-open onboarding.
 *
 * `placedUnit` is the one field that could be derived and is kept anyway: the
 * projection can say which units are tested out, but not whether that happened
 * because a placement test said so or because the learner tested out of a
 * checkpoint by hand. The difference decides whether onboarding still owes the
 * learner a placement test, which is a question about the flow, not about
 * progress.
 */
export interface OnboardingState {
  /** F-ON-1. Null until answered. */
  why: WhyChess | null;
  /** F-ON-2. Null until answered. */
  level: LearnerLevel | null;
  /** F-ON-3, in minutes. Always a value: the screen opens on the default. */
  dailyGoal: DailyGoal;
  /** When the three questions were answered, ISO. Null while the flow is unfinished. */
  answeredAt: string | null;
  /** The unit a placement run committed to, or null if none has. */
  placedUnit: string | null;
  setWhy: (v: WhyChess) => void;
  setLevel: (v: LearnerLevel) => void;
  setDailyGoal: (v: DailyGoal) => void;
  /** Called once, when the third question is answered. */
  markAnswered: (now?: Date) => void;
  markPlaced: (unit: string) => void;
  /** Tests only: puts the store back to the state a new device is in. */
  reset: () => void;
}

export const ONBOARDING_STORAGE_KEY = 'chessapp-onboarding';

const EMPTY = {
  why: null,
  level: null,
  dailyGoal: DEFAULT_DAILY_GOAL,
  answeredAt: null,
  placedUnit: null,
} satisfies Partial<OnboardingState>;

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setWhy: (why) => set({ why }),
      setLevel: (level) => set({ level }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      markAnswered: (now = new Date()) => set({ answeredAt: now.toISOString() }),
      markPlaced: (placedUnit) => set({ placedUnit }),
      reset: () => set({ ...EMPTY }),
    }),
    { name: ONBOARDING_STORAGE_KEY },
  ),
);

/**
 * Whether the three questions have been answered.
 *
 * This and not `placedUnit` is what gates the redirect from Today: a learner who
 * answered the questions and then left the placement test has been through
 * onboarding, and sending them back to question one would be a loop they cannot
 * leave. What they are still owed is the test, which Today offers instead.
 */
export function onboardingAnswered(s: Pick<OnboardingState, 'answeredAt'>): boolean {
  return s.answeredAt !== null;
}

import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Shell } from './Shell';
import { ModalTask } from './ModalTask';
import { useProgress } from '@/data';
import { OnboardingRoutes } from '@/onboarding/OnboardingRoutes';
import { onboardingAnswered, useOnboarding } from '@/onboarding/store';
import { TodayScreen } from '@/screens/TodayScreen';
import { ProgressScreen } from '@/screens/ProgressScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { LicencesScreen } from '@/screens/LicencesScreen';
import { NotFoundScreen } from '@/screens/NotFoundScreen';
import { PathScreen } from '@/path/PathScreen';
import { LessonRoute } from '@/path/LessonRoute';
import { CheckpointRoute } from '@/checkpoint/CheckpointRoute';
import { ChooseOpponent } from '@/play/ChooseOpponent';
import { PlayScreen } from '@/play/PlayScreen';
import { TailoredSessionScreen } from '@/tailored';
import { ReviewScreen } from '@/review';
import { PuzzlesHomeRoute } from '@/puzzles/PuzzlesHomeRoute';
import { PracticeHomeRoute } from '@/practice/PracticeHomeRoute';

/**
 * The four solving routes are the app's only React code split (PRD 11, the
 * 300 KiB shell budget).
 *
 * They are 4.9 KiB gzipped of screens, session machinery and pack parsing that
 * a learner who never opens the Puzzles tab paid for on first paint. All four
 * name the SAME module, so they are one chunk and not four: opening any puzzle
 * fetches the others' code too, which is right — a learner who solves one
 * solves another, and four round trips to save nothing is worse.
 *
 * The puzzles HOME is imported statically above and must stay that way. It is
 * a tab in the shell, so it is on the first-paint graph whatever we do, and
 * `src/puzzles/index.ts` deliberately stops re-exporting the four so that
 * importing the home cannot drag them back in.
 */
const RatedRoute = lazy(() => import('@/puzzles/PuzzleRoutes').then((m) => ({ default: m.RatedRoute })));
const ThemedRoute = lazy(() => import('@/puzzles/PuzzleRoutes').then((m) => ({ default: m.ThemedRoute })));
const DailyRoute = lazy(() => import('@/puzzles/PuzzleRoutes').then((m) => ({ default: m.DailyRoute })));
const FixRoute = lazy(() => import('@/puzzles/PuzzleRoutes').then((m) => ({ default: m.FixRoute })));

/**
 * The import feature, split out for the same reason as the solving routes (PRD 11,
 * the 300 KiB shell budget). Both routes name the SAME module so they are one
 * chunk: a learner who opens the list is the learner who imports.
 *
 * It is a browsable section rather than a modal task -- a learner reads the list,
 * leaves, comes back -- so both sit in `ShellRoutes` below, inside the tab shell.
 */
/**
 * PRD §8.7's Practice feature, split for the reason above (PRD §11, the 300 KiB
 * shell budget).
 *
 * The Practice HOME is imported statically: it is the tab, so it is on the
 * first-paint graph whatever we do. These three are not, and they are the
 * expensive half — the drill list reads the results store, the drill runner pulls
 * the lesson loader and the engine gate, and the vision trainer pulls chess.js and
 * a board. `src/practice/index.ts` deliberately does not re-export any of them, so
 * importing the home cannot drag them back in.
 *
 * The two DRILL routes name the same module, so they are one chunk and not two: a
 * learner who opens the list is the learner who opens a drill. The vision trainer
 * is its own module because the two share nothing — a learner doing 30-second
 * coordinate drills is not loading the engine.
 */
const DrillsRoute = lazy(() => import('@/practice/DrillsScreen').then((m) => ({ default: m.DrillsScreen })));
const DrillRunRoute = lazy(() => import('@/practice/DrillRoute').then((m) => ({ default: m.DrillRoute })));
const VisionRoute = lazy(() => import('@/vision/VisionTrainer').then((m) => ({ default: m.VisionTrainer })));

const ImportScreenRoute = lazy(() => import('@/import').then((m) => ({ default: m.ImportScreen })));
const ReviewListRoute = lazy(() => import('@/import').then((m) => ({ default: m.ReviewListScreen })));

/**
 * A solving route inside its modal frame.
 *
 * The `Suspense` boundary is INSIDE `ModalTask`, never around it. That is the
 * whole of what route-level splitting could have broken here: the invariant
 * routes.test.tsx pins is that a solving route puts a `<main>` on the page and
 * no navigation landmark, and a boundary placed outside the frame would take
 * the `<main>` away for as long as the chunk is in flight — a frameless flash
 * on a slow connection and a tree that fails the test outright.
 *
 * The fallback is NOTHING, deliberately. The chunk is one small file, and
 * `globPatterns` in vite.config.ts precaches every emitted .js, so on every
 * visit after the first it comes off the service worker's cache and resolves
 * within a frame. A placeholder there would be a flash rather than
 * information. Every one of these routes then renders its OWN `Loading…`
 * interstitial while it reads Dexie and the pack — the app's existing, slower
 * and genuinely asynchronous wait (`LessonRoute` does the same). Showing a
 * second, different wait for a few milliseconds before it would be two flashes
 * where the app already has one honest one.
 */
function SolvingTask({ children }: { children: ReactNode }) {
  return (
    <ModalTask>
      <Suspense fallback={null}>{children}</Suspense>
    </ModalTask>
  );
}

/**
 * Two presentations, decided here and nowhere else.
 *
 * The lesson, the checkpoint and the game in play are modal tasks and are
 * rendered in `ModalTask`, outside the tab shell (DESIGN-SYSTEM.md chunk B1).
 * Everything else is a browsable section of the app and is rendered in `Shell`.
 * Both branches put a `<main>` on the page, and the deep links keep working
 * because these are ordinary routes, not a presentation stacked on another
 * route's state: `/lesson/1.1.1` typed into the address bar renders the modal
 * task directly, and the back button leaves it the same way it entered.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/lesson/:id"
        element={
          <ModalTask>
            <LessonRoute />
          </ModalTask>
        }
      />
      <Route
        path="/checkpoint/:unit"
        element={
          <ModalTask>
            <CheckpointRoute />
          </ModalTask>
        }
      />
      {/* PRD F-TS-1. A modal task like the lesson it contains: a session is one thing
          the learner is doing, and the tab bar is not the way out of it. */}
      <Route
        path="/tailored"
        element={
          <ModalTask>
            <TailoredSessionScreen />
          </ModalTask>
        }
      />
      {/* F-PR-1's drill is a modal task like the lesson whose challenge it runs:
          one position, one goal, and the tab bar is not the way out of it. The
          drill LIST stays in the shell below, because a list is browsable — the
          same pair as /puzzles and /puzzles/rated. */}
      <Route
        path="/practice/drill/:lessonId/:challengeId"
        element={
          <SolvingTask>
            <DrillRunRoute />
          </SolvingTask>
        }
      />
      <Route
        path="/play/game"
        element={
          <ModalTask>
            <PlayScreen />
          </ModalTask>
        }
      />
      <Route
        path="/play/review/:gameId"
        element={
          <ModalTask>
            <ReviewScreen />
          </ModalTask>
        }
      />
      {/*
        Onboarding is a modal task like the others: one focused task, one way out,
        and no tab bar inviting a learner who has not started yet to browse five
        sections of an app they have not seen (PRD 8.1, DESIGN-SYSTEM.md B1).
        The splat is because onboarding owns three question screens and the
        placement test and routes between them itself.
      */}
      <Route
        path="/onboarding/*"
        element={
          <ModalTask>
            <OnboardingRoutes />
          </ModalTask>
        }
      />
      {/*
        Solving is a modal task, exactly as a lesson is (design spec 5.2):
        one focused task, one way out, and no tab bar inviting the learner
        away mid-puzzle. The Puzzles TAB itself stays in the shell below --
        that pair is what routes.test.tsx asserts, because moving the whole
        tab in here would satisfy "no navigation" and destroy the tab.

        Declared beside their siblings for consistency only. React Router 7
        ranks by specificity, not declaration order, so /puzzles/rated beats
        the splat wherever it sits.
      */}
      <Route
        path="/puzzles/rated"
        element={
          <SolvingTask>
            <RatedRoute />
          </SolvingTask>
        }
      />
      <Route
        path="/puzzles/themed"
        element={
          <SolvingTask>
            <ThemedRoute />
          </SolvingTask>
        }
      />
      <Route
        path="/puzzles/daily"
        element={
          <SolvingTask>
            <DailyRoute />
          </SolvingTask>
        }
      />
      <Route
        path="/puzzles/fix"
        element={
          <SolvingTask>
            <FixRoute />
          </SolvingTask>
        }
      />
      {/* The splat is what lets the shell's own routes be declared below it. */}
      <Route path="*" element={<ShellRoutes />} />
    </Routes>
  );
}

/**
 * F-ON-1: "The first screen introduces the coach and asks one question."
 *
 * So for a learner with no onboarding record AND no progress, `/` is the
 * coach's question rather than Today. Both conditions, not just the first:
 * anyone who was already learning before onboarding existed has events in the
 * log and no `chessapp-onboarding` key, and sending them back to question one
 * would interrupt a learner mid-path to ask how much chess they have played.
 *
 * The gate is `answeredAt`, not `placedUnit`: a learner who answered the three
 * questions and then left the placement test has been through onboarding, and
 * returning them to question one would be a loop they could not leave. What they
 * are still owed is the test, which Today offers them.
 */
function TodayOrOnboarding() {
  const answered = useOnboarding(onboardingAnswered);
  const everActive = useProgress((s) => s.progress.lastEventAt) !== null;
  if (!answered && !everActive) return <Navigate to="/onboarding" replace />;
  return <TodayScreen />;
}

function ShellRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<TodayOrOnboarding />} />
        <Route path="/path" element={<PathScreen />} />
        {/* F-PR-1's Practice tab. `/puzzles` below is unchanged and still
            routed: it is now reached from here rather than from the tab bar, so
            every deep link into it keeps working. */}
        <Route path="/practice" element={<PracticeHomeRoute />} />
        <Route
          path="/practice/drills"
          element={
            <Suspense fallback={null}>
              <DrillsRoute />
            </Suspense>
          }
        />
        {/* F-PR-2. Browsable rather than a modal task: a round is 30 seconds and
            the learner chooses a mode, plays, and chooses again on the same
            screen, so there is no single activity for a frame to wrap. */}
        <Route
          path="/practice/vision"
          element={
            <Suspense fallback={null}>
              <VisionRoute />
            </Suspense>
          }
        />
        {/* F-PZ-3 orders this screen by the number of mistakes waiting, so the
            route supplies the count the screen renders. */}
        <Route path="/puzzles" element={<PuzzlesHomeRoute />} />
        <Route path="/play" element={<ChooseOpponent />} />
        <Route path="/progress" element={<ProgressScreen />} />
        {/* F-IM-1's import screen, and F-IM-6's listing. `/play/review` is the
            list and `/play/review/:gameId` (declared above, in the modal task) is
            one review: the list is browsable, a review is a focused task. There is
            no Review TAB to hang the list off -- see the note at the top of
            src/import/ReviewListScreen.tsx. */}
        <Route
          path="/import"
          element={
            <Suspense fallback={null}>
              <ImportScreenRoute />
            </Suspense>
          }
        />
        <Route
          path="/play/review"
          element={
            <Suspense fallback={null}>
              <ReviewListRoute />
            </Suspense>
          }
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/licences" element={<LicencesScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Shell>
  );
}

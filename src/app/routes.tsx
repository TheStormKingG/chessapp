import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router';
import { Shell } from './Shell';
import { ModalTask } from './ModalTask';
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
import { ReviewScreen } from '@/review';
import { PuzzlesHomeRoute } from '@/puzzles/PuzzlesHomeRoute';

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

function ShellRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/path" element={<PathScreen />} />
        {/* F-PZ-3 orders this screen by the number of mistakes waiting, so the
            route supplies the count the screen renders. */}
        <Route path="/puzzles" element={<PuzzlesHomeRoute />} />
        <Route path="/play" element={<ChooseOpponent />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/licences" element={<LicencesScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Shell>
  );
}

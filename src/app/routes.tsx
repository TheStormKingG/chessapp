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
import { DailyRoute, FixRoute, PuzzlesHomeRoute, RatedRoute, ThemedRoute } from '@/puzzles';

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
          <ModalTask>
            <RatedRoute />
          </ModalTask>
        }
      />
      <Route
        path="/puzzles/themed"
        element={
          <ModalTask>
            <ThemedRoute />
          </ModalTask>
        }
      />
      <Route
        path="/puzzles/daily"
        element={
          <ModalTask>
            <DailyRoute />
          </ModalTask>
        }
      />
      <Route
        path="/puzzles/fix"
        element={
          <ModalTask>
            <FixRoute />
          </ModalTask>
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

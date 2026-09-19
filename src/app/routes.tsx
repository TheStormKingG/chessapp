import { Routes, Route } from 'react-router';
import { Shell } from './Shell';
import { ModalTask } from './ModalTask';
import { TodayScreen } from '@/screens/TodayScreen';
import { PuzzlesScreen } from '@/screens/PuzzlesScreen';
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
        <Route path="/puzzles" element={<PuzzlesScreen />} />
        <Route path="/play" element={<ChooseOpponent />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/licences" element={<LicencesScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Shell>
  );
}

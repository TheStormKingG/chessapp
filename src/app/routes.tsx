import { Routes, Route } from 'react-router';
import { Shell } from './Shell';
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

export function AppRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/path" element={<PathScreen />} />
        <Route path="/lesson/:id" element={<LessonRoute />} />
        <Route path="/checkpoint/:unit" element={<CheckpointRoute />} />
        <Route path="/puzzles" element={<PuzzlesScreen />} />
        <Route path="/play" element={<ChooseOpponent />} />
        <Route path="/play/game" element={<PlayScreen />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/licences" element={<LicencesScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Shell>
  );
}

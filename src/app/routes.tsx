import { Routes, Route } from 'react-router';
import { Shell } from './Shell';
import { TodayScreen } from '@/screens/TodayScreen';
import { PuzzlesScreen } from '@/screens/PuzzlesScreen';
import { ProgressScreen } from '@/screens/ProgressScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { PathScreen } from '@/path/PathScreen';
import { LessonRoute } from '@/path/LessonRoute';

export function AppRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/path" element={<PathScreen />} />
        <Route path="/lesson/:id" element={<LessonRoute />} />
        <Route path="/puzzles" element={<PuzzlesScreen />} />
        <Route path="/play" element={<div className="p-4">Play</div>} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </Shell>
  );
}

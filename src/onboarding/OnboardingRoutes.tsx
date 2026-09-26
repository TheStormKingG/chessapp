import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { GoalScreen, LevelScreen, WhyScreen } from './Questions';

/**
 * Onboarding's own routes, mounted under `/onboarding` (PRD 8.1).
 *
 * Three question screens and the placement test. The questions are imported
 * statically because they ARE the first paint for a new learner — code-splitting
 * the first screen behind a fetch would be the opposite of the section's own
 * purpose, a first success inside two minutes.
 *
 * The placement test is lazy, on the same reasoning `routes.tsx` gives for the
 * four solving routes. It pulls in `LessonPlayer`, the board and the challenge
 * views, and the learner reaches it at the earliest after three taps — which is
 * far more time than the chunk needs — while a returning learner, and any learner
 * who answers "new to chess", never fetches it at all.
 */
const PlacementRoute = lazy(() =>
  import('./PlacementRoute').then((m) => ({ default: m.PlacementRoute })),
);

export function OnboardingRoutes() {
  return (
    <Routes>
      <Route index element={<WhyScreen />} />
      <Route path="level" element={<LevelScreen />} />
      <Route path="goal" element={<GoalScreen />} />
      <Route
        path="placement"
        element={
          /* Fallback is nothing, for the reason `routes.tsx` records: the chunk
             is small and precached, and the route paints its own `Loading…`
             while it reads the checkpoint bank. Two waits where there is one
             honest one is two flashes. */
          <Suspense fallback={null}>
            <PlacementRoute />
          </Suspense>
        }
      />
      {/* Anything else under /onboarding is the first question. */}
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  );
}

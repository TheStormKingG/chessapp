import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isActivityRoute } from './activityRoutes';

/**
 * F-OF-5: a waiting service worker is announced, but the control that applies
 * it immediately is hidden inside a lesson, a checkpoint or a live game so an
 * update can never interrupt an activity. It applies on the next launch.
 */
export function UpdateNotice() {
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  const busy = isActivityRoute(pathname);
  return (
    <div
      role="status"
      className="t-label fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-accent-on"
    >
      <span>Update available. It will apply next time you open the app.</span>
      {!busy && (
        <button
          type="button"
          className="tap shrink-0 underline"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          Apply now
        </button>
      )}
    </div>
  );
}

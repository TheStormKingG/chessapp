import { useLocation } from 'react-router';
import { isActivityRoute } from './activityRoutes';
import { useAppUpdate } from './useAppUpdate';

/**
 * F-OF-5: "An update to the app shows an 'update available' notice and applies
 * on the next launch, never mid-lesson."
 *
 * The applying is done by `useAppUpdate`, at launch, without the learner having
 * to notice or click anything — a notice nobody acts on is how a person ends up
 * months behind. This component only reports what happened:
 *
 *  - after an automatic update, a quiet confirmation that the app changed, so
 *    the interface never shifts underneath someone unexplained;
 *  - while an update is held back because an activity is in progress, the
 *    "update available" notice the PRD asks for, which now states something
 *    true — it really will apply the next time the app starts.
 *
 * "Apply now" survives only as a shortcut outside an activity, never as the
 * mechanism, and never on `/lesson/*`, `/checkpoint/*` or `/play/game`.
 */
export function UpdateNotice() {
  const { pathname } = useLocation();
  const { justUpdated, pending, applyNow } = useAppUpdate();

  if (!justUpdated && !pending) return null;
  const busy = isActivityRoute(pathname);

  return (
    <div
      role="status"
      className="t-label fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-accent-on"
    >
      {justUpdated ? (
        <span>ChessApp updated to the latest version.</span>
      ) : (
        <span>Update available. It will apply the next time you open the app.</span>
      )}
      {pending && !busy && (
        <button type="button" className="tap shrink-0 underline" onClick={applyNow}>
          Apply now
        </button>
      )}
    </div>
  );
}

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
    /*
     * Anchored to the BOTTOM, not the top.
     *
     * `fixed top-0` put a full-bleed bar over the first thing on every screen
     * — on Today that is the `Today` heading, which it covered outright.
     * Found by looking at the deployed site on a returning client, which is
     * the only client that ever sees this component: it cannot appear without
     * an update having been applied, so no fresh session and no test fixture
     * renders it in its real context.
     *
     * Bottom-anchored above the tab bar is the app's existing convention for a
     * transient notice (`InstallPrompt` sits at the same `bottom-16`), so this
     * is the house pattern rather than a second one.
     *
     * It enters from below — the edge it is anchored to, and the edge it would
     * leave by. Animated because it appears UNANNOUNCED, after a reload the
     * learner did not ask for, and something arriving out of nowhere at the
     * edge of vision reads as a glitch; 240ms, ease-out, collapsed to 1ms by
     * the reduced-motion block in theme.css.
     */
    <div
      role="status"
      className="t-label n-panel n-lit fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-card bg-accent px-4 py-3 text-accent-on md:bottom-4"
      style={{ animation: 'rise-in var(--motion-screen) var(--ease-out) both' }}
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

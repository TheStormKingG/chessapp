import { isActivityRoute } from './activityRoutes';

/** Session-scoped marker read back after an automatic update reloads the page. */
export const UPDATE_APPLIED_KEY = 'chessapp:update-applied';

export type UpdateSituation = {
  /** A new service worker has installed and is waiting to take over. */
  waiting: boolean;
  /** The route the app is showing right now. */
  pathname: string;
  /**
   * True only while the app is still launching — before the learner has
   * navigated or started anything. Applying an update here is what F-OF-5
   * means by "applies on the next launch".
   */
  launching: boolean;
};

/**
 * F-OF-5: an update applies on the next launch and never mid-activity.
 *
 * A waiting worker is therefore taken at launch, automatically, so a returning
 * visitor is carried onto the new build without noticing or clicking anything.
 * Once the launch window has closed the worker is left waiting — swapping the
 * app then would interrupt whatever the learner has started, so it waits for
 * the launch after this one.
 */
export function shouldApplyUpdate({ waiting, pathname, launching }: UpdateSituation): boolean {
  return waiting && launching && !isActivityRoute(pathname);
}

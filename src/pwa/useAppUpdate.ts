import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { shouldApplyUpdate, UPDATE_APPLIED_KEY } from './updatePolicy';

/**
 * How often a running app asks the server whether a newer build exists.
 *
 * The browser only re-checks the worker script on a navigation, and this is a
 * single-page app: a session left open — or an installed PWA resumed from the
 * app switcher, which never navigates — would otherwise never discover a
 * deploy at all, and "applies on the next launch" would never come due.
 */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * How long after start-up an arriving update still counts as part of this
 * launch. The waiting worker is normally found within a few seconds of load;
 * past this window the learner is using the app, so the update is held for the
 * next launch rather than reloading the page underneath them (F-OF-5).
 */
export const LAUNCH_WINDOW_MS = 15_000;

function takeAppliedFlag(): boolean {
  try {
    if (sessionStorage.getItem(UPDATE_APPLIED_KEY) === null) return false;
    sessionStorage.removeItem(UPDATE_APPLIED_KEY);
    return true;
  } catch {
    return false;
  }
}

export type AppUpdate = {
  /** An update was applied automatically and this page is the new build. */
  justUpdated: boolean;
  /** A new build is downloaded and will be applied at the next launch. */
  pending: boolean;
  /** Take the waiting build now. Offered as a shortcut, never as the mechanism. */
  applyNow: () => void;
};

export function useAppUpdate(): AppUpdate {
  const { pathname } = useLocation();
  const [firstPath] = useState(pathname);
  const [launchWindowOpen, setLaunchWindowOpen] = useState(true);
  const [applied, setApplied] = useState(false);
  const [justUpdated] = useState(takeAppliedFlag);
  const registration = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (r) registration.current = r;
    },
  });

  // Keep asking for a new build: on an interval, and whenever a backgrounded
  // app is brought back to the front.
  useEffect(() => {
    const check = () => void registration.current?.update().catch(() => undefined);
    const timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // The launch window closes on a timer rather than by reading the clock during
  // render, and closes immediately if the learner navigates anywhere.
  useEffect(() => {
    const t = setTimeout(() => setLaunchWindowOpen(false), LAUNCH_WINDOW_MS);
    return () => clearTimeout(t);
  }, []);

  const launching = launchWindowOpen && pathname === firstPath;

  // Decided during render, not only in the effect below, so a notice offering
  // "Apply now" never flashes for an update that is already being taken.
  const applying = shouldApplyUpdate({ waiting: needRefresh, pathname, launching });

  useEffect(() => {
    if (!applying) return;
    try {
      sessionStorage.setItem(UPDATE_APPLIED_KEY, '1');
    } catch {
      // A refused storage quota must not stop the update itself.
    }
    void updateServiceWorker(true);
  }, [applying, updateServiceWorker]);

  const applyNow = useCallback(() => {
    setApplied(true);
    void updateServiceWorker(true);
  }, [updateServiceWorker]);

  return { justUpdated, pending: needRefresh && !applied && !applying, applyNow };
}

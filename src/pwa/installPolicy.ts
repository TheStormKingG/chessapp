/** F-ON-6: the install offer appears after the first completed lesson, at most once a week. */
export const DISMISS_KEY = 'chessapp.install.dismissedAt';
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * The clock is read once, when the module loads, so rendering stays pure: the
 * offer's eligibility must not change from one re-render to the next.
 */
export const SESSION_START = Date.now();

export function readDismissedAt(): number {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    // Private-mode storage can throw; treat it as "never dismissed".
    return 0;
  }
}

export function writeDismissedAt(now: number): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    // Nothing to do: the offer simply reappears next week's worth of sessions.
  }
}

/** Exactly one completed lesson, and no dismissal inside the last week. */
export function shouldOffer(lessonCount: number, now: number, dismissedAt = readDismissedAt()): boolean {
  if (lessonCount !== 1) return false;
  return now - dismissedAt >= WEEK_MS;
}

export function isIosSafari(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (!ios) return false;
  const standalone = (nav as Navigator & { standalone?: boolean }).standalone;
  return standalone !== true;
}

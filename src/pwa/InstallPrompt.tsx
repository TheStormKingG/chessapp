import { useCallback, useEffect, useState } from 'react';
import { useProgress } from '@/data';
import { track } from '@/analytics';
import { btn } from '@/app/Button';
import { SESSION_START, isIosSafari, shouldOffer, writeDismissedAt } from './installPolicy';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * F-ON-6: after the first completed lesson the app offers to install itself —
 * the native prompt where the browser supports it, an instruction sheet on iOS
 * Safari. Each benefit gets one line. A dismissal is remembered for a week.
 */
export function InstallPrompt() {
  const progress = useProgress((s) => s.progress);
  const lessonCount = Object.keys(progress.lessons).length;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setClosed(true);
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    writeDismissedAt(Date.now());
    setClosed(true);
    track('install_offer_dismissed');
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;
    track('install_offer_accepted');
    void (async () => {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      track('install_outcome', { outcome: choice.outcome });
      setDeferred(null);
      setClosed(true);
    })();
  }, [deferred]);

  const ios = isIosSafari();
  if (closed) return null;
  if (!shouldOffer(lessonCount, SESSION_START)) return null;
  if (!deferred && !ios) return null;

  return (
    <aside
      aria-label="Install ChessApp"
      className="t-label fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md rounded-lg border border-edge-strong bg-surface-raised p-4 shadow-lg md:bottom-4"
    >
      <h2 className="t-heading">Install ChessApp</h2>
      <ul className="mt-2 space-y-1 text-content-dim">
        <li>Lessons work offline, on the bus or with no signal.</li>
        <li>Reminders arrive when your next lesson is ready.</li>
      </ul>
      {ios && !deferred ? (
        <ol className="mt-3 space-y-1">
          <li>1. Tap Share, the square with an arrow, at the bottom of Safari.</li>
          <li>2. Scroll down and tap Add to Home Screen.</li>
          <li>3. Tap Add. ChessApp appears with your other apps.</li>
        </ol>
      ) : null}
      <div className="mt-3 flex gap-2">
        {deferred && (
          <button
            type="button"
            className={btn.primary}
            onClick={install}
          >
            Install
          </button>
        )}
        <button type="button" className={btn.secondary} onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  );
}

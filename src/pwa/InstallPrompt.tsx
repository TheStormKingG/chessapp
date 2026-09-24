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

  /*
   * NEUMORPHIC-DELTA.md §6 / chunk N2: the container takes the soft raise,
   * drops the `border-b-2 border-b-key-raised` second depth grammar, and
   * takes `--radius-card` (16px) instead of the 12px control radius.
   *
   * The 1px `--edge-strong` ring STAYS here and comes off the other cards
   * in this chunk, which is a real difference and not an inconsistency.
   * This panel is `fixed` and floats over whatever the learner was reading;
   * the cards elsewhere sit in the flow on the page ground. A raise is a
   * claim about depth, and depth over arbitrary content is exactly the case
   * the delta's own cost table calls out — `--n-dark` on `--surface` is
   * 1.72:1, so the shadow pair alone cannot be trusted to separate this
   * sheet from the text underneath it. The ring is therefore a border doing
   * work, and it clears the 3:1 that asks for: `--edge-strong` #64748B is
   * 3.76:1 on the page ground and 4.47:1 on a panel, whichever this happens
   * to land on. Two grammars would be a raise plus a KEY edge; a raise plus
   * a hairline boundary on a floating surface is one grammar plus a bound.
   */
  return (
    <aside
      aria-label="Install ChessApp"
      className="t-label fixed inset-x-4 bottom-20 z-20 mx-auto max-w-md rounded-card n-edge bg-panel p-4 n-panel n-lit md:bottom-4"
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

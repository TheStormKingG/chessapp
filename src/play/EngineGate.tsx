import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { EngineDownload } from '@/pwa';
import { engineIsReady, markEngineReady } from './engineReady';

/**
 * How much work has to be left before the learner is shown anything. The service
 * worker serves `/engine/` cache-first, so a warm visit resolves in a few
 * milliseconds; rendering the bar immediately would flash it for a file that was
 * never downloaded. The gate therefore keeps the download mounted but hidden
 * until this much time has passed without it finishing.
 */
export const ENGINE_GATE_DELAY_MS = 400;

/**
 * F-OF-2: the engine (about 1.8 MB) is fetched behind a visible progress bar the
 * first time a feature needs it, and the feature itself is not mounted until it
 * is ready — so nothing can offer a board that has no engine behind it.
 *
 * It lives in `src/play` rather than `src/pwa` because the PWA module is owned by
 * another change in flight; `PlayItOut` imports it from here for the same reason.
 */
export function EngineGate({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [ready, setReady] = useState(engineIsReady);
  const [past, setPast] = useState(false);

  useEffect(() => {
    // Not cleared on an early failure: an offline fetch rejects at once, and the
    // error line must still reach the learner when the threshold passes.
    const id = setTimeout(() => {
      setPast(true);
    }, ENGINE_GATE_DELAY_MS);
    return () => {
      clearTimeout(id);
    };
  }, []);

  const ready$ = useCallback(() => {
    markEngineReady();
    setReady(true);
    onReady?.();
  }, [onReady]);

  if (ready) return <>{children}</>;
  return (
    <div hidden={!past} className="p-4">
      <EngineDownload onReady={ready$} />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { reportError } from '@/analytics';
import { downloadEngine, ENGINE_ERROR, ENGINE_SIZE_LABEL } from './downloadEngine';

type Status = 'downloading' | 'ready' | 'error';

/**
 * F-OF-2: the first feature that needs the engine downloads it behind a visible
 * progress bar. F-ER-1/F-ER-3: a failure gets one plain line, the size, and a
 * retry. The second run is instant because the SW caches `/engine/` cache-first.
 */
export function EngineDownload({ onReady }: { onReady?: () => void }) {
  const [status, setStatus] = useState<Status>('downloading');
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    downloadEngine((p) => {
      if (!live) return;
      setLoaded(p.loaded);
      setTotal(p.total);
    })
      .then(() => {
        if (!live) return;
        setStatus('ready');
        onReady?.();
      })
      .catch((e: unknown) => {
        if (!live) return;
        reportError(e, { where: 'engine-download' });
        setStatus('error');
      });
    return () => {
      live = false;
    };
  }, [attempt, onReady]);

  const retry = useCallback(() => {
    setStatus('downloading');
    setLoaded(0);
    setTotal(0);
    setAttempt((a) => a + 1);
  }, []);

  if (status === 'ready') return null;

  if (status === 'error')
    return (
      <div role="alert" className="rounded-lg border border-edge-strong bg-surface-raised p-4 text-sm">
        <p>{ENGINE_ERROR}</p>
        <button type="button" className="tap mt-3 rounded-lg border border-edge-strong px-4 py-2" onClick={retry}>
          Retry
        </button>
      </div>
    );

  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div className="rounded-lg border border-edge-strong bg-surface-raised p-4 text-sm">
      <p id="engine-download-label">Getting the chess engine ready ({ENGINE_SIZE_LABEL}). This happens once.</p>
      <div
        role="progressbar"
        aria-labelledby="engine-download-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-edge"
      >
        <div className="h-full bg-accent transition-[width]" style={{ width: `${String(percent)}%` }} />
      </div>
      <p className="mt-2 text-content-dim">{percent} per cent</p>
    </div>
  );
}

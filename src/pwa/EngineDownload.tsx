import { useCallback, useEffect, useState } from 'react';
import { reportError } from '@/analytics';
import { downloadEngine, ENGINE_BYTES, ENGINE_ERROR, ENGINE_SIZE_LABEL } from './downloadEngine';

type Status = 'downloading' | 'ready' | 'error';

/** One decimal, in MB, from a byte count. The learner is shown the same unit the failure message quotes. */
function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * F-OF-2: the first feature that needs the engine downloads it behind a visible
 * progress bar. F-ER-1/F-ER-3: a failure gets one plain line, the size, and a
 * retry. The second run is instant because the SW caches `/engine/` cache-first.
 *
 * D2 -- DESIGN-SYSTEM.md M-5. This is the app's longest wait: 1.8 MB, measured
 * at up to 150 seconds on a throttled connection, and it lands at the exact
 * moment the learner has just committed to a game. `loading.md > Showing
 * progress` and `progress-indicators.md > Best practices` set four obligations,
 * and each one is answered by a specific thing on this screen:
 *
 *   1. "When possible, use a determinate progress indicator." The download
 *      drains the response body against `content-length`, so the bar is real
 *      bytes, not a guess -- and the byte count is written out beside the
 *      percentage, in `--font-index` with tabular numerals, so the numbers do
 *      not jitter as they climb. A learner deciding whether to wait can see how
 *      much is left, which is the whole point of the guideline.
 *   2. "Keep progress indicators moving so people know something is continuing
 *      to happen." A server is not obliged to declare a length, and this one
 *      does not always: `vite preview` streams the binary chunked, which left
 *      the bar with no denominator and pinned at nothing for the whole wait.
 *      The fallback denominator is `ENGINE_BYTES`, the real size of the
 *      artefact we ship, so the bar moves on every chunk in every environment
 *      rather than only where a header happens to be set. The one figure the
 *      bar never shows is a percentage it cannot support.
 *   3. "If it's helpful, display a description that provides additional context
 *      for the task. Avoid vague terms like loading." Hence a line that says
 *      what is being fetched, what it costs, and what it buys -- once, and then
 *      offline for good. That is also the answer to "make the wait feel like
 *      part of the product": the thing worth looking at during the wait is what
 *      the wait is for, in the coach's register, not an entertainment.
 *   4. "When it's feasible, let people halt processing." The gate is rendered
 *      inside a modal task that owns a dismiss control of its own (PlayScreen
 *      renders one for exactly this window). This component therefore adds no
 *      second way out and, crucially, nothing that could cover the first: it
 *      stays a block in the flow and never an overlay.
 *
 * NEUMORPHIC-DELTA.md chunks N2/N3. Both panels -- the wait and the failure --
 * are CONTAINERS and take the soft raise, `--radius-card` and no border: §3.1
 * defines `--edge-strong` as "every control border" and neither panel is a
 * control. The Retry button inside the failure panel is one, and keeps its edge.
 *
 * The progress track is the other half of the grammar and the reason this file
 * is not just another card. A raise says "this sits above the ground"; a groove
 * says "this is cut into it". A meter is a well that fills, so the track takes
 * `--shadow-inset-soft` over `--track` #CFD6E0 rather than the raise, and rather
 * than the flat `--edge` fill it used to carry. If everything is raised, nothing
 * is, and this is the file where the app says which is which.
 *
 * Nothing structural moved with any of it. The bar keeps `role="progressbar"`,
 * its `aria-labelledby`, and the DETERMINATE `aria-valuenow` that an earlier
 * pass fixed after the bar sat at zero for up to 150 seconds on a chunked
 * response: obligation 1 above is a semantic guarantee, not a paint, and a
 * presentation chunk may not spend it.
 *
 * Every colour is a token, and the app now has ONE appearance (§4), so the
 * paired light/dark figures this comment used to carry are gone with the
 * appearance rather than left to rot. Re-derived against the new ground with
 * the WCAG formula rather than re-copied (observation 0113): `--content`
 * #0F172B on `--surface-raised` #F6F8FA is **16.75:1**, `--content-dim`
 * #475569 on it is **7.12:1**, and the bar's `--accent` fill on its `--track`
 * is **5.06:1**. The percentage is never the sole carrier of anything -- the
 * bar, the bytes and `aria-valuenow` all say it too.
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
      <div role="alert" className="n-panel n-edge rounded-card bg-panel p-4">
        <p className="text-[1.0625rem] leading-[1.625rem] text-content">{ENGINE_ERROR}</p>
        <button
          type="button"
          className="tap mt-3 rounded-control border border-edge-strong px-4 text-[0.9375rem] font-medium text-content"
          onClick={retry}
        >
          Retry
        </button>
      </div>
    );

  // The denominator, in order of trust: what the server declared, then the size
  // of the artefact we shipped, then -- if the file has somehow outgrown that --
  // what has actually arrived, so the bar can never claim more than 100 per cent
  // or go backwards.
  const expected = total > 0 ? total : Math.max(ENGINE_BYTES, loaded);
  const percent = Math.min(100, Math.round((loaded / expected) * 100));
  return (
    <div className="n-panel n-edge rounded-card bg-panel p-4">
      <p id="engine-download-label" className="text-[1.0625rem] leading-[1.625rem] font-semibold text-content">
        Getting your opponent ready
      </p>
      <p className="mt-1 text-[0.9375rem] leading-[1.375rem] text-content-dim">
        The chess engine is {ENGINE_SIZE_LABEL}, and it downloads once. After this it lives on your device, so every
        game, hint and threat check works with no connection at all.
      </p>
      <div
        role="progressbar"
        aria-labelledby="engine-download-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="n-inset-soft mt-4 h-2.5 w-full overflow-hidden rounded-control bg-track"
      >
        {/*
          The fill. `--accent` #12614A on `--track` #CFD6E0 is 5.06:1, re-derived
          with the WCAG formula rather than copied from the delta's table, which
          it reproduces exactly. A meter's fill needs 3:1 as a non-text mark and
          this clears the 4.5 a piece of TEXT would need, so the bar survives
          being the only thing on screen a learner is looking at. It is never the
          sole carrier of anything in any case: the percentage, the byte count
          and `aria-valuenow` all say the same number.

          The fill sits INSIDE the groove and paints over it. An inset box-shadow
          renders above its element's background and below its children, so the
          pressed edge shows in the empty part of the track and is covered as the
          bar climbs -- which is what a well being filled looks like, and is why
          the groove goes on the track and not on the fill.
        */}
        <div
          className="h-full bg-accent transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      {/*
        The numbers, in the index face with tabular figures so the digits do not
        jitter as they climb. Bytes AND a percentage: the percentage answers
        "how far", the byte count answers "how much is this costing me", and on
        a metered connection that is the more useful of the two.
      */}
      <p className="mt-2 font-index text-[0.9375rem] leading-5 tabular-nums text-content-dim">
        {mb(loaded)} of {mb(expected)} · {percent} per cent
      </p>
    </div>
  );
}

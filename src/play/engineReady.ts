/**
 * Whether the engine binary has already been fetched in this session. The
 * service worker caches `/engine/` cache-first, so a re-mounted feature (a
 * retried drill, a second game) must not re-run the download UI for a file that
 * is already on the device. Module state, not a store: it is a fact about this
 * page load and nothing renders off it directly.
 */
let ready = false;

export function engineIsReady(): boolean {
  return ready;
}

export function markEngineReady(): void {
  ready = true;
}

/** Tests only: a fresh page load. */
export function resetEngineReady(): void {
  ready = false;
}

/** The Stockfish wasm binary, served from `public/engine/` and cached by the SW. */
export const ENGINE_WASM = 'engine/stockfish-19-lite-single.wasm';
/**
 * The binary's real on-disk size. It is a build artefact we ship, so we know it
 * exactly -- which matters because a server is not obliged to declare it.
 * `vite preview` and some CDNs send the body chunked with no `content-length`,
 * and a progress bar with no denominator sits at nothing for up to 150 seconds.
 * D2 falls back to this figure so the wait stays determinate, which is what
 * `progress-indicators.md > Best practices` asks for: "when possible, use a
 * determinate progress indicator", and "be as accurate as possible". A declared
 * `content-length` still wins when the server sends one.
 */
export const ENGINE_BYTES = 1_787_571;
/** Approximate on-disk size, quoted to the learner when a download fails (F-ER-3). */
export const ENGINE_SIZE_LABEL = '1.8 MB';
export const ENGINE_ERROR = `Could not download the engine (${ENGINE_SIZE_LABEL}). Check your connection and retry.`;

export function engineUrl(): string {
  return `${import.meta.env.BASE_URL}${ENGINE_WASM}`;
}

export interface Progress {
  /** Bytes read so far. */
  loaded: number;
  /** Bytes expected from `content-length`, or 0 when the server does not say. */
  total: number;
}

/**
 * Fetches the engine binary and reports real progress against `content-length`
 * by draining the response body through a stream reader. The service worker
 * caches `/engine/` cache-first, so a second call is served from the cache and
 * completes without touching the network.
 */
export async function downloadEngine(
  onProgress: (p: Progress) => void,
  fetchImpl: typeof fetch = fetch,
  url: string = engineUrl(),
): Promise<number> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Engine download failed: HTTP ${String(res.status)}`);
  const header = res.headers.get('content-length');
  const total = header ? Number(header) : 0;
  const body = res.body;
  if (!body) {
    const buf = await res.arrayBuffer();
    onProgress({ loaded: buf.byteLength, total: total || buf.byteLength });
    return buf.byteLength;
  }
  const reader = body.getReader();
  let loaded = 0;
  onProgress({ loaded: 0, total });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    onProgress({ loaded, total });
  }
  return loaded;
}

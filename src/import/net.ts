/**
 * The network seam for import, and the rate limiting F-IM-7 requires.
 *
 * ── WHY THERE IS NO PROXY ────────────────────────────────────────────────────
 *
 * F-IM-1 says chess.com games are fetched "through the app's import proxy". This
 * app has no server: it is a static PWA and the only backend is Supabase, for
 * auth and sync. A proxy would be new infrastructure.
 *
 * It is not needed. Measured on 2026-09-26, by curl for the sent headers and by
 * a real `fetch` from a page origin for what the browser enforces:
 *
 *   api.chess.com  /pub/player/{u}/games/archives      200, `access-control-allow-origin: *`,
 *                  /pub/player/{u}/games/{yyyy}/{mm}   body readable from a page.
 *                  A missing user returns a readable 404 JSON body carrying a
 *                  message. An OPTIONS preflight, however, returns 403 — so any
 *                  request carrying a non-safelisted header fails outright with
 *                  `TypeError: Failed to fetch`. That is the one real constraint
 *                  and it is why `ImportFetch` below takes no arbitrary headers.
 *
 *   lichess.org    `access-control-allow-origin: *` on every response observed,
 *                  including 404s and 429s, plus explicit
 *                  `access-control-allow-headers` naming Origin, Authorization,
 *                  If-Modified-Since, Cache-Control and Content-Type. An
 *                  `Accept` header is safelisted and works.
 *
 * So the browser can read both hosts directly and the proxy's CORS job does not
 * exist. Its other two stated jobs — respecting rate limits and caching monthly
 * archives — are real, and are done here and in ./cache.ts, on the device.
 *
 * Everything that reaches either host goes through `ImportFetch`. If a proxy is
 * ever stood up, it is the only thing that changes.
 */

/**
 * THE NETWORK SEAM. One function type, one place to substitute.
 *
 * `headers` is deliberately narrow: only CORS-safelisted request headers may be
 * sent, because api.chess.com answers OPTIONS with 403 and so a preflighted
 * request to it can never succeed. `Accept` is safelisted whatever its value,
 * which is why the Lichess ndjson request works; `Authorization` and any
 * `X-*` header would not.
 */
export type ImportFetch = (url: string, init?: { headers?: { Accept: string } }) => Promise<Response>;

/** F-IM-1: chess.com archives are read "one request at a time". */
export const CHESSCOM_MIN_GAP_MS = 1_100;
/** Lichess answers a second concurrent request with 429; one at a time, spaced. */
export const LICHESS_MIN_GAP_MS = 1_100;
/**
 * What to wait after a 429.
 *
 * Lichess's own guidance for its API is to wait a full minute after a 429 before
 * trying again, and its message ("Please only run 1 request(s) at a time") was
 * observed on 2026-09-26 to persist across a nine-second gap, so a short retry
 * is not merely impolite, it does not work.
 */
export const RATE_LIMIT_WAIT_MS = 60_000;

export interface Clock {
  now: () => number;
  /** Injected so tests never wait. Real callers pass a setTimeout wrapper. */
  delay: (ms: number) => Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  delay: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

/**
 * Serialises requests and keeps a minimum gap between them.
 *
 * Serial rather than concurrent-with-a-limit because both sites ask for exactly
 * one request at a time, and because the gap is only meaningful if nothing can
 * slip between two requests to consume it.
 */
export class Throttle {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStartedAt: number | null = null;

  constructor(
    private readonly minGapMs: number,
    private readonly clock: Clock,
  ) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const queued = this.tail.then(async () => {
      const last = this.lastStartedAt;
      if (last !== null) {
        const waited = this.clock.now() - last;
        if (waited < this.minGapMs) await this.clock.delay(this.minGapMs - waited);
      }
      this.lastStartedAt = this.clock.now();
      return fn();
    });
    // The chain must not break on a rejection, or one failed request wedges
    // every later one. The tail swallows; the caller still sees the rejection.
    this.tail = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }
}

/** What a single HTTP attempt amounted to, before any body is interpreted. */
export type Attempt =
  | { kind: 'ok'; response: Response }
  | { kind: 'not-found'; body: string }
  | { kind: 'rate-limited'; retryAfterMs: number }
  | { kind: 'unreachable'; detail: string };

/**
 * One request, classified.
 *
 * A thrown `TypeError` is the browser refusing the request — offline, DNS,
 * or a CORS rejection — and is reported as unreachable rather than as a status,
 * because there is no status to report. This is the shape a preflighted request
 * to api.chess.com produces, which is why `ImportFetch` cannot send one.
 */
export async function attempt(fetchImpl: ImportFetch, url: string, accept?: string): Promise<Attempt> {
  let response: Response;
  try {
    response = await fetchImpl(url, accept === undefined ? undefined : { headers: { Accept: accept } });
  } catch (e) {
    return { kind: 'unreachable', detail: e instanceof Error ? e.message : String(e) };
  }
  if (response.status === 429) {
    const header = response.headers.get('retry-after');
    const seconds = header === null ? NaN : Number(header);
    return {
      kind: 'rate-limited',
      retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RATE_LIMIT_WAIT_MS,
    };
  }
  if (response.status === 404 || response.status === 403 || response.status === 410) {
    // 403 is grouped here on evidence: api.chess.com answers a missing player
    // with 404 and a JSON message to a browser, but was observed answering the
    // same path with 403 and an HTML body to a non-browser client. Neither is a
    // reachable resource, and telling the two apart would be a claim about which
    // client the learner is using.
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '';
    }
    return { kind: 'not-found', body };
  }
  if (!response.ok) {
    return { kind: 'unreachable', detail: `HTTP ${String(response.status)}` };
  }
  return { kind: 'ok', response };
}

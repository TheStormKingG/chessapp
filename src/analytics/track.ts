/**
 * Analytics adapter (spec 4.13). A console sink in development, a no-op in
 * production until real keys exist; `setSink` swaps in a real provider later.
 */
export interface Sink {
  track(event: string, props?: Record<string, unknown>): void;
  error(e: unknown, context?: Record<string, unknown>): void;
}

const consoleSink: Sink = {
  track: (e, p) => {
    if (import.meta.env.DEV) console.debug('[track]', e, p);
  },
  error: (e, c) => {
    console.error('[error]', e, c);
  },
};

let sink: Sink = consoleSink;

export function setSink(s: Sink): void {
  sink = s;
}

export function track(event: string, props?: Record<string, unknown>): void {
  sink.track(event, props);
}

export function reportError(e: unknown, context?: Record<string, unknown>): void {
  sink.error(e, context);
}

import type { CheckpointBank, Lesson } from './types';

type Loader<T> = () => Promise<{ default: T }>;

const lessonModules = import.meta.glob<{ default: Lesson }>('/content/section-*/unit-*/lesson-*.json');
const checkpointModules = import.meta.glob<{ default: CheckpointBank }>('/content/section-*/unit-*/checkpoint.json');

function idFromPath(p: string): string {
  return p.match(/lesson-([\d.]+)\.json$/)![1]!;
}
function unitFromPath(p: string): string {
  return p.match(/unit-([\d.]+)\/checkpoint\.json$/)![1]!;
}

const byId = new Map<string, Loader<Lesson>>(
  Object.entries(lessonModules).map(([p, m]) => [idFromPath(p), m]),
);
const cpByUnit = new Map<string, Loader<CheckpointBank>>(
  Object.entries(checkpointModules).map(([p, m]) => [unitFromPath(p), m]),
);

function numeric(id: string): number[] {
  return id.split('.').map(Number);
}
function cmp(a: string, b: string): number {
  const x = numeric(a);
  const y = numeric(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function listLessons(unit: string): string[] {
  return [...byId.keys()].filter((id) => id.startsWith(`${unit}.`)).sort(cmp);
}

export function hasCheckpoint(unit: string): boolean {
  return cpByUnit.has(unit);
}

/*
 * ─── Recovering from a chunk that a deploy took away ────────────────────────
 *
 * A deploy replaces the whole artefact, so every chunk whose content changed
 * gets a new hash and the previous hash stops existing. A client still running
 * the PREVIOUS index -- which is every returning client until the service
 * worker hands over -- then asks for a URL that 404s, and the lesson renders
 * "could not be loaded" although nothing is wrong with the lesson.
 *
 * Observed live after a content release: every edited unit 404'd for returning
 * clients while the untouched units, whose hashes had not moved, loaded
 * normally. Smoke tests could not see it, because CI runs a fresh browser with
 * no worker -- the one client that cannot reach this state.
 *
 * Why the two obvious fixes do not work, both tried:
 *
 *  - Switching the worker to update immediately FAILS `sw-upgrade.spec.ts`,
 *    which protects a real guarantee: a learner is not swapped out of an
 *    activity mid-activity.
 *  - Simply reloading recovers nothing. The held worker serves the SAME stale
 *    index to the reload, so the chunk 404s again.
 *
 * So the recovery takes the waiting worker first, and only then does the page
 * come back on the new build. That does not weaken the guarantee above: it
 * fires on positive evidence that the running build is ALREADY broken for this
 * learner, which is the case the hold was never meant to protect. A held update
 * spares them a gratuitous interruption; it should not cost them a dead screen.
 *
 * The handler is injected rather than imported so the loader does not depend on
 * the PWA layer having mounted -- and if nothing registers one, the fallback
 * reload still runs.
 */
const RELOADED = 'chessapp:stale-chunk';
/** Long enough for a worker handover to reload the page on its own. */
const FALLBACK_MS = 2500;

let staleChunkHandler: (() => void) | null = null;
let recovering = false;

/** Registered by the PWA layer; takes the waiting worker and reloads. */
export function onStaleChunk(fn: () => void): void {
  staleChunkHandler = fn;
}

/** Test seam: clears the in-page memo, not the sessionStorage guard. */
export function __resetStaleChunkForTest(): void {
  recovering = false;
}

function isChunkLoadFailure(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(
    msg,
  );
}

function alreadyRecovered(): boolean {
  try {
    return sessionStorage.getItem(RELOADED) === '1';
  } catch {
    // Blocked storage: treat as "already recovered" so the absence of a guard
    // can never produce a refresh loop.
    return true;
  }
}

export async function importWithRecovery<T>(load: () => Promise<{ default: T }>): Promise<T> {
  try {
    return (await load()).default;
  } catch (e) {
    if (!isChunkLoadFailure(e) || recovering || alreadyRecovered()) throw e;
    recovering = true;
    try {
      sessionStorage.setItem(RELOADED, '1');
    } catch {
      /* best-effort; `recovering` still stops a same-page loop */
    }
    staleChunkHandler?.();
    // If there was no waiting worker, nothing above reloads anything.
    setTimeout(() => {
      location.reload();
    }, FALLBACK_MS);
    // The page is going away. Never resolve, or the caller paints an error
    // state underneath a reload that is already in flight.
    return new Promise<T>(() => {
      /* intentionally pending */
    });
  }
}

export async function loadLesson(id: string): Promise<Lesson> {
  const m = byId.get(id);
  if (!m) throw new Error(`Unknown lesson ${id}`);
  return importWithRecovery(m);
}

export async function loadCheckpoint(unit: string): Promise<CheckpointBank> {
  const m = cpByUnit.get(unit);
  if (!m) throw new Error(`Unknown checkpoint ${unit}`);
  return importWithRecovery(m);
}

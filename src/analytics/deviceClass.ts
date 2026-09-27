import { reportError } from './track';

/**
 * PRD F-ER-1: an engine failure "is reported to error tracking with the device
 * class".
 *
 * WHY A CLASS AND NOT A USER AGENT STRING. The clause exists because the two
 * failures it covers are not the same bug. "The engine failed to load" on a
 * desktop is a broken deploy — one artefact, everybody, fix the build. The same
 * line from a 2 GB Android phone is the engine's 16 MB hash table not fitting,
 * which no deploy fixes and which needs a smaller `Hash` value instead. A report
 * that cannot separate those two is a report nobody can act on, and a user agent
 * string does not separate them: it names the browser, not the memory.
 *
 * WHAT THE BROWSER ACTUALLY TELLS US. Two signals, and both are optional:
 *
 *   `navigator.deviceMemory`   GB, rounded DOWN to a power of two and capped at
 *                              8 by the Device Memory spec, so a 4 GB phone and
 *                              a 6 GB phone both report 4, and a 64 GB desktop
 *                              reports 8. Chromium only; Safari and Firefox
 *                              leave it undefined as a fingerprinting surface.
 *   `navigator.hardwareConcurrency`  Logical cores. Widely available, but Safari
 *                              clamps it and a privacy build may lie.
 *
 * So the class is deliberately coarse — three buckets and an honest `unknown` —
 * and the RAW numbers travel beside it. The bucket is what you group a week of
 * errors by; the numbers are what you read once the group is interesting. Losing
 * the numbers to keep only the bucket would throw away the detail that makes the
 * report actionable, which is the mistake the bucket is there to avoid.
 *
 * `unknown` is a real answer, never a default to `mid`. A browser that withholds
 * both signals is a population worth being able to see, and folding it into the
 * middle bucket would hide it inside the largest one.
 */

/** Coarse enough to group a week of errors by, honest about not knowing. */
export type DeviceClass = 'low' | 'mid' | 'high' | 'unknown';

/** The Device Memory API, which is not in the DOM lib types. */
interface MemoryNavigator {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface DeviceProfile {
  deviceClass: DeviceClass;
  /** `navigator.deviceMemory` in GB, or null where the browser withholds it. */
  deviceMemoryGb: number | null;
  /** `navigator.hardwareConcurrency`, or null where the browser withholds it. */
  cores: number | null;
}

/**
 * The thresholds.
 *
 * `deviceMemory` is reported in powers of two, so the only values a browser can
 * send are 0.25, 0.5, 1, 2, 4 and 8. That makes 2 and 8 the only two boundaries
 * worth drawing: "2 or less" is every phone that cannot hold a 16 MB hash table
 * alongside a 1.8 MB wasm module and a board, and "8" is the spec's cap, which
 * means desktop-or-better and nothing finer.
 */
export const LOW_MEMORY_GB = 2;
export const HIGH_MEMORY_GB = 8;
/** Two cores is the floor at which a worker and the UI thread contend. */
export const LOW_CORES = 2;
export const HIGH_CORES = 8;

/**
 * Read the two signals and bucket them.
 *
 * Either signal alone is enough to classify: a browser that reports 1 GB and no
 * core count has still told us the thing that matters. Both withheld is
 * `unknown`.
 *
 * A signal that is present but not a usable number — 0 cores, a negative
 * memory, a NaN from a spoofing extension — is treated as withheld rather than
 * as a low-end device, because a fabricated value is not a measurement and
 * bucketing it would put a spoofed desktop in the bucket reserved for the phones
 * this clause exists to find.
 */
export function deviceProfile(nav: Navigator = navigator): DeviceProfile {
  const n = nav as Navigator & MemoryNavigator;
  const deviceMemoryGb = usable(n.deviceMemory);
  const cores = usable(n.hardwareConcurrency);
  return { deviceClass: classify(deviceMemoryGb, cores), deviceMemoryGb, cores };
}

function usable(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Low wins over high when the two signals disagree.
 *
 * A machine with 16 cores and 2 GB of addressable memory fails the way a small
 * device fails, and the failure this clause is reported against is an
 * out-of-memory one. Grouping it with the desktops would bury it.
 */
function classify(memoryGb: number | null, cores: number | null): DeviceClass {
  if (memoryGb === null && cores === null) return 'unknown';
  if ((memoryGb !== null && memoryGb <= LOW_MEMORY_GB) || (cores !== null && cores <= LOW_CORES)) return 'low';
  const memoryHigh = memoryGb !== null && memoryGb >= HIGH_MEMORY_GB;
  const coresHigh = cores !== null && cores >= HIGH_CORES;
  // High needs every signal the browser gave us to agree. One high signal beside
  // one middling one is a middling device.
  if (memoryGb === null) return coresHigh ? 'high' : 'mid';
  if (cores === null) return memoryHigh ? 'high' : 'mid';
  return memoryHigh && coresHigh ? 'high' : 'mid';
}

/**
 * Where an engine failure happened. A closed set, because "the device class" is
 * only useful grouped, and a free-text `where` fragments the groups.
 */
export type EngineFailureSite =
  | 'engine-download'
  | 'play-bot-move'
  | 'play-hint'
  | 'play-it-out-reply'
  | 'review:analyse'
  | 'import:analyse';

/**
 * F-ER-1's reporting clause, in one call.
 *
 * Every engine failure site funnels through here rather than calling
 * `reportError` with a hand-written context object, because the device class has
 * to be on ALL of them: a clause satisfied at four call sites and forgotten at
 * the fifth reads, in the error tracker, exactly like a device that withheld
 * both signals. One function is the difference between "this browser does not
 * say" and "this call site forgot to ask".
 */
export interface EngineFailureContext {
  /**
   * Anything else this site knows that would narrow the bug — the game whose
   * analysis died, say. Merged UNDER the device profile, so a caller passing a
   * key named `deviceClass` cannot overwrite the measured one with a guess.
   */
  extra?: Record<string, unknown>;
  /** Injectable so a test can state a device instead of inheriting the runner's. */
  nav?: Navigator;
}

export function reportEngineFailure(e: unknown, site: EngineFailureSite, ctx: EngineFailureContext = {}): void {
  reportError(e, { where: site, ...ctx.extra, ...deviceProfile(ctx.nav ?? navigator) });
}

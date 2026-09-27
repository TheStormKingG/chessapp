/**
 * `navigator.storage` — the two questions F-ER-3 and F-ER-6 need answered.
 *
 * ── F-ER-6 ───────────────────────────────────────────────────────────────────
 * > "If persistent storage is refused, the app continues and repeats the
 * > installation advice at the next natural moment."
 *
 * Nothing in this app asked for persistent storage before this file. That is the
 * whole of the gap: `persist()` appeared nowhere in `src/`, so there was no
 * refusal to react to, and every learner's progress sat in storage the browser
 * is free to evict under pressure — which for this app means the 1.8 MB engine,
 * the puzzle packs and the event log that IS the learner's progress.
 *
 * AND NOTHING CALLS `requestPersistence` YET EITHER. That is deliberate and it
 * is the honest limit of what this change does: the wrapper and the rule ship
 * with tests, so a refusal is handled correctly WHEN one happens, but until
 * something asks, one cannot happen. The reason for stopping here is this
 * codebase's own precedent. `onboarding/notifications.ts` refuses to raise the
 * notification prompt without a learner's tap, because "a notification
 * permission prompt is the least reversible thing this app can do to a learner".
 * `navigator.storage.persist()` has the same property in Firefox, where it
 * raises a persistent-storage permission prompt — and a denial there is
 * remembered. Chromium grants or refuses silently on an engagement heuristic, so
 * the same line of code is invisible in one browser and a modal in another.
 * Choosing the moment to spend that one prompt is a product decision about the
 * app's most interruptive surface, and an error-handling change is not where it
 * should be taken. F-ER-6 is therefore PARTLY met, not met, and this paragraph
 * is the reason rather than an omission.
 *
 * ── F-ER-3 ───────────────────────────────────────────────────────────────────
 * > "...the app says which pack failed AND HOW MUCH SPACE IT NEEDS..."
 *
 * "How much space it needs" is two numbers, not one: what the download costs,
 * and what the device has. The first is a constant we ship (see
 * `puzzles/packMessages.ts`); the second is `estimate()`, and it lives here
 * because it is the same API.
 *
 * ── WHY EVERY RETURN TYPE HAS A THIRD STATE ──────────────────────────────────
 * Both methods are absent or lie in browsers this app must work in. Firefox has
 * never shipped `estimate()`'s `usageDetails`; WebKit shipped `estimate()` but
 * reports a quota derived from free disk space that changes between two calls a
 * second apart; `persist()` on iOS Safari resolves `false` for a tab and can only
 * become true by adding the app to the home screen. A boolean would force each
 * of those into either "granted" or "refused", and "refused" is the one that
 * triggers advice. So both return an explicit third value, and a browser that
 * cannot answer is never reported as having said no.
 */

/** The Storage API, which TypeScript's DOM lib types only partly describes. */
interface StorageCapableNavigator {
  storage?: {
    persist?: () => Promise<boolean>;
    persisted?: () => Promise<boolean>;
    estimate?: () => Promise<{ usage?: number; quota?: number }>;
  };
}

export type PersistenceOutcome =
  /** The browser promised not to evict this origin's data without asking. */
  | 'granted'
  /**
   * The browser said no. THIS is the state F-ER-6 is about, and it is not an
   * error: Chromium refuses until the origin clears an engagement bar, and iOS
   * Safari refuses a tab that is not installed to the home screen. Both are
   * fixed by installing, which is why the remedy is the installation advice and
   * not an apology.
   */
  | 'refused'
  /**
   * The API is not there, or it threw. Distinct from `refused` on purpose: a
   * browser that was never asked has not declined, and treating silence as a no
   * would show installation advice to learners whose storage is already durable.
   */
  | 'unsupported';

/**
 * Ask for durable storage, once.
 *
 * `persisted()` is checked first: `persist()` re-prompts in some browsers and an
 * origin that already has the grant has nothing to gain from asking again.
 */
export async function requestPersistence(nav: Navigator = navigator): Promise<PersistenceOutcome> {
  const storage = (nav as Navigator & StorageCapableNavigator).storage;
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return 'granted';
    return (await storage.persist()) ? 'granted' : 'refused';
  } catch {
    // A SecurityError in a sandboxed frame, or a private window that throws on
    // the whole namespace. Not a refusal.
    return 'unsupported';
  }
}

export interface SpaceEstimate {
  /** Bytes this origin is using, or null where the browser will not say. */
  usedBytes: number | null;
  /** Bytes this origin may use in total, or null. */
  quotaBytes: number | null
  /**
   * `quota - usage`, or null when either side is unknown.
   *
   * Derived here rather than at each call site so that "we do not know" cannot
   * be arithmetic'd into a confident zero — `0 - 0 = 0` reads as "no space
   * left", which is the one wrong answer that would make the app tell a learner
   * with a half-empty phone to delete things.
   */
  freeBytes: number | null;
}

export async function estimateSpace(nav: Navigator = navigator): Promise<SpaceEstimate> {
  const unknown: SpaceEstimate = { usedBytes: null, quotaBytes: null, freeBytes: null };
  const storage = (nav as Navigator & StorageCapableNavigator).storage;
  if (!storage || typeof storage.estimate !== 'function') return unknown;
  let raw: { usage?: number; quota?: number };
  try {
    raw = await storage.estimate();
  } catch {
    return unknown;
  }
  const usedBytes = finite(raw.usage);
  const quotaBytes = finite(raw.quota);
  return {
    usedBytes,
    quotaBytes,
    // A quota BELOW the usage is not free space of a negative size; some browsers
    // report a stale quota while a write is in flight. Clamp at zero, because
    // "nothing free" is the honest reading of quota <= usage.
    freeBytes: usedBytes === null || quotaBytes === null ? null : Math.max(0, quotaBytes - usedBytes),
  };
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** F-ON-6's cap, repeated here because F-ER-6 inherits it. See below. */
export const ADVICE_GAP_MS = 7 * 24 * 60 * 60 * 1000;

export interface RepeatAdviceInput {
  /** What `requestPersistence` last returned, or `'never-asked'`. */
  outcome: PersistenceOutcome | 'never-asked';
  /**
   * Lessons this learner has completed. A "natural moment" is a boundary, not a
   * clock tick, and finishing a lesson is the boundary F-ON-6 already chose for
   * the install offer — reusing it means the advice arrives where the learner is
   * already being told something, rather than interrupting a board.
   */
  lessonsCompleted: number;
  /** When the advice was last shown, epoch ms. 0 means never. */
  lastShownAt: number;
  now: number;
}

/**
 * F-ER-6's rule: whether to repeat the installation advice now.
 *
 * WHAT "REFUSED" DOES AND DOES NOT COVER. The clause fires on a refusal and on
 * nothing else. `unsupported` is deliberately not a trigger: the PRD does not
 * cover it, and a browser with no Storage API at all is not one whose behaviour
 * installing would change in a way this app can promise. `granted` obviously is
 * not a trigger, and `never-asked` is a bug in the caller rather than a state to
 * advise on — both return false, so a caller that forgets to ask cannot produce
 * advice about an answer nobody sought.
 *
 * NO CALLER YET, AND THAT IS STATED RATHER THAN HIDDEN. The advice surface is
 * `pwa/InstallPrompt.tsx`, whose own trigger (`pwa/installPolicy.ts`
 * `shouldOffer`) requires `lessonCount === 1` EXACTLY — so today the advice is
 * shown once, ever, and cannot repeat for any reason. Wiring this rule into that
 * screen changes when an install prompt appears for every learner, refused
 * storage or not, which is a product decision about the app's most interruptive
 * surface and not a decision an error-handling change should take. The rule and
 * its test ship now; the same shape `onboarding/notifications.ts` used for
 * F-ON-8's gate, and for the same reason.
 */
export function shouldRepeatInstallAdvice(i: RepeatAdviceInput): boolean {
  if (i.outcome !== 'refused') return false;
  // Before the first completed lesson there is no natural moment yet, and the
  // install offer has never been made, so there is nothing to REPEAT.
  if (i.lessonsCompleted < 1) return false;
  if (i.lastShownAt === 0) return true;
  return i.now - i.lastShownAt >= ADVICE_GAP_MS;
}

/**
 * The advice itself, as data.
 *
 * F-ER-6 asks for the app to "continue" — so this is not an error, carries no
 * apology, and never says the word "failed". A learner who reads it should
 * understand what installing buys them, which is the only thing that would
 * change the outcome. One sentence of consequence, one of remedy.
 */
export const PERSISTENCE_REFUSED_ADVICE =
  'Your browser may clear this app’s data if your device runs low on space. Add Chess to your home screen and your lessons, puzzles and progress stay put.';

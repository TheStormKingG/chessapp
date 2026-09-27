import type { RatingBand } from './types';

/**
 * PRD F-ER-3, as data.
 *
 * > "If a pack download fails or the device is out of storage, the app says
 * > WHICH PACK failed and HOW MUCH SPACE IT NEEDS, and keeps whatever was
 * > already downloaded."
 *
 * The sentences live here rather than in `PuzzleRoutes.tsx` for the reason
 * `import/messages.ts` gives: a message that names no pack, or states no size,
 * is a requirement failure, and that is far easier to see in a list of strings
 * than in a render tree. This file is that list.
 *
 * WHAT WAS THERE BEFORE. One string, `NO_PACK` in `PuzzleRoutes.tsx`: "These
 * puzzles have not been downloaded yet, and there is no connection to fetch
 * them." It is a good sentence and it is shown at the right moment, but it
 * answers neither half of the clause — a learner cannot tell which of the three
 * packs is missing, and is told nothing about space at all. It also describes
 * only one of the two causes: a device that is out of room gets a message about
 * a connection, and goes looking for wifi.
 */

/**
 * Each pack's size on disk, measured 2026-09-27 against the files in
 * `public/data/puzzles/`.
 *
 * Hardcoded for the same reason `pwa/downloadEngine.ts` hardcodes
 * `ENGINE_BYTES`: these are build artefacts we ship, so we know them exactly,
 * and a `content-length` is not guaranteed — `vite preview` streams chunked. The
 * difference from `ENGINE_BYTES` is that these three are checked: the test
 * beside this file reads the real files and fails on drift, so a pack rebuild
 * that changes a size cannot leave a stale figure in front of a learner being
 * told how much room to clear.
 */
export const PACK_BYTES: Record<RatingBand, number> = {
  '600-900': 316_920,
  '900-1200': 321_960,
  '1200-1500': 310_200,
};

/**
 * What to call each pack to a learner.
 *
 * An en dash, not a hyphen, because this is prose and not the file name the
 * band happens to be keyed by. The band id itself is never shown: "1200-1500"
 * is a rating range and reads as one, so it is given a noun.
 */
const PACK_NAME: Record<RatingBand, string> = {
  '600-900': 'the 600–900 puzzle pack',
  '900-1200': 'the 900–1200 puzzle pack',
  '1200-1500': 'the 1200–1500 puzzle pack',
};

/**
 * One decimal in MB. The same unit and precision `EngineDownload` uses, so a
 * learner who has seen the engine's "1.8 MB" reads these on the same scale.
 *
 * MB as 1,000,000 bytes, matching `pwa/EngineDownload.tsx`'s `mb()`. Mixing the
 * two conventions inside one app would make a pack look 5 per cent smaller on
 * one screen than the other.
 */
export function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Why a pack is not here. */
export type PackFailure =
  /** The fetch failed and the runtime cache missed: offline, or a bad response. */
  | { kind: 'unavailable'; band: RatingBand }
  /**
   * The device has less room than the pack needs. `freeBytes` is null when
   * `navigator.storage.estimate()` would not say — see `data/persistence.ts`.
   */
  | { kind: 'out-of-space'; band: RatingBand; freeBytes: number | null };

export interface PackMessage {
  /** What the learner reads. */
  text: string;
  /** Whether a retry can plausibly change the outcome. */
  retryable: boolean;
  /** The pack's size, for a caller that wants to show it separately. */
  needsLabel: string;
}

/**
 * F-ER-3's sentence.
 *
 * BOTH CAUSES NAME BOTH FACTS. A learner who is offline and a learner who is
 * full both need to know which pack and how big it is — the first because the
 * app has three and only one is missing, the second because "free some space" is
 * useless without a number. The remedies differ, and only the remedies differ.
 *
 * AND BOTH SAY THE OTHER PACKS ARE SAFE. "keeps whatever was already
 * downloaded" is a promise about the app's behaviour, and a promise the learner
 * cannot see is worth nothing: told that a download failed, the reasonable fear
 * is that the ones that worked are gone too.
 */
export function packFailureMessage(failure: PackFailure): PackMessage {
  const name = PACK_NAME[failure.band];
  const needsLabel = mb(PACK_BYTES[failure.band]);

  if (failure.kind === 'out-of-space') {
    // The free figure is stated only when it is known. Saying "0.0 MB free" to a
    // learner whose browser withheld the number would be inventing the one fact
    // that decides whether they go and delete their photos.
    const free =
      failure.freeBytes === null
        ? 'and there is not enough room on this device'
        : `and this device has ${mb(failure.freeBytes)} free`;
    return {
      text: `${capitalise(name)} needs ${needsLabel}, ${free}. Free up some space and try again — the packs you already have are still here.`,
      // Retrying changes nothing until the learner frees space, but it is the
      // action that follows once they have, so the control stays.
      retryable: true,
      needsLabel,
    };
  }

  return {
    text: `${capitalise(name)} (${needsLabel}) could not be downloaded. Check your connection and try again — the packs you already have are still here.`,
    retryable: true,
    needsLabel,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Whether a failed pack fetch should be read as "out of space" rather than "no
 * connection".
 *
 * WHY THIS IS A GUESS AND IS WRITTEN AS ONE. A `fetch` that fails because the
 * disk is full and a `fetch` that fails because there is no network reject with
 * the same `TypeError` — the browser does not distinguish them, and the quota
 * error surfaces only later, when something tries to WRITE. So this does not
 * claim to detect the cause; it asks a separate question — is there room for this
 * pack at all — and lets a no override the default message. A device with room
 * gets the connection message, which is right, because a fetch that failed on a
 * device with room failed for some other reason.
 *
 * An unknown `freeBytes` is NOT out of space. A browser that will not report a
 * quota is not a full one, and guessing otherwise would send every Firefox
 * learner to delete files.
 */
export function isOutOfSpace(band: RatingBand, freeBytes: number | null): boolean {
  if (freeBytes === null) return false;
  return freeBytes < PACK_BYTES[band];
}

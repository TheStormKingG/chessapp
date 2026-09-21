import { localDay } from '@/data/events';

/**
 * The daily puzzle without a server (F-PZ-6, design spec §4.3).
 *
 * The same puzzle for everyone on a given day, derived from the calendar date
 * against a fixed pack. No network, no clock skew, nothing to agree on.
 */

/**
 * Today, as the device's own calendar says.
 *
 * **This is `localDay`, re-exported, not a second implementation.** A learner's
 * "today" is their today (spec §4.3), and the event log already stamps every
 * event with exactly this key. Two subtly different notions of "today" would
 * put the daily puzzle on one day and its record on another for every learner
 * east or west of Greenwich late in the evening — and both would look right in
 * whichever timezone the tests happened to run in.
 *
 * The rule inside is the whole of §4.3: the key is built from `getFullYear`,
 * `getMonth` and `getDate`, never from `toISOString`, which converts to UTC and
 * shifts the date silently.
 */
export const localDateKey = localDay;

/**
 * Which puzzle of the pack today is.
 *
 * FNV-1a over the date key, then modulo the pack length. A hash rather than a
 * day count: a counter would walk the pack in order and a learner could read
 * ahead, and a weak mix would hand out the same handful of puzzles all year.
 * `daily.test.ts` asserts both — that consecutive days are not adjacent, and
 * that a year of dates spreads across the pack.
 *
 * An empty pack answers 0 rather than NaN: `x % 0` is NaN, and a NaN index
 * reads as "no puzzle" everywhere downstream while looking like an ordinary
 * number in a log.
 */
export function dailyIndex(dateKey: string, packLength: number): number {
  if (packLength <= 0) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    // The FNV prime, as the shift-and-add form that stays inside 32 bits.
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h % packLength;
}

/** F-PZ-6: three attempts at the daily puzzle, and then it is over for today. */
export const DAILY_ATTEMPTS = 3;

import type { SkipReason } from './runImport';
import type { ImportFailure, ImportSource } from './types';

/**
 * F-IM-7 and F-ER-4: "If a source is unreachable or a username does not exist,
 * the app says so plainly", and "the app says so in plain words and offers a
 * retry after a stated wait."
 *
 * The sentences live here rather than in the screen so they can be tested as
 * text — a message that names the wrong site or states no wait is a requirement
 * failure, and it is much easier to see in a list than in a render tree.
 */

const SITE: Record<ImportSource, string> = {
  'chess.com': 'chess.com',
  lichess: 'Lichess',
  pgn: 'that file',
};

/** A wait, in the words a person would use. Never "60000ms". */
export function statedWait(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${String(seconds)} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.round(seconds / 60);
  return `${String(minutes)} minute${minutes === 1 ? '' : 's'}`;
}

export interface FailureMessage {
  /** One sentence naming what happened. */
  text: string;
  /** Whether offering a retry makes sense at all. */
  retryable: boolean;
  /** How long to say to wait, when there is a wait worth stating. */
  waitLabel: string | null;
}

export function failureMessage(failure: ImportFailure): FailureMessage {
  switch (failure.kind) {
    case 'unknown-user':
      return {
        // Naming the site matters: a learner who mistyped a Lichess name into the
        // chess.com field needs to know which site was asked.
        text: `There is no ${SITE[failure.source]} player called “${failure.username}”. Check the spelling and try again.`,
        // Retrying the same spelling will fail the same way; the learner has to
        // change something first, so this is not offered as a retry.
        retryable: false,
        waitLabel: null,
      };
    case 'rate-limited':
      return {
        text: `${SITE[failure.source]} is asking us to slow down. Your games are still there — try again in ${statedWait(
          failure.retryAfterMs,
        )}.`,
        retryable: true,
        waitLabel: statedWait(failure.retryAfterMs),
      };
    case 'unreachable':
      return {
        text: `We could not reach ${SITE[failure.source]} just now. Check your connection and try again.`,
        retryable: true,
        waitLabel: null,
      };
    case 'no-games':
      return {
        text: `${SITE[failure.source]} has no rapid, blitz, daily or bullet games for “${failure.username}”.`,
        retryable: false,
        waitLabel: null,
      };
    case 'bad-pgn':
      return {
        text: `We could not read any games in that — ${failure.detail}.`,
        retryable: false,
        waitLabel: null,
      };
  }
}

/** One line per reason games were skipped, so an import never silently shrinks. */
export function skipMessage(reason: SkipReason, count: number): string {
  const games = `${String(count)} game${count === 1 ? '' : 's'}`;
  switch (reason) {
    case 'out-of-scope':
      return `${games} skipped: not rapid, blitz, daily or bullet.`;
    case 'over-limit':
      return `${games} not imported yet — ask for more to reach them.`;
    case 'not-standard':
      return `${games} skipped: a chess variant, or not starting from the normal position.`;
    case 'no-result':
      return `${games} skipped: still unfinished.`;
    case 'unknown-side':
      return `${games} skipped: we could not tell which side you played.`;
    case 'does-not-replay':
      return `${games} skipped: the moves did not add up to a legal game.`;
    case 'unparsed-tokens':
      return `${games} skipped: the notation held something we could not read.`;
  }
}

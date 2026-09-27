import { failureMessage, skipMessage, statedWait } from './messages';
import type { SkipReason } from './runImport';
import type { ImportFailure } from './types';

describe('statedWait', () => {
  test('a wait is stated in words a person uses, never in milliseconds', () => {
    expect(statedWait(1000)).toBe('1 second');
    expect(statedWait(30_000)).toBe('30 seconds');
    expect(statedWait(60_000)).toBe('1 minute');
    expect(statedWait(120_000)).toBe('2 minutes');
  });

  test('a sub-second wait still states a whole unit', () => {
    expect(statedWait(0)).toBe('1 second');
    expect(statedWait(400)).toBe('1 second');
  });
});

describe('failureMessage', () => {
  test('an unknown username names the site that was asked and the name that was tried', () => {
    const m = failureMessage({ kind: 'unknown-user', source: 'lichess', username: 'nope' });
    expect(m.text).toContain('Lichess');
    expect(m.text).toContain('nope');
    expect(m.text).not.toContain('chess.com');
    // Retrying the same spelling fails the same way, so no retry is offered.
    expect(m.retryable).toBe(false);
  });

  test('chess.com is named as chess.com, not as Lichess', () => {
    const m = failureMessage({ kind: 'unknown-user', source: 'chess.com', username: 'nope' });
    expect(m.text).toContain('chess.com');
    expect(m.text).not.toContain('Lichess');
  });

  test('a rate limit states a wait and offers a retry, which is F-ER-4 verbatim', () => {
    const m = failureMessage({ kind: 'rate-limited', source: 'lichess', retryAfterMs: 60_000 });
    expect(m.retryable).toBe(true);
    expect(m.waitLabel).toBe('1 minute');
    expect(m.text).toContain('1 minute');
    // The learner must not think their games are gone.
    expect(m.text).toContain('still there');
  });

  test('an unreachable source offers a retry and does not blame the username', () => {
    const m = failureMessage({ kind: 'unreachable', source: 'chess.com', detail: 'HTTP 503' });
    expect(m.retryable).toBe(true);
    expect(m.text).toContain('could not reach');
    // A 503 is not a spelling mistake; saying so would send the learner to fix
    // something that is not wrong.
    expect(m.text).not.toContain('spelling');
  });

  test('no games is stated as no games, not as an error', () => {
    const m = failureMessage({ kind: 'no-games', source: 'chess.com', username: 'quiet_one' });
    expect(m.text).toContain('quiet_one');
    expect(m.retryable).toBe(false);
  });

  test('an unreadable PGN says what was wrong with it', () => {
    const m = failureMessage({ kind: 'bad-pgn', detail: 'no games were found in that text' });
    expect(m.text).toContain('no games were found');
  });

  test('every failure kind produces a non-empty sentence ending in a full stop', () => {
    const all: ImportFailure[] = [
      { kind: 'unknown-user', source: 'chess.com', username: 'x' },
      { kind: 'rate-limited', source: 'lichess', retryAfterMs: 1000 },
      { kind: 'unreachable', source: 'chess.com', detail: 'd' },
      { kind: 'no-games', source: 'lichess', username: 'x' },
      { kind: 'bad-pgn', detail: 'd' },
    ];
    for (const f of all) {
      const m = failureMessage(f);
      expect(m.text.length).toBeGreaterThan(20);
      expect(m.text.trimEnd().endsWith('.')).toBe(true);
    }
    // The union has five members and all five are covered above; a sixth added
    // later fails `failureMessage`'s exhaustive switch at compile time.
    expect(all).toHaveLength(5);
  });
});

describe('skipMessage', () => {
  test('every skip reason has a sentence, and it says how many', () => {
    const reasons: SkipReason[] = [
      'out-of-scope',
      'over-limit',
      'not-standard',
      'no-result',
      'unknown-side',
      'does-not-replay',
      'unparsed-tokens',
    ];
    for (const r of reasons) {
      const one = skipMessage(r, 1);
      const many = skipMessage(r, 4);
      expect(one).toContain('1 game');
      expect(one).not.toContain('1 games');
      expect(many).toContain('4 games');
    }
  });

  test('an over-limit skip tells the learner they can reach those games', () => {
    expect(skipMessage('over-limit', 10)).toContain('ask for more');
  });
});

import { buildImportedGame, gameIdOf, isStandardFromStart, learnerColorOf, playedAtOf, resultFor } from './games';
import { parsePgn, type ParsedGame } from './pgn';

function one(text: string): ParsedGame {
  const games = parsePgn(text);
  expect(games).toHaveLength(1); // guards the fixture, not the code under test
  return games[0]!;
}

function pgn(tags: Record<string, string>, moves = '1. e4 e5 2. Nf3 Nc6 1-0'): ParsedGame {
  const block = Object.entries(tags)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');
  return one(`${block}\n\n${moves}`);
}

const BASE = { White: 'learner_one', Black: 'Rosa_Bot', Result: '1-0', UTCDate: '2026.09.20', UTCTime: '14:30:00' };

describe('gameIdOf', () => {
  test("a chess.com game is identified by the numeric id in its Link tag", () => {
    const g = pgn({ ...BASE, Link: 'https://www.chess.com/game/live/123456789' });
    expect(gameIdOf('chess.com', g)).toBe('cc-123456789');
  });

  test('a Lichess game is identified by its GameId tag', () => {
    expect(gameIdOf('lichess', pgn({ ...BASE, GameId: 'abcd1234' }))).toBe('li-abcd1234');
  });

  test('a Lichess game with no GameId falls back to the id in its Site URL', () => {
    expect(gameIdOf('lichess', pgn({ ...BASE, Site: 'https://lichess.org/QRSt5678' }))).toBe('li-QRSt5678');
  });

  test('a pasted game with no site id gets a digest of what identifies it', () => {
    const id = gameIdOf('pgn', pgn(BASE));
    expect(id).toMatch(/^pgn-[0-9a-f]{16}$/);
  });

  test('the same pasted game imported twice gets the same id, so a re-import costs nothing', () => {
    expect(gameIdOf('pgn', pgn(BASE))).toBe(gameIdOf('pgn', pgn(BASE)));
  });

  test('two different games get different ids', () => {
    const a = gameIdOf('pgn', pgn(BASE));
    const b = gameIdOf('pgn', pgn({ ...BASE, UTCTime: '15:30:00' }));
    const c = gameIdOf('pgn', pgn(BASE, '1. d4 d5 2. c4 e6 1-0'));
    expect(new Set([a, b, c]).size).toBe(3);
  });

  test('no id contains a colon, because it travels in a URL path', () => {
    for (const src of ['chess.com', 'lichess', 'pgn'] as const) {
      expect(gameIdOf(src, pgn(BASE))).not.toContain(':');
    }
  });
});

describe('learnerColorOf', () => {
  test('the learner is the side whose name matches, case-insensitively', () => {
    expect(learnerColorOf(pgn(BASE), ['LEARNER_ONE'])).toBe('w');
    expect(learnerColorOf(pgn(BASE), ['rosa_bot'])).toBe('b');
  });

  test('a name matching neither side is not a side', () => {
    expect(learnerColorOf(pgn(BASE), ['someone_else'])).toBeNull();
    // Positive control: the same call shape DOES return a colour for a name that
    // is present, so null is "no match" and not "matching is broken".
    expect(learnerColorOf(pgn(BASE), ['learner_one'])).toBe('w');
  });

  test('no names at all is not a side', () => {
    expect(learnerColorOf(pgn(BASE), [])).toBeNull();
    expect(learnerColorOf(pgn(BASE), ['', '   '])).toBeNull();
  });

  test('a game the learner played against themselves has no learner side', () => {
    const g = pgn({ ...BASE, White: 'learner_one', Black: 'learner_one' });
    expect(learnerColorOf(g, ['learner_one'])).toBeNull();
  });

  test('several known usernames are all tried', () => {
    expect(learnerColorOf(pgn(BASE), ['old_account', 'rosa_bot'])).toBe('b');
  });
});

describe('resultFor', () => {
  test('a win is a win for the side that won and a loss for the other', () => {
    const g = pgn({ ...BASE, Result: '1-0' });
    expect(resultFor(g, 'w')).toBe('win');
    expect(resultFor(g, 'b')).toBe('loss');
  });

  test('0-1 is read from the black side', () => {
    const g = pgn({ ...BASE, Result: '0-1' }, '1. e4 e5 0-1');
    expect(resultFor(g, 'b')).toBe('win');
    expect(resultFor(g, 'w')).toBe('loss');
  });

  test('a draw is a draw for both', () => {
    const g = pgn({ ...BASE, Result: '1/2-1/2' }, '1. e4 e5 1/2-1/2');
    expect(resultFor(g, 'w')).toBe('draw');
    expect(resultFor(g, 'b')).toBe('draw');
  });

  test('an unfinished game has no result', () => {
    const g = pgn({ ...BASE, Result: '*' }, '1. e4 e5 *');
    expect(resultFor(g, 'w')).toBeNull();
  });

  test('the movetext termination is used when the Result tag is missing', () => {
    const g = one('[White "a"]\n[Black "b"]\n\n1. e4 e5 0-1');
    expect(resultFor(g, 'b')).toBe('win');
  });
});

describe('playedAtOf', () => {
  test('UTCDate and UTCTime become an ISO instant', () => {
    expect(playedAtOf(pgn(BASE))).toBe('2026-09-20T14:30:00Z');
  });

  test('a date with no time is midnight UTC, never now', () => {
    const g = pgn({ White: 'a', Black: 'b', Result: '1-0', Date: '2026.03.04' });
    expect(playedAtOf(g)).toBe('2026-03-04T00:00:00Z');
  });

  test('UTCDate wins over Date when both are present', () => {
    const g = pgn({ ...BASE, Date: '2020.01.01' });
    expect(playedAtOf(g)).toBe('2026-09-20T14:30:00Z');
  });

  test('an unreadable or absent date is null, not a guess', () => {
    expect(playedAtOf(pgn({ White: 'a', Black: 'b', Result: '1-0', Date: '????.??.??' }))).toBeNull();
    expect(playedAtOf(one('1. e4 e5 1-0'))).toBeNull();
    // Positive control: the same function reads a real date, so null is the
    // verdict on these inputs and not the function's only answer.
    expect(playedAtOf(pgn(BASE))).toBe('2026-09-20T14:30:00Z');
  });
});

describe('isStandardFromStart', () => {
  test('a game with no Variant tag is standard', () => {
    expect(isStandardFromStart(pgn(BASE))).toBe(true);
  });

  test('Variant "Standard" is standard', () => {
    expect(isStandardFromStart(pgn({ ...BASE, Variant: 'Standard' }))).toBe(true);
  });

  test('a variant is refused', () => {
    expect(isStandardFromStart(pgn({ ...BASE, Variant: 'Chess960' }))).toBe(false);
    expect(isStandardFromStart(pgn({ ...BASE, Variant: 'Crazyhouse' }))).toBe(false);
  });

  test('a FEN tag is refused however standard the Variant claims to be', () => {
    // This is the dangerous case: the game replays LEGALLY from the standard
    // position and is reviewed as a game the learner never played.
    const g = pgn({ ...BASE, Variant: 'Standard', SetUp: '1', FEN: '8/8/8/8/8/8/8/K6k w - - 0 1' });
    expect(isStandardFromStart(g)).toBe(false);
  });

  test('a FEN tag ALONE is refused, with no SetUp tag to give it away', () => {
    /*
     * Mutation testing found this gap: the test above carries SetUp AND FEN, so
     * deleting the FEN check entirely left it green — the SetUp check caught the
     * fixture instead. Both sites emit SetUp with FEN, but the PGN standard does
     * not require it, and the FEN tag is the one that actually changes the start
     * position. This fixture isolates it.
     */
    const g = pgn({ ...BASE, FEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' });
    expect(isStandardFromStart(g)).toBe(false);
    // Positive control: the identical tags WITHOUT the FEN are standard, so the
    // false above is the FEN and not something else in the fixture.
    expect(isStandardFromStart(pgn({ ...BASE }))).toBe(true);
  });

  test('a SetUp tag ALONE is refused, with no FEN tag to give it away', () => {
    // The mirror of the case above, for the same reason.
    const g = pgn({ ...BASE, SetUp: '1' });
    expect(isStandardFromStart(g)).toBe(false);
  });

  test('SetUp "0" is the explicit standard start and is allowed', () => {
    expect(isStandardFromStart(pgn({ ...BASE, SetUp: '0' }))).toBe(true);
  });
});

describe('buildImportedGame', () => {
  const args = { source: 'chess.com' as const, learner: 'w' as const, speed: 'rapid' as const };

  test('a normal game becomes an ImportedGame with the learner point of view filled in', () => {
    const r = buildImportedGame({ ...args, parsed: pgn({ ...BASE, WhiteElo: '812', BlackElo: '798' }) });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.game.source).toBe('chess.com');
    expect(r.game.learner).toBe('w');
    expect(r.game.opponent).toBe('Rosa_Bot');
    expect(r.game.result).toBe('win');
    expect(r.game.speed).toBe('rapid');
    expect(r.game.playedAt).toBe('2026-09-20T14:30:00Z');
    expect(r.game.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(r.game.learnerElo).toBe(812);
    expect(r.game.opponentElo).toBe(798);
  });

  test('the opponent is the other side, so a black learner sees the white name', () => {
    const r = buildImportedGame({ ...args, learner: 'b', parsed: pgn({ ...BASE, Result: '0-1' }) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.game.opponent).toBe('learner_one');
    expect(r.game.result).toBe('win');
    expect(r.game.learnerElo).toBe(null);
  });

  test('the stated speed is used and the TimeControl estimate is not consulted', () => {
    // TimeControl says 60s (bullet); the source says rapid. The source wins,
    // because it knows and the estimate only guesses.
    const r = buildImportedGame({ ...args, parsed: pgn({ ...BASE, TimeControl: '60' }) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.game.speed).toBe('rapid');
  });

  test('a pasted game with no stated speed falls back to the TimeControl estimate', () => {
    const r = buildImportedGame({ source: 'pgn', learner: 'w', speed: null, parsed: pgn({ ...BASE, TimeControl: '600' }) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.game.speed).toBe('rapid');
  });

  test('an unfinished game is refused with a stated reason', () => {
    const r = buildImportedGame({ ...args, parsed: pgn({ ...BASE, Result: '*' }, '1. e4 e5 *') });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('no-result');
  });

  test('a variant game is refused', () => {
    const r = buildImportedGame({ ...args, parsed: pgn({ ...BASE, Variant: 'Chess960' }) });
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('not-standard');
    expect(r.detail).toContain('Chess960');
  });

  test('a move list that is not a legal game is refused rather than reviewed', () => {
    const r = buildImportedGame({ ...args, parsed: pgn(BASE, '1. e4 e5 2. e4 1-0') });
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('does-not-replay');
  });

  test('a movetext token the parser could not classify refuses the game', () => {
    // Accepting it would store a game one move short, which replays legally and
    // is therefore invisible to every later check.
    const parsed = pgn(BASE, '1. e4 e5 2. Nf3 Qzz9 1-0');
    expect(parsed.unparsed).toEqual(['Qzz9']);
    const r = buildImportedGame({ ...args, parsed });
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('unparsed-tokens');
    expect(r.detail).toContain('Qzz9');
  });

  test('a game with an unreadable date sorts at the epoch, not at import time', () => {
    const r = buildImportedGame({ ...args, parsed: pgn({ White: 'learner_one', Black: 'b', Result: '1-0' }) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.game.playedAt).toBe('1970-01-01T00:00:00Z');
  });

  test('the archival PGN is the source text, not a reassembly', () => {
    const r = buildImportedGame({ ...args, parsed: pgn({ ...BASE, Link: 'https://www.chess.com/game/live/9' }) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.game.pgn).toContain('[Link "https://www.chess.com/game/live/9"]');
  });
});

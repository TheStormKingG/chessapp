import { parsePgn, tagValue } from './pgn';

/*
 * Fixtures are real exports, trimmed. Nothing here touches the network: a PGN
 * paste is F-IM-1's no-network path and its tests must be too.
 */

/** A chess.com export. Note `{[%clk ...]}` comments and the glued `1.` prefix. */
const CHESSCOM = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.09.20"]
[Round "-"]
[White "learner_one"]
[Black "Rosa_Bot"]
[Result "1-0"]
[ECO "C50"]
[WhiteElo "812"]
[BlackElo "798"]
[TimeControl "600"]
[Termination "learner_one won by resignation"]
[Link "https://www.chess.com/game/live/123456789"]

1. e4 {[%clk 0:10:00]} 1... e5 {[%clk 0:10:00]} 2. Nf3 {[%clk 0:09:55]} 2... Nc6 {[%clk 0:09:58]} 3. Bc4 {[%clk 0:09:50]} 1-0`;

/** A Lichess export. Note `[%eval]` inside comments and a `Variant` tag. */
const LICHESS = `[Event "rated blitz game"]
[Site "https://lichess.org/abcd1234"]
[Date "2026.09.19"]
[White "OtherPlayer"]
[Black "learner_one"]
[Result "0-1"]
[GameId "abcd1234"]
[UTCDate "2026.09.19"]
[UTCTime "18:51:40"]
[WhiteElo "1695"]
[BlackElo "1723"]
[Variant "Standard"]
[TimeControl "300+3"]
[Opening "Sicilian Defense"]

1. e4 { [%eval 0.18] [%clk 0:05:00] } 1... c5 { [%eval 0.32] [%clk 0:05:00] } 2. Nf3 { [%eval 0.21] } 0-1`;

test('a chess.com export parses into tags and a SAN list', () => {
  const games = parsePgn(CHESSCOM);
  expect(games).toHaveLength(1);
  const g = games[0]!;
  expect(g.tags.White).toBe('learner_one');
  expect(g.tags.Black).toBe('Rosa_Bot');
  expect(g.tags.Result).toBe('1-0');
  expect(g.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
  expect(g.termination).toBe('1-0');
});

test('a Lichess export parses the same way, eval comments and all', () => {
  const games = parsePgn(LICHESS);
  expect(games).toHaveLength(1);
  expect(games[0]!.sans).toEqual(['e4', 'c5', 'Nf3']);
  expect(games[0]!.tags.GameId).toBe('abcd1234');
  expect(games[0]!.tags.Variant).toBe('Standard');
});

test('several games in one paste are separated', () => {
  const games = parsePgn(`${CHESSCOM}\n\n${LICHESS}`);
  expect(games).toHaveLength(2);
  expect(games[0]!.tags.Site).toBe('Chess.com');
  expect(games[1]!.tags.GameId).toBe('abcd1234');
  // Positive control for the separation: the two games' move lists differ, so a
  // parser that ran them together would show it here rather than in the count.
  expect(games[0]!.sans).not.toEqual(games[1]!.sans);
});

test('games separated by no blank line at all are still separated', () => {
  // A tag pair is what starts a game. Relying on a blank line loses the second
  // game of any paste that has been through a text box that trims them.
  const games = parsePgn('[White "A"]\n[Black "B"]\n\n1. e4 1-0\n[White "C"]\n[Black "D"]\n\n1. d4 0-1');
  expect(games).toHaveLength(2);
  expect(games[0]!.tags.White).toBe('A');
  expect(games[1]!.tags.White).toBe('C');
  expect(games[1]!.sans).toEqual(['d4']);
});

test('variations are dropped, including nested ones, and the mainline survives', () => {
  const g = parsePgn('[White "A"]\n\n1. e4 (1. d4 d5 (1... Nf6 2. c4)) e5 2. Nf3 1-0')[0]!;
  expect(g.sans).toEqual(['e4', 'e5', 'Nf3']);
  // Positive control: d4/d5/Nf6/c4 are real SAN and WOULD have been collected by
  // a tokeniser that ignored parentheses, so their absence is a result and not a
  // property of the fixture.
  expect(g.sans).not.toContain('d4');
  expect(g.sans).not.toContain('Nf6');
});

test('NAGs, annotation marks and semicolon comments are stripped from moves', () => {
  const g = parsePgn('[White "A"]\n\n1. e4! $1 e5?? $4 2. Nf3!? ; a trailing comment\nNc6 1-0')[0]!;
  expect(g.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
});

test('check and mate suffixes are kept, because they are part of the SAN', () => {
  const g = parsePgn('[White "A"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0')[0]!;
  expect(g.sans[6]).toBe('Qxf7#');
});

test('move numbers glued to the move are handled', () => {
  const g = parsePgn('[White "A"]\n\n1.e4 e5 2.Nf3 Nc6 1-0')[0]!;
  expect(g.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
});

test('black-to-move continuation dots do not become a move', () => {
  const g = parsePgn('[White "A"]\n\n1... e5 2. Nf3 0-1')[0]!;
  expect(g.sans).toEqual(['e5', 'Nf3']);
});

test('a movetext-only paste with no tags is still a game', () => {
  const g = parsePgn('1. e4 e5 2. Nf3 Nc6 *');
  expect(g).toHaveLength(1);
  expect(g[0]!.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  expect(g[0]!.termination).toBe('*');
});

test('castling and promotion are read as moves, not as annotations', () => {
  const g = parsePgn('[White "A"]\n\n1. O-O O-O-O 2. e8=Q+ a1=N 1-0')[0]!;
  expect(g.sans).toEqual(['O-O', 'O-O-O', 'e8=Q+', 'a1=N']);
});

test('an escaped line is ignored entirely', () => {
  // "%" at column 0 is a PGN escape and its line is not data.
  const g = parsePgn('[White "A"]\n\n%this is not e4 or a tag\n1. d4 1-0')[0]!;
  expect(g.sans).toEqual(['d4']);
  expect(g.sans).not.toContain('e4');
});

test('empty and whitespace-only input yields no games', () => {
  expect(parsePgn('')).toEqual([]);
  expect(parsePgn('   \n\n  \t ')).toEqual([]);
  // Positive control: the same call shape on real input DOES yield a game, so
  // the empty answers above are the parser's verdict and not a broken call.
  expect(parsePgn('1. e4 *')).toHaveLength(1);
});

test('a tag block with no moves is not offered as a game', () => {
  // chess.com returns these for aborted games. A game with no moves cannot be
  // reviewed (src/review/gameSource.ts refuses one), so import must not create it.
  expect(parsePgn('[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1-0')).toEqual([]);
});

test('a tag value containing an escaped quote survives', () => {
  const g = parsePgn('[White "A \\"Nick\\" B"]\n\n1. e4 1-0')[0]!;
  expect(g.tags.White).toBe('A "Nick" B');
});

test('tagValue reads a tag case-insensitively and returns null when absent', () => {
  const g = parsePgn(LICHESS)[0]!;
  expect(tagValue(g, 'utcdate')).toBe('2026.09.19');
  expect(tagValue(g, 'WhiteElo')).toBe('1695');
  expect(tagValue(g, 'NotATag')).toBeNull();
  // Positive control for the null: the same lookup shape finds a real tag above,
  // so `null` is "absent" and not "lookup broken".
});

test('a null move is dropped rather than offered as SAN', () => {
  const g = parsePgn('[White "A"]\n\n1. e4 -- 2. d4 Z0 1-0')[0]!;
  expect(g.sans).toEqual(['e4', 'd4']);
});

test('the raw text of each game is kept, so the archival PGN is not reassembled', () => {
  const games = parsePgn(`${CHESSCOM}\n\n${LICHESS}`);
  expect(games[0]!.raw).toContain('[Link "https://www.chess.com/game/live/123456789"]');
  expect(games[0]!.raw).not.toContain('lichess.org');
  expect(games[1]!.raw).toContain('lichess.org/abcd1234');
});

import { describe, expect, it } from 'vitest';
import { legalMoves, turn } from '@/rules';
import { targetedFrom } from '@/play/targetedParams';
import { LINE_PLIES, PLIES_EARLIER, phaseOf, playUrl, positionBefore, targetedGame } from './targetedGame';
import { anOwnGame } from './testReviews';

const NOW = new Date('2026-09-26T12:00:00.000Z');

/** A longer real game, so there is room to walk six plies back from a late mistake. */
const LONG_SANS = [
  'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'O-O', 'O-O', 'Bg5', 'h6', 'Bxf6', 'Qxf6',
];

function middlegameGame() {
  return anOwnGame({
    gameId: 'g1',
    sans: LONG_SANS,
    // Ply 12 is White's 7th move, Bxf6.
    errors: [{ ply: 12, theme: 'hung_piece', bestSan: 'Nc3', phase: 'middlegame' }],
    playedAt: '2026-09-22T18:00:00.000Z',
  });
}

describe('phaseOf', () => {
  it('is null when the theme never happened', () => {
    expect(phaseOf([middlegameGame()], 'missed_mate')).toBeNull();
    // Control: it DOES answer for a theme that did happen.
    expect(phaseOf([middlegameGame()], 'hung_piece')).toBe('middlegame');
  });

  it('needs a majority, not a plurality', () => {
    const spread = anOwnGame({
      gameId: 'spread',
      sans: LONG_SANS,
      errors: [
        { ply: 2, theme: 'hung_piece', bestSan: 'Nc3', phase: 'opening' },
        { ply: 4, theme: 'hung_piece', bestSan: 'Nc3', phase: 'middlegame' },
        { ply: 12, theme: 'hung_piece', bestSan: 'Nc3', phase: 'endgame' },
      ],
    });
    // One each: no majority, so it is not called an opening weakness.
    expect(phaseOf([spread], 'hung_piece')).toBe('middlegame');
  });

  it('calls it an opening weakness when most of it is in the opening', () => {
    const opening = anOwnGame({
      gameId: 'op',
      sans: LONG_SANS,
      errors: [
        { ply: 2, theme: 'hung_piece', bestSan: 'Nc3', phase: 'opening' },
        { ply: 4, theme: 'hung_piece', bestSan: 'Nc3', phase: 'opening' },
        { ply: 12, theme: 'hung_piece', bestSan: 'Nc3', phase: 'middlegame' },
      ],
    });
    expect(phaseOf([opening], 'hung_piece')).toBe('opening');
  });
});

describe('positionBefore', () => {
  it('returns the position that many plies earlier', () => {
    const r = middlegameGame().review;
    const at = positionBefore(r, 12, 6);
    expect(at?.ply).toBe(6);
    expect(at?.fen).toBe(r.moves[6]?.fenBefore);
  });

  it('returns null rather than a position from before the game', () => {
    expect(positionBefore(middlegameGame().review, 2, 6)).toBeNull();
    // Control: the same review DOES answer when there is room.
    expect(positionBefore(middlegameGame().review, 12, 6)).not.toBeNull();
  });
});

describe('F-TS-5: the targeted game from the learner’s own position', () => {
  it('starts three moves before the mistake, with the learner on their own side', () => {
    const t = targetedGame({ games: [middlegameGame()], theme: 'hung_piece', now: NOW });
    expect(t.kind).toBe('own-position');
    if (t.kind !== 'own-position') return;
    expect(t.movesEarlier).toBe(PLIES_EARLIER / 2);
    expect(t.learner).toBe('w');
    // The side to move in the position IS the learner: they play from here.
    expect(turn(t.fen)).toBe('w');
    expect(legalMoves(t.fen).length).toBeGreaterThan(0);
    expect(t.reason).toContain('3 moves before it went wrong');
    expect(t.provenance).toBe('your game against Rosa on Tuesday');
  });

  it('walks back to as early as the game allows rather than refusing', () => {
    const early = anOwnGame({
      gameId: 'early',
      sans: LONG_SANS,
      // Ply 4 is White's 3rd move: six plies back does not exist, four does not either,
      // two does.
      errors: [{ ply: 4, theme: 'hung_piece', bestSan: 'Nc3' }],
    });
    const t = targetedGame({ games: [early], theme: 'hung_piece', now: NOW });
    expect(t.kind).toBe('own-position');
    if (t.kind !== 'own-position') return;
    expect(t.movesEarlier).toBe(2);
  });

  it('refuses when the mistake was on the first move', () => {
    const first = anOwnGame({ gameId: 'f', sans: LONG_SANS, errors: [{ ply: 0, theme: 'hung_piece', bestSan: 'd4' }] });
    const t = targetedGame({ games: [first], theme: 'hung_piece', now: NOW });
    expect(t).toMatchObject({ kind: 'none' });
    if (t.kind !== 'none') return;
    expect(t.reason).toContain('too early in the game');
  });

  it('refuses when no game shows the theme', () => {
    const t = targetedGame({ games: [middlegameGame()], theme: 'missed_mate', now: NOW });
    expect(t).toMatchObject({ kind: 'none' });
    // Control: the same games DO produce a game for a theme they carry.
    expect(targetedGame({ games: [middlegameGame()], theme: 'hung_piece', now: NOW }).kind).toBe('own-position');
  });

  it('uses the most recent game carrying the theme', () => {
    const older = anOwnGame({
      gameId: 'older',
      sans: LONG_SANS,
      errors: [{ ply: 12, theme: 'hung_piece', bestSan: 'Nc3' }],
      playedAt: '2026-01-01T00:00:00.000Z',
    });
    const t = targetedGame({ games: [middlegameGame(), older], theme: 'hung_piece', now: NOW });
    if (t.kind !== 'own-position') throw new Error('expected own-position');
    expect(t.provenance).toContain('Tuesday');
  });

  it('says why an endgame weakness gets an own position rather than a set-position drill', () => {
    const endgame = anOwnGame({
      gameId: 'end',
      sans: LONG_SANS,
      errors: [{ ply: 12, theme: 'hung_piece', bestSan: 'Nc3', phase: 'endgame' }],
    });
    const t = targetedGame({ games: [endgame], theme: 'hung_piece', now: NOW });
    if (t.kind !== 'own-position') throw new Error('expected own-position');
    expect(t.reason).toContain('no set-position endgame drill yet');
    // And a middlegame weakness does NOT carry that sentence.
    const m = targetedGame({ games: [middlegameGame()], theme: 'hung_piece', now: NOW });
    if (m.kind !== 'own-position') throw new Error('expected own-position');
    expect(m.reason).not.toContain('endgame drill');
  });
});

describe('F-TS-5: the opening line, played back from the other side', () => {
  const openingGame = anOwnGame({
    gameId: 'op',
    sans: LONG_SANS,
    errors: [
      { ply: 2, theme: 'hung_piece', bestSan: 'Nc3', phase: 'opening' },
      { ply: 4, theme: 'hung_piece', bestSan: 'Nc3', phase: 'opening' },
    ],
    opening: { name: 'Italian Game', leftBookAtPly: null },
  });

  it('hands the bot the line and gives the learner the other colour', () => {
    const t = targetedGame({ games: [openingGame], theme: 'hung_piece', now: NOW });
    expect(t.kind).toBe('opening-line');
    if (t.kind !== 'opening-line') return;
    // The learner was White in that game, so they are Black here.
    expect(t.learner).toBe('b');
    expect(t.openingName).toBe('Italian Game');
    expect(t.line).toHaveLength(LINE_PLIES);
    expect(t.line[0]).toBe('e2e4');
  });

  it('gives the bot UCI moves the route will accept', () => {
    const t = targetedGame({ games: [openingGame], theme: 'hung_piece', now: NOW });
    if (t.kind !== 'opening-line') throw new Error('expected opening-line');
    // The real validator from the play route, not a copy of its regex.
    expect(targetedFrom(null, t.line.join(' ')).line).toEqual(t.line);
  });
});

describe('the URL a targeted game opens', () => {
  it('turns coach mode on, per F-TS-5', () => {
    expect(playUrl({ learner: 'w' })).toContain('coach=1');
  });

  it('carries a FEN the play route accepts', () => {
    const t = targetedGame({ games: [middlegameGame()], theme: 'hung_piece', now: NOW });
    if (t.kind !== 'own-position') throw new Error('expected own-position');
    const fen = new URL(`http://x${t.to}`).searchParams.get('fen');
    expect(fen).toBe(t.fen);
    // And the route's own validator accepts it — the assertion that matters, because a
    // FEN it rejects silently becomes an ordinary game from the standard start.
    expect(targetedFrom(fen, null).fen).toBe(t.fen);
  });

  it('carries the colour, so the learner is put on the right side', () => {
    const t = targetedGame({ games: [middlegameGame()], theme: 'hung_piece', now: NOW });
    if (t.kind !== 'own-position') throw new Error('expected own-position');
    expect(new URL(`http://x${t.to}`).searchParams.get('color')).toBe('w');
  });
});

describe('the play route’s validation of those parameters', () => {
  it('refuses a FEN that is not a position', () => {
    expect(targetedFrom('not a fen', null)).toEqual({});
    // Control: a real FEN is accepted by the same call.
    expect(targetedFrom('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', null).fen).toBeDefined();
  });

  it('refuses a position with no legal move, which would be a dead board', () => {
    // Black is checkmated: white to move has moves, black does not. Use the mated side.
    expect(targetedFrom('7k/5KQ1/8/8/8/8/8/8 b - - 0 1', null)).toEqual({});
  });

  it('keeps only UCI-shaped tokens in a line, and drops a line with none', () => {
    expect(targetedFrom(null, 'e2e4 rubbish g1f3')?.line).toEqual(['e2e4', 'g1f3']);
    expect(targetedFrom(null, 'rubbish')).toEqual({});
    expect(targetedFrom(null, 'e7e8q').line).toEqual(['e7e8q']);
  });
});

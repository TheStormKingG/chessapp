import { describe, expect, it } from 'vitest';
import { legalMoves, turn } from '@/rules';
import { newEvent } from '@/data/events';
import type { ImportedGameRow } from '@/import/types';
import { gameReference, opponentNames, ownCandidates } from './ownPositions';
import { ITALIAN_SANS, anOwnGame } from './testReviews';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('ownCandidates', () => {
  const game = anOwnGame({
    gameId: 'g1',
    sans: ITALIAN_SANS,
    // Ply 6 is White's 4th move, Ng5.
    errors: [{ ply: 6, theme: 'hung_piece', bestSan: 'd3' }],
    playedAt: '2026-09-22T18:00:00.000Z',
    opponent: 'Rosa',
  });

  it('gives the position before the mistake, with the learner to move', () => {
    const [c] = ownCandidates({ games: [game], theme: 'hung_piece', now: NOW });
    expect(c).toBeDefined();
    expect(turn(c?.fen ?? '')).toBe('w');
    expect(c?.playedSan).toBe('Ng5');
    expect(c?.bestSan).toBe('d3');
  });

  it('gives an answer that is legal in that position', () => {
    // The failure this catches is a candidate whose answer cannot be played: the
    // board still renders and the learner can never be right.
    const [c] = ownCandidates({ games: [game], theme: 'hung_piece', now: NOW });
    const legal = legalMoves(c?.fen ?? '').map((m) => m.uci);
    expect(legal).toContain(c?.bestUci);
  });

  it('carries the opponent’s move that produced the position, for a literal replay', () => {
    const [c] = ownCandidates({ games: [game], theme: 'hung_piece', now: NOW });
    // Ply 5 is Black's Nf6, and playing it from `lead.fen` must reach the
    // challenge position.
    expect(c?.lead?.san).toBe('Nf6');
    expect(turn(c?.lead?.fen ?? '')).toBe('b');
    expect(legalMoves(c?.lead?.fen ?? '').map((m) => m.uci)).toContain(c?.lead?.uci);
  });

  it('has no lead-in when the mistake was the learner’s first move', () => {
    const first = anOwnGame({
      gameId: 'g2',
      sans: ITALIAN_SANS,
      errors: [{ ply: 0, theme: 'hung_piece', bestSan: 'd4' }],
    });
    const [c] = ownCandidates({ games: [first], theme: 'hung_piece', now: NOW });
    expect(c?.lead).toBeNull();
    // Positive control: the same function DOES find a lead when one exists, so the
    // null above is about ply 0 and not about the lookup.
    expect(ownCandidates({ games: [game], theme: 'hung_piece', now: NOW })[0]?.lead).not.toBeNull();
  });

  it('refuses a lead-in that is the learner’s own move', () => {
    // A well-formed review alternates, so `ply - 1` is always the opponent's move
    // and this guard cannot fire from real data. It is here because the failure it
    // prevents is invisible: a puzzle built from such a lead replays the LEARNER's
    // move as the opponent's, and every board still looks legal. Asserted against a
    // hand-built odd review rather than left as an untested line.
    const odd = anOwnGame({ gameId: 'odd', sans: ITALIAN_SANS, errors: [{ ply: 6, theme: 'hung_piece', bestSan: 'd3' }] });
    const before = odd.review.moves[5];
    if (before) before.mover = 'w'; // the learner's colour, on the ply before the mistake
    expect(ownCandidates({ games: [odd], theme: 'hung_piece', now: NOW })[0]?.lead).toBeNull();
  });

  it('selects by theme, and finds nothing for a theme the game has no errors of', () => {
    expect(ownCandidates({ games: [game], theme: 'missed_mate', now: NOW })).toHaveLength(0);
    // The control that makes the empty result meaningful.
    expect(ownCandidates({ games: [game], theme: 'hung_piece', now: NOW })).toHaveLength(1);
  });

  it('keeps the caller’s game order as the recency rank', () => {
    const older = anOwnGame({
      gameId: 'old',
      sans: ITALIAN_SANS,
      errors: [{ ply: 6, theme: 'hung_piece', bestSan: 'Nc3' }],
      playedAt: '2026-08-01T12:00:00.000Z',
    });
    const cs = ownCandidates({ games: [game, older], theme: 'hung_piece', now: NOW });
    expect(cs.map((c) => c.gameId)).toEqual(['g1', 'old']);
    expect(cs.map((c) => c.gameRank)).toEqual([0, 1]);
  });
});

describe('gameReference: F-TS-3’s “your game against Rosa on Tuesday”', () => {
  it('names the opponent and the weekday for a game inside the last week', () => {
    // 2026-09-22 was a Tuesday.
    expect(gameReference({ opponent: 'Rosa', playedAt: '2026-09-22T18:00:00.000Z' }, NOW)).toBe(
      'your game against Rosa on Tuesday',
    );
  });

  it('uses a date once the weekday would be a lie', () => {
    expect(gameReference({ opponent: 'Rosa', playedAt: '2026-08-14T18:00:00.000Z' }, NOW)).toBe(
      'your game against Rosa on 14 August',
    );
  });

  it('holds the boundary at seven days', () => {
    expect(gameReference({ opponent: 'R', playedAt: '2026-09-20T12:00:00.000Z' }, NOW)).toContain('on Sunday');
    expect(gameReference({ opponent: 'R', playedAt: '2026-09-19T11:00:00.000Z' }, NOW)).toContain('on 19 September');
  });

  it('drops the name rather than inventing one', () => {
    expect(gameReference({ opponent: null, playedAt: '2026-09-22T18:00:00.000Z' }, NOW)).toBe(
      'your game on Tuesday',
    );
  });

  it('survives a date it cannot read', () => {
    expect(gameReference({ opponent: 'Rosa', playedAt: 'not a date' }, NOW)).toBe('your game against Rosa');
  });
});

describe('opponentNames', () => {
  const importedRow = (gameId: string, opponent: string) =>
    ({ gameId, opponent, source: 'lichess', learner: 'w', result: 'loss', speed: 'rapid', playedAt: '2026-09-01T00:00:00.000Z', sans: [], pgn: '', learnerElo: null, opponentElo: null, analysed: 0 }) as unknown as ImportedGameRow;

  it('takes an imported game’s opponent from the row', () => {
    const names = opponentNames({ imported: [importedRow('i1', 'magnus')], events: [], personaNames: {} });
    expect(names.get('i1')).toBe('magnus');
  });

  it('takes an in-app game’s opponent from the persona the event names', () => {
    const e = newEvent({
      type: 'game_started',
      gameId: 'a1',
      persona: 'rosa',
      color: 'w',
      timeControl: 'untimed',
      coach: true,
    });
    const names = opponentNames({ imported: [], events: [e], personaNames: { rosa: 'Rosa' } });
    expect(names.get('a1')).toBe('Rosa');
  });

  it('prefers the imported row when both sources know a game', () => {
    // A gameId belongs to one side of the import seam in practice. If it ever
    // belonged to both, the imported row is the truthful one: it names a real
    // player, while a persona is the app's own bot. Tested because the precedence
    // is a silent choice — both branches produce a plausible name.
    const e = newEvent({
      type: 'game_started',
      gameId: 'both',
      persona: 'rosa',
      color: 'w',
      timeControl: 'untimed',
      coach: true,
    });
    const names = opponentNames({
      imported: [importedRow('both', 'magnus')],
      events: [e],
      personaNames: { rosa: 'Rosa' },
    });
    expect(names.get('both')).toBe('magnus');
  });

  it('records nothing for a persona id it cannot name, rather than showing the id', () => {
    const e = newEvent({
      type: 'game_started',
      gameId: 'a2',
      persona: 'someone-new',
      color: 'w',
      timeControl: 'untimed',
      coach: true,
    });
    const names = opponentNames({ imported: [], events: [e], personaNames: { rosa: 'Rosa' } });
    expect(names.has('a2')).toBe(false);
    // Positive control: the same events array yields a name when the map has one.
    expect(
      opponentNames({ imported: [], events: [e], personaNames: { 'someone-new': 'Sam' } }).get('a2'),
    ).toBe('Sam');
  });
});

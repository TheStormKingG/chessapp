import { newEvent } from '@/data';
import type { LearnerEvent } from '@/data';
import { sourceFromEvents, positionsOf } from './gameSource';
import { START_FEN } from '@/rules';

function started(gameId: string, color: 'w' | 'b'): LearnerEvent {
  return newEvent({ type: 'game_started', gameId, persona: 'rosa', color, timeControl: 'untimed', coach: true });
}
function finished(gameId: string, pgn: string): LearnerEvent {
  return newEvent({ type: 'game_finished', gameId, result: 'win', moves: 2, hints: 0, takebacks: 0, crowns: 3, pgn });
}

test('a source is the join of game_started and game_finished on gameId', () => {
  const s = sourceFromEvents([started('g1', 'b'), finished('g1', 'e4 e5 Nf3')], 'g1');
  expect(s).not.toBeNull();
  expect(s!.learner).toBe('b');
  expect(s!.persona).toBe('rosa');
  expect(s!.sans).toEqual(['e4', 'e5', 'Nf3']);
  expect(s!.result).toBe('win');
});

test('a game with no game_finished is not reviewable', () => {
  expect(sourceFromEvents([started('g1', 'w')], 'g1')).toBeNull();
});

test('a game with no game_started is not reviewable, because the colour is unknown', () => {
  // Guessing white would mis-label every move of every black game. Better to
  // say so than to review the wrong player.
  expect(sourceFromEvents([finished('g1', 'e4 e5')], 'g1')).toBeNull();
});

test('a game with no moves is not reviewable', () => {
  expect(sourceFromEvents([started('g1', 'w'), finished('g1', '')], 'g1')).toBeNull();
});

test('events for other games are ignored', () => {
  const s = sourceFromEvents([started('g1', 'w'), finished('g1', 'e4'), started('g2', 'b'), finished('g2', 'd4 d5')], 'g2');
  expect(s!.learner).toBe('b');
  expect(s!.sans).toEqual(['d4', 'd5']);
});

test('positionsOf replays SAN into one more position than there are moves', () => {
  const p = positionsOf(['e4', 'e5', 'Nf3']);
  expect(p.fens).toHaveLength(4);
  expect(p.fens[0]).toBe(START_FEN);
  expect(p.ucis).toEqual(['e2e4', 'e7e5', 'g1f3']);
  expect(p.fens[1]).toContain(' b ');
});

test('positionsOf throws on a SAN list that does not replay', () => {
  expect(() => positionsOf(['e4', 'e4'])).toThrow(/replay/);
});

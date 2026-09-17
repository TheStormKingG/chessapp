import { CoachService } from './CoachService';

const coach = new CoachService(() => 0); // deterministic: always the first template

test('fills a template from facts', () => {
  expect(coach.line('hang', { pieceName: 'knight', square: 'e5' })).toBe('Careful, your knight on e5 can be taken for free.');
});

test('refuses a template whose facts are missing', () => {
  expect(() => coach.line('hang', { pieceName: 'knight' })).toThrow(/missing fact square/);
});

test('refuses an empty-string fact', () => {
  expect(() => coach.line('hang', { pieceName: '', square: 'e5' })).toThrow(/missing fact pieceName/);
});

test('picks by rng among variants', () => {
  const c2 = new CoachService(() => 0.99);
  expect(c2.line('hang', { pieceName: 'rook', square: 'a1' })).toBe('Your rook on a1 is hanging.');
});

test('templates without placeholders ignore extra facts', () => {
  expect(coach.line('castled', { pieceName: 'king' })).toBe('Castled. Your king is safer now.');
});

test('pieceName helper', () => {
  expect(CoachService.pieceName('n')).toBe('knight');
  expect(CoachService.pieceName('k')).toBe('king');
});

test('muted coach returns null', () => {
  const c = new CoachService(() => 0); c.muted = true;
  expect(c.line('castled', {})).toBeNull();
});

import { stars } from './stars';

test('three stars: no hints, at most one miss', () => {
  expect(stars({ hints: 0, misses: 1 })).toBe(3);
});
test('two stars: any hint or two misses', () => {
  expect(stars({ hints: 1, misses: 0 })).toBe(2);
  expect(stars({ hints: 0, misses: 2 })).toBe(2);
});
test('one star otherwise', () => {
  expect(stars({ hints: 3, misses: 5 })).toBe(1);
});

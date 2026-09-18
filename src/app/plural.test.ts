import { expect, test } from 'vitest';
import { plural } from './plural';

test('a count of one takes the singular noun', () => {
  expect(plural(1, 'star')).toBe('1 star');
  expect(plural(1, 'hint')).toBe('1 hint');
  expect(plural(1, 'miss', 'misses')).toBe('1 miss');
});

test('zero and two or more take the plural noun', () => {
  expect(plural(0, 'star')).toBe('0 stars');
  expect(plural(2, 'star')).toBe('2 stars');
  expect(plural(0, 'miss', 'misses')).toBe('0 misses');
  expect(plural(3, 'miss', 'misses')).toBe('3 misses');
});

test('the plural defaults to the noun plus s when no irregular form is given', () => {
  expect(plural(2, 'hint')).toBe('2 hints');
});

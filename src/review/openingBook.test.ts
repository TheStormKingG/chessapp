import { readFileSync } from 'node:fs';

import { parseBook, lookupOpening } from './openingBook';

/**
 * A hand-built book, so the test is about the lookup and not about upstream
 * data. Paths are UCI, concatenated, 4 characters per ply.
 *
 *   e2e4                     -> "King's Pawn Game"
 *   e2e4 c7c5                -> "Sicilian Defense"
 *   e2e4 c7c5 g1f3           -> "Sicilian Defense: Open"
 *   d2d4                     -> "Queen's Pawn Game"
 */
const FIXTURE = [
  'v1 4 20',
  'd2d4\t3',
  'e2e4\t0',
  'e2e4c7c5\t1',
  'e2e4c7c5g1f3\t2',
  '@@',
  "King's Pawn Game",
  'Sicilian Defense',
  'Sicilian Defense: Open',
  "Queen's Pawn Game",
  '',
].join('\n');

test('parseBook reads the header, the paths and the names', () => {
  const b = parseBook(FIXTURE);
  expect(b.maxPly).toBe(20);
  expect(b.paths).toHaveLength(4);
  expect(b.names).toHaveLength(4);
  // Sorted, so d2d4 comes first.
  expect(b.paths[0]).toBe('d2d4');
});

test('parseBook rejects a file whose header count does not match its body', () => {
  const broken = FIXTURE.replace('v1 4 20', 'v1 9 20');
  expect(() => parseBook(broken)).toThrow(/expected 9 lines/);
});

test('the deepest named prefix wins', () => {
  const b = parseBook(FIXTURE);
  const r = lookupOpening(b, ['e2e4', 'c7c5', 'g1f3', 'd7d6']);
  expect(r.name).toBe('Sicilian Defense: Open');
});

test('leftBookAtPly is the first ply that is not in the book', () => {
  const b = parseBook(FIXTURE);
  // e4 c5 Nf3 are all book; d6 is not.
  const r = lookupOpening(b, ['e2e4', 'c7c5', 'g1f3', 'd7d6']);
  expect(r.leftBookAtPly).toBe(3);
  expect(r.bookPlies).toEqual([true, true, true, false]);
});

test('a game that never leaves the book reports leftBookAtPly null', () => {
  const b = parseBook(FIXTURE);
  const r = lookupOpening(b, ['e2e4', 'c7c5']);
  expect(r.leftBookAtPly).toBeNull();
  expect(r.name).toBe('Sicilian Defense');
});

test('a first move outside the book has no name and leaves at ply 0', () => {
  const b = parseBook(FIXTURE);
  const r = lookupOpening(b, ['a2a4', 'e7e5']);
  expect(r.name).toBeNull();
  expect(r.leftBookAtPly).toBe(0);
  expect(r.bookPlies).toEqual([false, false]);
});

test('an unnamed book prefix still counts as book', () => {
  // e2e4 c7c5 g1f3 is named; but a book whose only entry is the deep line must
  // still treat the prefixes as book, because the game passed through them.
  const deepOnly = ['v1 1 20', 'e2e4c7c5g1f3\t0', '@@', 'Sicilian Defense: Open', ''].join('\n');
  const b = parseBook(deepOnly);
  const r = lookupOpening(b, ['e2e4', 'c7c5', 'g1f3']);
  expect(r.bookPlies).toEqual([true, true, true]);
  expect(r.name).toBe('Sicilian Defense: Open');
});

test('book status stops at maxPly even when the line would continue', () => {
  const short = ['v1 1 2', 'e2e4e7e5\t0', '@@', 'Open Game', ''].join('\n');
  const b = parseBook(short);
  const r = lookupOpening(b, ['e2e4', 'e7e5', 'g1f3']);
  expect(r.bookPlies).toEqual([true, true, false]);
  expect(r.leftBookAtPly).toBe(2);
});

test('the shipped book names a real opening and finds where a real game left it', () => {
  const b = parseBook(readFileSync('public/data/openings.txt', 'utf8'));
  expect(b.paths.length).toBeGreaterThan(3000);

  // 1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 — the Najdorf, deep in book.
  const najdorf = ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'];
  const r = lookupOpening(b, najdorf);
  expect(r.name).toMatch(/Najdorf/);
  expect(r.leftBookAtPly).toBeNull();

  // A second move that is not a node of the book leaves book at ply 1.
  //
  // 1...b5 is the ONLY legal reply to 1. e4 that this source does not name:
  // every other one, 1...h5 (Goldsmith Defense) included, is a named line and
  // is therefore Book under the substitute rule in openingBook.ts. That is the
  // rule's documented looseness, measured against the shipped file rather than
  // assumed — Appendix C's 5-per-cent rule would call almost none of them Book.
  const offBook = ['e2e4', 'b7b5', 'g1f3'];
  const j = lookupOpening(b, offBook);
  expect(j.leftBookAtPly).toBe(1);
  expect(j.bookPlies).toEqual([true, false, false]);

  // And the ply before it really was in the book, so the 1 above is a boundary
  // and not a blanket "nothing matched".
  expect(lookupOpening(b, ['e2e4']).leftBookAtPly).toBeNull();
});

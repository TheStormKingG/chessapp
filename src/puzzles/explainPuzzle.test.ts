import { CoachService } from '@/coach';
import { explainPuzzle, PUZZLE_EVENT, PUZZLE_FACTS } from './explainPuzzle';
import { THEMES } from './themes';

/** A deterministic coach: always the first template variant. */
const coach = () => new CoachService(() => 0);

/** Black to move; `h1h2` is the answer and `h1g1` is what the learner played. */
const FEN = '8/8/8/8/8/8/8/K6k b - - 0 1';
const miss = { fen: FEN, playedUci: 'h1g1', bestUci: 'h1h2' };

/**
 * Both of the first two tests are required and neither substitutes for the
 * other. "A fact nobody verified yields null" is satisfied on its own by a
 * function that always returns null — which is exactly the defect the review
 * feature shipped: `explain.ts`'s honesty rule worked perfectly while its only
 * call site supplied no facts, so the two commonest themes rendered with no
 * explanation at all, and the silence looked like discipline.
 */
test('a real miss produces real text, not silence', () => {
  const text = explainPuzzle(coach(), { ...miss, theme: 'fork' });
  expect(text).not.toBeNull();
  expect(text).toMatch(/\S.{20,}/); // a sentence, not a stub
  expect(text).not.toMatch(/\{\w+\}/); // no unreplaced placeholder
  // It names both moves, which are the only two facts it has.
  expect(text).toContain('Kh2');
  expect(text).toContain('Kg1');
});

test('a position with no motif yields null rather than an invention', () => {
  // `queue.ts` builds drills from the learner's own errors with no theme at
  // all, and that is the COMMON case: the review tagger classifies four of
  // PRD §10.3's sixteen motifs. There is no verified idea to name, so nothing
  // is said.
  expect(explainPuzzle(coach(), { ...miss, theme: null })).toBeNull();
});

test('a fact the caller cannot supply yields null rather than an invention', () => {
  // An illegal played move has no SAN, so `playedSan` cannot be supplied and
  // the template that needs it must not be filled with something plausible.
  expect(explainPuzzle(coach(), { ...miss, playedUci: 'a8a7', theme: 'fork' })).toBeNull();
});

test('the underlying throw is real — CoachService is not being handed a default', () => {
  // If this does NOT throw, explainPuzzle is filling a fact from somewhere and
  // the null above is coming from the wrong place.
  let threw = false;
  try {
    coach().line(PUZZLE_EVENT.fork, { playedSan: 'Kg1' });
  } catch (e) {
    threw = true;
    expect((e as Error).message).toMatch(/missing fact/);
  }
  expect(threw).toBe(true);
});

test('every theme the packs ship has a template, and every one of them renders', () => {
  expect(THEMES).toHaveLength(8); // lower bound: the sweep is not empty
  expect(Object.keys(PUZZLE_EVENT).sort()).toEqual([...THEMES].sort());
  for (const theme of THEMES) {
    const text = explainPuzzle(coach(), { ...miss, theme });
    expect(text, `${theme} rendered nothing`).not.toBeNull();
    expect(text, `${theme} left a placeholder unfilled`).not.toMatch(/\{\w+\}/);
  }
});

test('an explanation is one to three sentences', () => {
  const text = explainPuzzle(coach(), { ...miss, theme: 'skewer' })!;
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  expect(sentences.length).toBeGreaterThanOrEqual(1);
  expect(sentences.length).toBeLessThanOrEqual(3);
});

test('explaining leaves the coach’s mute setting exactly as it found it', () => {
  // A learner who muted the in-game chatter did not ask for a wordless puzzle.
  const c = coach();
  c.muted = true;
  expect(explainPuzzle(c, { ...miss, theme: 'fork' })).not.toBeNull();
  expect(c.muted).toBe(true);
  explainPuzzle(c, { ...miss, playedUci: 'a8a7', theme: 'fork' }); // throws internally
  expect(c.muted).toBe(true);
});

test('the supplied-fact list is the facts the module actually supplies', () => {
  // PUZZLE_FACTS is what the template sweep in explain.test.ts checks every
  // puzzle template against, so a stale list would widen that sweep silently.
  expect([...PUZZLE_FACTS].sort()).toEqual(['bestSan', 'playedSan']);
});

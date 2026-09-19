import templates from '@content/coach/templates.json';
import { CoachService } from '@/coach';
import { explainMoment, askForBetter, REVIEW_EVENTS, SUPPLIED_FACTS, THEME_EVENT } from './explain';
import type { ReviewedMove } from './types';
import type { Theme } from './errorLog';

const BANK = templates.templates as Record<string, string[]>;
const reviewKeys = Object.keys(BANK).filter((k) => k.startsWith('review'));
const THEMES: Theme[] = ['hung_piece', 'missed_capture', 'missed_mate', 'ignored_threat', 'unclassified'];

function mv(o: Partial<ReviewedMove> = {}): ReviewedMove {
  return {
    ply: 4,
    san: 'Qh5',
    uci: 'd1h5',
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 1',
    mover: 'w',
    best: { uci: 'g1f3', san: 'Nf3' },
    winBefore: 55,
    winAfterPlayed: 25,
    drop: 30,
    accuracy: 20,
    label: 'Blunder',
    book: false,
    phase: 'opening',
    ...o,
  };
}

// A deterministic coach: always the first template variant.
const coach = () => new CoachService(() => 0);

test('an explanation names the move played and the move that was better', () => {
  const t = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: null });
  expect(t).toContain('Nf3');
  expect(t).toContain('Qh5');
});

test('a hung piece explanation names the piece and the square', () => {
  const t = explainMoment(coach(), {
    move: mv(),
    theme: 'hung_piece',
    lessonTitle: null,
    hung: { pieceName: 'queen', square: 'h5' },
  });
  expect(t).toContain('queen');
  expect(t).toContain('h5');
});

test('a good move is praised, not explained away', () => {
  const t = explainMoment(coach(), { move: mv({ label: 'Best', drop: 0 }), theme: 'unclassified', lessonTitle: null });
  expect(t).toContain('Qh5');
  expect(t).not.toContain('stronger');
});

test('a lesson link is appended when there is a lesson, and not when there is not', () => {
  const withLesson = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: 'Forks' });
  expect(withLesson).toContain('Forks');
  const without = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: null });
  expect(without).not.toContain('Replay');
});

test('a missing fact yields null rather than an invented sentence', () => {
  // hung_piece needs pieceName and square. Withhold them.
  const t = explainMoment(coach(), { move: mv(), theme: 'hung_piece', lessonTitle: null });
  expect(t).toBeNull();
});

test('the underlying throw is real — CoachService is not being handed a default', () => {
  // The subject here is an error, so the error path must be the handled path.
  // If this does NOT throw, explainMoment is filling in a fact from somewhere
  // and F-CO-4 is broken.
  let threw = false;
  try {
    coach().line('reviewHungPiece', { playedSan: 'Qh5', bestSan: 'Nf3' });
  } catch (e) {
    threw = true;
    expect((e as Error).message).toMatch(/missing fact/);
  }
  expect(threw).toBe(true);
});

test('a muted coach still explains — muting the in-game coach is not muting the review', () => {
  const c = coach();
  c.muted = true;
  const t = explainMoment(c, { move: mv(), theme: 'unclassified', lessonTitle: null });
  expect(t).not.toBeNull();
});

test('explaining leaves the coach’s mute setting exactly as it found it', () => {
  const c = coach();
  c.muted = true;
  explainMoment(c, { move: mv(), theme: 'hung_piece', lessonTitle: null }); // throws internally
  expect(c.muted).toBe(true);
  askForBetter(c, mv());
  expect(c.muted).toBe(true);
});

test('askForBetter poses the question without revealing the answer', () => {
  const t = askForBetter(coach(), mv())!;
  expect(t).toContain('Qh5');
  expect(t).not.toContain('Nf3');
});

test('an explanation is one to three sentences (F-RV-5)', () => {
  const t = explainMoment(coach(), { move: mv(), theme: 'unclassified', lessonTitle: 'Forks' })!;
  const sentences = t.split(/(?<=[.?!])\s+/).filter(Boolean);
  expect(sentences.length).toBeGreaterThanOrEqual(1);
  expect(sentences.length).toBeLessThanOrEqual(3);
});

// --- Task 20: properties, not cases -----------------------------------------

test('every review template only uses placeholders the review can verify', () => {
  // SUPPLIED_FACTS is the module's own list, not a copy re-typed here: a fact
  // added to explain.ts widens this sweep automatically, and a fact removed
  // narrows it, which is the only way the two can stay in step.
  const supplied = new Set<string>(SUPPLIED_FACTS);
  expect(reviewKeys.length).toBeGreaterThan(0); // the sweep must have inputs

  for (const key of reviewKeys) {
    for (const variant of BANK[key]!) {
      for (const [, name] of variant.matchAll(/\{(\w+)\}/g)) {
        expect(supplied.has(name!), `${key} uses {${name}}, which nothing verifies`).toBe(true);
      }
    }
  }
});

test('every review template in the bank is one this module actually uses', () => {
  // An orphan template is where an unaudited sentence hides: nothing renders it,
  // so no test exercises it, and the next caller finds it and ships it.
  expect(reviewKeys.length).toBeGreaterThan(0);
  const used = new Set<string>(REVIEW_EVENTS);
  for (const key of reviewKeys) {
    expect(used.has(key), `${key} is in the bank but no code path renders it`).toBe(true);
  }
  for (const used_ of REVIEW_EVENTS) {
    expect(reviewKeys, `${used_} is rendered but absent from the bank`).toContain(used_);
  }
});

test('every review variant carries at least one placeholder', () => {
  // A variant with no placeholder asserts something unconditionally, which is
  // the one shape the missing-fact throw can never police.
  expect(reviewKeys.length).toBeGreaterThan(0);
  for (const key of reviewKeys) {
    expect(BANK[key]!.length).toBeGreaterThan(0);
    for (const variant of BANK[key]!) {
      expect([...variant.matchAll(/\{(\w+)\}/g)].length, `${key}: "${variant}" states a fact-free claim`).toBeGreaterThan(0);
    }
  }
});

test('every theme has a template, and every one of them renders', () => {
  expect(THEMES).toHaveLength(5); // lower bound: the sweep is not empty
  expect(Object.keys(THEME_EVENT).sort()).toEqual([...THEMES].sort());
  for (const theme of THEMES) {
    const t = explainMoment(coach(), {
      move: mv(),
      theme,
      lessonTitle: null,
      hung: { pieceName: 'queen', square: 'h5' },
      free: { pieceName: 'knight', square: 'e5' },
    });
    expect(t, `theme ${theme} produced no explanation with every fact supplied`).not.toBeNull();
  }
});

test('no combination of variants ever exceeds three sentences (F-RV-5)', () => {
  // The single-case sentence test above measures one variant of one theme. The
  // bound has to hold for the whole cross-product, because the coach picks a
  // variant at random at run time.
  const widest = Math.max(...reviewKeys.map((k) => BANK[k]!.length));
  expect(widest).toBeGreaterThan(1); // otherwise this sweep is one case again
  let checked = 0;
  for (let i = 0; i < widest; i++) {
    const c = new CoachService(() => i / widest);
    for (const theme of THEMES) {
      for (const lessonTitle of [null, 'Take free pieces']) {
        for (const label of ['Blunder', 'Best'] as const) {
          const t = explainMoment(c, {
            move: mv({ label }),
            theme,
            lessonTitle,
            hung: { pieceName: 'queen', square: 'h5' },
            free: { pieceName: 'knight', square: 'e5' },
          })!;
          expect(t, `${theme}/${label}/variant ${i} produced nothing`).not.toBeNull();
          const sentences = t.split(/(?<=[.?!])\s+/).filter(Boolean);
          expect(sentences.length, `${theme}/${label}/variant ${i}: "${t}"`).toBeGreaterThanOrEqual(1);
          expect(sentences.length, `${theme}/${label}/variant ${i}: "${t}"`).toBeLessThanOrEqual(3);
          checked++;
        }
      }
    }
  }
  expect(checked).toBe(widest * THEMES.length * 2 * 2);
});

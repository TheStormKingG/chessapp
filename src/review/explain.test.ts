import { CoachService } from '@/coach';
import { explainMoment, askForBetter } from './explain';
import type { ReviewedMove } from './types';

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

import { reviewFor, deepenMoments, bankReview, materialSwing } from './useReview';
import { derivedFrom } from './buildReview';
import type { Review } from './types';

/** A fake Dexie table with just the two methods the module uses. */
function fakeTable() {
  const rows = new Map<string, Review>();
  return {
    rows,
    get: async (k: string) => rows.get(k),
    put: async (r: Review) => {
      rows.set(r.gameId, r);
      return r.gameId;
    },
  };
}

const SANS = ['e4', 'e5', 'Nf3', 'Nc6'];

function fakeEngine() {
  return {
    analyse: async (req: { fen: string; depth: number; multiPv?: number }) => ({
      lines:
        (req.multiPv ?? 1) >= 2
          ? [
              { move: 'g1f3', pv: ['g1f3'], score: { cp: 30 }, depth: req.depth },
              { move: 'b1c3', pv: ['b1c3'], score: { cp: 10 }, depth: req.depth },
            ]
          : [{ move: 'g1f3', pv: ['g1f3'], score: { cp: 20 }, depth: req.depth }],
      depth: req.depth,
    }),
  };
}

/** Narrows the event union, and fails loudly rather than silently, if the
 *  payload is not the one this feature appends. */
function reviewed(p: ReturnType<typeof bankReview>) {
  if (p === null || p.type !== 'game_reviewed') throw new Error(`not a game_reviewed payload: ${JSON.stringify(p)}`);
  return p;
}

const source = {
  gameId: 'g1',
  learner: 'w' as const,
  persona: 'rosa',
  sans: SANS,
  result: 'win' as const,
  timeControl: 'untimed' as const,
  startedAt: '2026-09-19T00:00:00.000Z',
};

test('a cached complete review is returned without touching the engine', async () => {
  const table = fakeTable();
  const cached = { gameId: 'g1', partial: false, moves: [], keyMoments: [] } as unknown as Review;
  await table.put(cached);
  let called = 0;
  const engine = { analyse: async () => { called += 1; throw new Error('should not be called'); } };
  const r = await reviewFor({ source, table, engine: engine as never, band: 1, book: null });
  expect(r.review).toBe(cached);
  expect(called).toBe(0);
});

test('a cached PARTIAL review is re-run, not served', async () => {
  const table = fakeTable();
  await table.put({ gameId: 'g1', partial: true, moves: [], keyMoments: [] } as unknown as Review);
  const r = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  expect(r.review.partial).toBe(false);
  expect(r.review.moves.length).toBeGreaterThan(0);
});

test('a completed review is written to the table', async () => {
  const table = fakeTable();
  await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  expect(table.rows.has('g1')).toBe(true);
});

test('deepenMoments fills each moment and leaves the rest alone', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  expect(review.keyMoments.length).toBeGreaterThan(0); // the sweep has inputs
  const filled = await deepenMoments(review, fakeEngine() as never, 16, 1);
  for (const m of filled.keyMoments) {
    expect(m.deeper).not.toBeNull();
    expect(m.deeper!.depth).toBe(16);
    expect(m.deeper!.secondWin).not.toBeNull();
  }
});

test('a moment with only one legal reply gets a null secondWin, not a fabricated one', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  const oneLine = { analyse: async (req: { depth: number }) => ({ lines: [{ move: 'g1f3', pv: ['g1f3'], score: { cp: 30 }, depth: req.depth }], depth: req.depth }) };
  const filled = await deepenMoments(review, oneLine as never, 16, 1);
  expect(filled.keyMoments.length).toBeGreaterThan(0);
  for (const m of filled.keyMoments) expect(m.deeper?.secondWin).toBeNull();
});

test('the deeper pass is what applies Great — without it the label never appears', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  const before = review.keyMoments.map((m) => review.moves[m.ply]!.label);
  // A wide gap between the first and second lines makes every Best an only move.
  const wide = {
    analyse: async (req: { depth: number; multiPv?: number }) => ({
      lines: [
        { move: 'g1f3', pv: ['g1f3'], score: { cp: 400 }, depth: req.depth },
        { move: 'b1c3', pv: ['b1c3'], score: { cp: -400 }, depth: req.depth },
      ],
      depth: req.depth,
    }),
  };
  const filled = await deepenMoments(review, wide as never, 16, 1);
  const after = filled.keyMoments.map((m) => filled.moves[m.ply]!.label);
  // At least one label changed, and nothing outside the key moments moved.
  expect(after).not.toEqual(before);
  filled.moves.forEach((m, i) => {
    if (!filled.keyMoments.some((k) => k.ply === i)) expect(m.label).toBe(review.moves[i]!.label);
  });
});

test('materialSwing is negative when the mover gives material away', () => {
  const before = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
  const after = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  expect(materialSwing(before, after, 'w')).toBeGreaterThan(0);
  // And negative from the other side's point of view.
  expect(materialSwing(before, after, 'b')).toBeLessThan(0);
});

test('banking a complete review produces exactly one payload', () => {
  const review = {
    gameId: 'g1',
    partial: false,
    accuracy: { w: 72.5, b: 60 },
    learner: 'w',
    counts: { Blunder: 2, Mistake: 3 },
  } as unknown as Review;
  const p = bankReview(review, true);
  expect(p).toEqual({
    type: 'game_reviewed',
    gameId: 'g1',
    accuracy: 72.5,
    blunders: 2,
    mistakes: 3,
    drillCompleted: true,
    partial: false,
  });
});

/**
 * PRD 2.2 counts a game only when it was reviewed, and a partial review is a
 * real review the learner sat through — it is partial because their device was
 * slow, which is not something they can fix. Refusing it took the credit away
 * from exactly the learners least able to do anything about it, so it is
 * banked. `partial: true` keeps the event log honest about which kind it was.
 */
test('a partial review is banked, and the event says it was partial', () => {
  const review = { gameId: 'g1', partial: true, accuracy: { w: 50, b: 40 }, learner: 'w', counts: { Blunder: 1 } } as unknown as Review;
  const p = reviewed(bankReview(review, false));
  expect(p.partial).toBe(true);
  expect(p.gameId).toBe('g1');
  expect(p.accuracy).toBe(50);
  expect(p.blunders).toBe(1);
});

test('banking uses the learner’s own accuracy, not the opponent’s', () => {
  const review = { gameId: 'g1', partial: false, accuracy: { w: 30, b: 90 }, learner: 'b', counts: {} } as unknown as Review;
  expect(reviewed(bankReview(review, false)).accuracy).toBe(90);
});

test('a null accuracy banks as 0 rather than crashing or claiming 100', () => {
  const review = { gameId: 'g1', partial: false, accuracy: { w: null, b: null }, learner: 'w', counts: {} } as unknown as Review;
  expect(reviewed(bankReview(review, false)).accuracy).toBe(0);
});

/**
 * Defect 2 of the spec-coverage audit. `buildReview` computes every derived
 * field from the FIRST-pass labels; `deepenMoments` then rewrites labels in
 * place and nothing recomputes. A Brilliant shows on its key-moment chip while
 * the summary of the same game counts zero Brilliants.
 *
 * This is written generically on purpose. Asserting "counts.Great is 1" would
 * pass forever while a fourth derived field rotted silently; asserting that the
 * stored review equals one rebuilt from its own final moves fails the moment
 * ANY move-derived field stops being recomputed.
 *
 * `keyMoments` is deliberately not in this check, and not recomputed by the
 * fix. It is move-derived, but recomputing it after the upgrade would discard
 * every `deeper` result just obtained and is circular besides — the upgrade
 * only ever runs on moves that are already in the list, and its own output
 * (Great, Brilliant) is not in the `Best`/`Excellent` pool the `found` kind
 * selects from, so a recompute would drop the very moment it just upgraded.
 */
test('every move-derived field agrees with the moves after the deeper pass', async () => {
  const table = fakeTable();
  const { review } = await reviewFor({ source, table, engine: fakeEngine() as never, band: 1, book: null });
  // A wide gap between the two lines makes each Best an only move, so at least
  // one label is upgraded and the derived fields have something to disagree on.
  const wide = {
    analyse: async (req: { depth: number; multiPv?: number }) => ({
      lines: [
        { move: 'g1f3', pv: ['g1f3'], score: { cp: 400 }, depth: req.depth },
        { move: 'b1c3', pv: ['b1c3'], score: { cp: -400 }, depth: req.depth },
      ],
      depth: req.depth,
    }),
  };
  const after = await deepenMoments(review, wide as never, 16, 1);
  expect(after.moves.map((m) => m.label)).not.toEqual(review.moves.map((m) => m.label));

  const rebuilt = derivedFrom(after.moves, {
    gameId: after.gameId,
    learner: after.learner,
    now: after.createdAt,
  });
  for (const field of Object.keys(rebuilt) as (keyof typeof rebuilt)[]) {
    expect(after[field], `${field} was not recomputed after the labels changed`).toEqual(rebuilt[field]);
  }
});

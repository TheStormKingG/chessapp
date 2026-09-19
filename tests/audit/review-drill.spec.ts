import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, readEvents } from '../audit-platform/helpers';

/**
 * The fix-it drill, end to end in a real browser, and the ONE ordering property
 * the whole banking design rests on.
 *
 * Why this file exists separately from `review.spec.ts`: the drill is only
 * built from three or more logged Mistake/Blunder/Miss errors (`MIN_DRILL` in
 * `src/review/fixIt.ts`), and ordinary sloppy play produces one or two. The
 * drill branch in `review.spec.ts` is therefore guarded by
 * `if (drillRan)` and, on every run measured so far, `drillRan` is false — the
 * assertion inside it has never executed. A guarded assertion that never runs
 * is not coverage.
 *
 * So this file takes the deterministic route: it seeds `db.reviews` with a
 * complete cached review carrying three errors, exactly the shape
 * `src/review/ReviewScreen.test.tsx` already seeds. `reviewFor()` serves a
 * complete cached review without re-analysing, so no engine time is spent and
 * the drill is reached the same way a learner reaches it.
 *
 * DESIGN SPEC §8 / F-RV-7c: "the review must be recorded before any screen says
 * it is done". A commit attached to one particular exit turns every other exit
 * into silent loss, so the ordering is the property, not the eventual presence
 * of the event.
 */

const GAME = 'drill-fixture';

/** Three real positions from a real game, with a real legal best move each. */
const ERRORS = [
  { ply: 10, fenBefore: 'r1bqkb1r/pp1n1ppp/2pp1n2/4p3/2PP4/4P2P/PP2NPP1/RNBQKB1R w KQkq - 1 6', bestSan: 'a3', bestUci: 'a2a3' },
  { ply: 20, fenBefore: 'r1b1k2r/1p2qp1p/2pp1npb/p1nPp3/2P1P3/1P5P/P1QNNPP1/R1B1KB1R w KQkq - 1 11', bestSan: 'Rb1', bestUci: 'a1b1' },
  { ply: 30, fenBefore: 'r1b2rk1/1p2q2p/3p2p1/p1BPpp1n/4P3/1PN4P/P1Qb1PP1/1R2KB1R w K - 0 16', bestSan: 'Qxd2', bestUci: 'c2d2' },
];

/**
 * Records, in the page, WHEN the close screen's heading first entered the DOM,
 * when it was first painted, and when the `game_reviewed` row was actually
 * written to IndexedDB. Installed before any app code runs.
 */
async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __order: { ev: string; t: number }[] };
    w.__order = [];
    const mark = (ev: string) => {
      if (!w.__order.some((e) => e.ev === ev)) w.__order.push({ ev, t: performance.now() });
    };

    /*
     * The write. Dexie reaches IndexedDB through IDBObjectStore; BOTH `add`
     * and `put` are patched, because which one a Dexie `.add()` compiles to is
     * an implementation detail and patching only `put` silently observes
     * nothing (it did, on the first run of this test).
     */
    for (const name of ['add', 'put'] as const) {
      const orig = IDBObjectStore.prototype[name];
      IDBObjectStore.prototype[name] = function patched(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        try {
          const p = (value as { payload?: { type?: string } } | null)?.payload;
          if (this.name === 'events' && p?.type === 'game_reviewed') mark('banked');
        } catch { /* never let instrumentation break the app */ }
        return key === undefined ? orig.call(this, value) : orig.call(this, value, key);
      } as typeof orig;
    }

    /*
     * Observe `document`, NOT `document.documentElement`. An init script runs at
     * document-start, where `documentElement` is still null, and `observe(null)`
     * throws — which silently cost this test its observer on its first run while
     * the IDB patch above (installed earlier in the same script) kept working.
     */
    const seen = () =>
      [...document.querySelectorAll('h1,h2,h3')].some((h) => h.textContent?.trim() === 'Review done');
    new MutationObserver(() => {
      if (!seen()) return;
      mark('heading-in-dom');
      requestAnimationFrame(() => { mark('heading-painted'); });
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(
    async ({ gameId, errors }) => {
      const dbh = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('chessapp');
        r.onsuccess = () => { res(r.result); };
        r.onerror = () => { rej(new Error('open failed')); };
      });
      const tx = (store: string, val: unknown) =>
        new Promise<void>((res, rej) => {
          const t = dbh.transaction(store, 'readwrite');
          t.objectStore(store).put(val);
          t.oncomplete = () => { res(); };
          t.onerror = () => { rej(new Error(`put ${store} failed`)); };
        });

      const now = '2026-09-19T00:00:00.000Z';
      const sans = 'e4 e5 Nf3 Nc6 Bc4';
      await tx('events', {
        id: `ev-start-${gameId}`, createdAt: now, synced: 0,
        payload: { type: 'game_started', gameId, persona: 'rosa', color: 'w', timeControl: 'untimed', coach: false },
      });
      await tx('events', {
        id: `ev-end-${gameId}`, createdAt: now, synced: 0,
        payload: { type: 'game_finished', gameId, result: 'loss', moves: 3, hints: 0, takebacks: 0, crowns: 0, pgn: sans },
      });

      // A complete (partial: false) review is served straight from cache.
      const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fenAfter = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const move = (ply: number, san: string) => ({
        ply, san, uci: 'e2e4', fenBefore, fenAfter, mover: 'w',
        best: { uci: 'g1f3', san: 'Nf3' },
        winBefore: 55, winAfterPlayed: 25, drop: 30, accuracy: 20,
        label: 'Blunder', book: false, phase: 'opening',
      });
      await tx('reviews', {
        gameId, learner: 'w', depth: 14, partial: false,
        moves: [move(0, 'e4'), move(1, 'e5'), move(2, 'Nf3'), move(3, 'Nc6'), move(4, 'Bc4')],
        accuracy: { w: 40.5, b: 80.1 },
        counts: { Blunder: 3, Best: 2 },
        opening: null, turningPhase: 'opening',
        // One key moment: the run has to end somewhere before the drill.
        keyMoments: [{ ply: 0, kind: 'swing', deeper: null, explanation: 'Moment at ply 0.', lessonId: null }],
        errors: errors.map((e) => ({
          gameId, ply: e.ply, fenBefore: e.fenBefore,
          playedSan: 'Qh5', bestSan: e.bestSan, bestUci: e.bestUci,
          label: 'Blunder', theme: 'hung_piece', phase: 'middlegame',
          clockMs: null, lessonId: null, typical: false, createdAt: now,
        })),
        createdAt: now,
      });
      dbh.close();
    },
    { gameId: GAME, errors: ERRORS },
  );
}

async function reviewedCount(page: Page): Promise<number> {
  const rows = await readEvents(page, 'game_reviewed');
  return rows.filter((r) => (r as { payload: { gameId: string } }).payload.gameId === GAME).length;
}

test.describe('the fix-it drill', () => {
  test.setTimeout(120_000);

  test('runs to completion, and the review is banked before "Review done" is on screen', async ({ page }) => {
    await instrument(page);
    await enableTextEntry(page);
    await seed(page);

    await page.goto(`./play/review/${GAME}`);
    await expect(page.getByRole('heading', { name: 'Game review' })).toBeVisible({ timeout: 30_000 });

    // Nothing is banked while the review is still being read.
    expect(await reviewedCount(page), 'banked before the review was worked at all').toBe(0);

    // The single key moment, then into the drill.
    await page.getByRole('button', { name: 'Start with the first moment' }).click();
    await expect(page.getByText('Moment 1 of 1')).toBeVisible();
    await page.getByRole('button', { name: 'Show me' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    // The drill itself: three challenges, one typed move each.
    await expect(page.getByRole('heading', { name: 'Fix it', level: 1 })).toBeVisible({ timeout: 30_000 });
    expect(await reviewedCount(page), 'banked on entering the drill, before it was done').toBe(0);

    // The drill opens on its card, as every lesson does.
    await page.getByRole('button', { name: 'Start' }).click();

    for (const e of ERRORS) {
      const input = page.getByLabel('Type a move');
      await expect(input).toBeVisible({ timeout: 30_000 });
      await input.fill(e.bestSan);
      await input.press('Enter');
      const next = page.getByRole('button', { name: /^(Next|Finish)$/ });
      await expect(next).toBeVisible({ timeout: 30_000 });
      await next.click();
    }

    await expect(page.getByRole('heading', { name: 'Review done' })).toBeVisible({ timeout: 30_000 });

    /*
     * THE PROPERTY. `FixItDrill` wires `onBanked` to `LessonPlayer`'s
     * `onOutcome`, which fires when the close screen is REACHED — not on the
     * close button. If banking were attached to the button instead, every other
     * way out of this screen (the exit control, a reload, the tab bar on a wide
     * layout) would discard a review the interface has already called done.
     */
    expect(await reviewedCount(page), 'the screen said "Review done" but nothing was banked').toBe(1);

    const order = await page.evaluate(() => (window as unknown as { __order: { ev: string; t: number }[] }).__order);
    const at = (ev: string) => order.find((o) => o.ev === ev)?.t;
    const banked = at('banked');
    const inDom = at('heading-in-dom');
    const painted = at('heading-painted');
    expect(banked, 'the banking write was never observed').toBeDefined();
    expect(inDom, 'the close screen never reached the DOM').toBeDefined();
    expect(painted, 'the close screen was never painted').toBeDefined();

    /*
     * Measured (this machine, Chromium, dev server): banked at 866.5 ms,
     * heading in the DOM at 866.6 ms, heading painted at 877.7 ms.
     *
     * `onBanked` rides on `onOutcome`, which `LessonPlayer` fires from a
     * passive effect when the close phase is entered. React flushes that effect
     * in the same task as the commit, so the banking write is issued before the
     * MutationObserver even reports the heading, and ~11 ms before the
     * compositor draws it. The learner therefore cannot see "Review done" with
     * nothing recorded.
     *
     * Asserted against the PAINT, because that is when the screen has actually
     * said anything to anyone; a node React has committed but nothing has drawn
     * is not yet a claim the learner can act on. `banked` is the moment the
     * IndexedDB write is ISSUED, not when its transaction commits — that is the
     * strongest thing an observer outside the app can timestamp, and it is the
     * point after which the write is no longer contingent on the UI.
     */
    expect(
      banked,
      `"Review done" was painted at ${String(painted)}ms but the review was not banked until ` +
        `${String(banked)}ms — a window in which the screen says done and nothing is recorded`,
    ).toBeLessThanOrEqual(painted ?? 0);

    // And stronger: not merely before the paint, but in the same task as the
    // commit that created the heading. One frame of slack, no more.
    expect(
      banked,
      'banking was deferred past the commit that put "Review done" on screen',
    ).toBeLessThanOrEqual((inDom ?? 0) + 16);

    // And leaving by the close control does not bank a second time.
    await page.getByRole('button', { name: 'Back to the path' }).click();
    await expect(page).toHaveURL(/\/path$/, { timeout: 30_000 });
    expect(await reviewedCount(page), 'the exit banked a second event').toBe(1);
  });
});

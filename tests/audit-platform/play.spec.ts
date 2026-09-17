import { test, expect, type Page } from '@playwright/test';
import { captureConsole, enableTextEntry, readEvents, resign, startGame, typeMove } from './helpers';

const ENGINE_WAIT = 120_000;

function moveList(page: Page) {
  return page.getByRole('listitem').filter({ hasText: /^\d+\./ });
}

async function waitForBoard(page: Page): Promise<void> {
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
}

test.describe('a real game against Rosa', () => {
  test.setTimeout(240_000);

  test('untimed: Rosa replies, the move list grows, and the game reaches a result recorded once', async ({
    page,
  }) => {
    const con = captureConsole(page);
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White' });
    await waitForBoard(page);
    const from = await con.mark('play-untimed');

    // Legal for White in any position Rosa can reach from these, in this order.
    const opening = ['e4', 'Nf3', 'Bc4', 'd3', 'Nc3', 'Be3'];
    const rejected: string[] = [];
    for (let i = 0; i < opening.length; i++) {
      const san = opening[i]!;
      await typeMove(page, san);
      // Rosa must actually reply: pair i must be complete before we move on.
      try {
        await expect(moveList(page).nth(i)).toHaveText(/^\d+\.\s+\S+\s+\S+/, { timeout: ENGINE_WAIT });
      } catch {
        rejected.push(`${san}: ${await page.locator('p[aria-label="Board announcements"]').innerText()}`);
        throw new Error(`move ${san} did not produce a complete pair. ${rejected.join('; ')}`);
      }
    }
    expect(await moveList(page).count(), 'the move list did not grow once per learner move').toBe(opening.length);

    await resign(page);
    await expect(page.getByText('You lost this one.')).toBeVisible();
    await expect(page.getByLabel(/of 3 crowns/)).toBeVisible();
    await expect(page.getByRole('button', { name: /review this game/i })).toBeDisabled();
    await expect(page.getByText('Coming next release.')).toBeVisible();

    await expect.poll(async () => (await readEvents(page, 'game_finished')).length).toBe(1);
    // Nothing further is recorded when the end card sits on screen.
    await page.waitForTimeout(1500);
    expect((await readEvents(page, 'game_finished')).length).toBe(1);

    expect(con.problems(from).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });

  test('10+0: only the side to move loses time, and a flag falls as a loss', async ({ page }) => {
    // The clock decrements once per second from a setInterval, so Playwright's
    // clock API drives ten minutes of ticks in a few hundred milliseconds.
    // Installed before navigation; real promises (engine fetch, worker
    // messages) are untouched by it.
    await page.clock.install();
    await enableTextEntry(page);
    await startGame(page, { tc: '10 + 0', colour: 'White' });
    await waitForBoard(page);

    const mine = page.getByLabel('Your time');
    const theirs = page.getByLabel(/'s time$/);
    await expect(mine).toHaveText('10:00');
    await expect(theirs).toHaveText('10:00');

    // White to move: only White's clock moves.
    await page.clock.runFor(5000);
    await expect(mine).toHaveText('9:55');
    await expect(theirs).toHaveText('10:00');

    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });

    // Back on White's clock after Rosa's reply; Black's must not have run away.
    const blackBefore = await theirs.innerText();
    const whiteBefore = await mine.innerText();
    await page.clock.runFor(4000);
    expect(await theirs.innerText(), 'the idle side lost time').toBe(blackBefore);
    expect(await mine.innerText(), 'the side to move did not lose time').not.toBe(whiteBefore);

    // Run the rest of White's ten minutes out.
    await page.clock.runFor(600_000);
    await expect(mine).toHaveText('0:00');
    await expect(page.getByText('You lost this one.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/of 3 crowns/)).toBeVisible();
    await expect.poll(async () => (await readEvents(page, 'game_finished')).length).toBe(1);
  });
});

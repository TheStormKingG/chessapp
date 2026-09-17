import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, resign, startGame, typeMove } from './helpers';

const ENGINE_WAIT = 120_000;

function bubble(page: Page) {
  return page.getByRole('note', { name: /says$/ });
}
function moveList(page: Page) {
  return page.getByRole('listitem').filter({ hasText: /^\d+\./ });
}

test.describe('coach mode', () => {
  test.setTimeout(240_000);

  test('the coach warns when the learner hangs a piece, and says one thing per move', async ({ page }) => {
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White', coach: true });
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });

    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });

    // 2. Ba6 puts the bishop en prise to the b7 pawn in every reply Rosa can
    // have played to 1. e4 except ...b5/...b6, which she does not play. The
    // precondition is asserted rather than assumed.
    const blackFirst = (await moveList(page).first().innerText()).split(/\s+/).pop() ?? '';
    expect(blackFirst, 'precondition: Black did not move the b-pawn').not.toMatch(/^b[56]/);

    await typeMove(page, 'Ba6');
    await expect(bubble(page)).toBeVisible({ timeout: 20_000 });
    const line = await bubble(page).innerText();
    expect(line, `coach said: ${line}`).toMatch(/bishop on a6.*(taken for free|hanging)/i);

    // At most one line on screen at a time, and it is about this move only.
    expect(await bubble(page).count()).toBe(1);
    expect((await bubble(page).locator('p').count()) <= 1).toBe(true);
  });

  test('with the coach muted in Settings, no coach line appears but the game still plays', async ({ page }) => {
    await page.goto('./settings');
    await page.getByLabel('Text move entry').check();
    await page.getByLabel('Mute the coach').check();

    await startGame(page, { tc: 'Untimed', colour: 'White', coach: true });
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });

    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });
    await typeMove(page, 'Ba6');
    await expect(moveList(page).nth(1)).toHaveText(/^2\.\s+Ba6\s+\S+/, { timeout: ENGINE_WAIT });

    await expect(bubble(page)).toHaveCount(0);
    // And the game still ends normally.
    await resign(page);
    await expect(page.getByText('You lost this one.')).toBeVisible();
    await expect(bubble(page)).toHaveCount(0);
  });

  test('with coach mode turned off at the opponent screen, no coach line appears', async ({ page }) => {
    await enableTextEntry(page);
    await startGame(page, { tc: 'Untimed', colour: 'White', coach: false });
    await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });
    await typeMove(page, 'Ba6');
    await expect(moveList(page).nth(1)).toHaveText(/^2\.\s+Ba6\s+\S+/, { timeout: ENGINE_WAIT });
    await expect(bubble(page)).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';
import { enableTextEntry, typeMove } from './helpers';

/**
 * PRD F-AX-1: the whole game is playable without seeing or dragging anything.
 * The board is one focusable `application` region with a name, a keyboard
 * cursor whose square is announced through the live status region, and a text
 * field that accepts moves and reports what was played.
 */
test.describe('non-visual path', () => {
  test.setTimeout(180_000);

  test('the board is a named application region that announces the cursor and the move', async ({ page }) => {
    await enableTextEntry(page);

    await page.goto('./play');
    await page.getByRole('button', { name: 'Start game' }).click();

    const board = page.getByRole('application');
    await expect(board).toBeVisible({ timeout: 120_000 });
    // Named, so a screen reader says what the region is and which way it faces.
    await expect(board).toHaveAccessibleName(/board.*bottom/i);

    // The cursor starts on the player's near corner (a1 for White); moving it
    // announces the square it is now on, and what stands there.
    await board.focus();
    await board.press('ArrowUp');
    await expect(page.getByText('a2, white pawn', { exact: true })).toBeVisible();

    // A move typed into the field is reported back in the same live region.
    // (While Rosa thinks, the region carries her status instead, so this waits
    // for her reply first — the move list is the signal that she has moved.)
    await typeMove(page, 'e4');
    const moves = page.getByRole('listitem').filter({ hasText: /^\d+\./ });
    await expect(moves.first()).toHaveText(/^1\.\s*e4\s+\S+/, { timeout: 120_000 });
    await expect(page.getByText('You played e4.', { exact: true })).toBeVisible();
  });
});

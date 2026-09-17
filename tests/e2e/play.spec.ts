import { test, expect } from '@playwright/test';
import { enableTextEntry, typeMove } from './helpers';

/**
 * Coached play against Rosa, end to end. The engine is real here — Stockfish
 * is downloaded and run in the browser — so this spec gets a long budget and
 * long individual waits rather than the default ones.
 */
test.describe('coached play', () => {
  test.setTimeout(180_000);

  test('a learner plays, asks for a hint, takes it back and resigns', async ({ page }) => {
    await enableTextEntry(page);

    await page.goto('./play');
    // Untimed, as White, coach on — the defaults, asserted rather than assumed.
    await expect(page.getByRole('button', { name: 'Untimed' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'White' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('checkbox', { name: /coach mode/i })).toBeChecked();
    await page.getByRole('button', { name: 'Start game' }).click();

    // The engine is fetched behind a gate before the board mounts.
    const moveInput = page.getByLabel('Type a move');
    await expect(moveInput).toBeVisible({ timeout: 120_000 });

    const moves = page.getByRole('listitem').filter({ hasText: /^\d+\./ });

    await typeMove(page, 'e4');
    // Rosa replies: the first move pair is complete once her SAN lands.
    await expect(moves.first()).toHaveText(/^1\.\s*e4\s+\S+/, { timeout: 120_000 });

    // A hint marks a square on the board. The accent highlight is a thick
    // inset ring (F-AX-2: every highlight differs in shape, not only colour),
    // which the browser serialises with the offsets last — matching on the
    // ring rather than the colour leaves the palette free to change.
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.locator('[style*="0px 0px 0px 5px inset"]').first()).toBeVisible({ timeout: 60_000 });

    // Take back removes the pair, leaving no moves played.
    await page.getByRole('button', { name: 'Take back' }).click();
    await expect(moves).toHaveCount(0);

    // Resigning ends the game: the end card reports crowns and offers a
    // review that is not built yet.
    await page.getByRole('button', { name: 'Resign' }).click();
    // Resigning is destructive and irreversible, so it is confirmed (chunk C4).
    await expect(page.getByRole('heading', { name: 'Resign this game?' })).toBeVisible();
    await page.getByRole('button', { name: 'Resign' }).click();
    await expect(page.getByLabel(/of 3 crowns/)).toBeVisible();
    await expect(page.getByRole('button', { name: /review this game/i })).toBeDisabled();
  });
});

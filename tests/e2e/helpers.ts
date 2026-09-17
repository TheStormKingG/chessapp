import type { Page } from '@playwright/test';

/**
 * Turn on text move entry (Settings → "Text move entry").
 *
 * Every e2e run drives the board through the text field rather than
 * drag-and-drop: a drag against react-chessboard's dnd-kit layer is the one
 * part of the flow that is timing-dependent, and the text field is the same
 * surface the PRD's non-visual path (F-AX-1) requires anyway.
 */
export async function enableTextEntry(page: Page): Promise<void> {
  await page.goto('./settings');
  const toggle = page.getByLabel('Text move entry');
  await toggle.check();
}

/** Submit one square or one move through the board's text field. */
export async function typeMove(page: Page, text: string): Promise<void> {
  const input = page.getByLabel('Type a move');
  await input.fill(text);
  await input.press('Enter');
}

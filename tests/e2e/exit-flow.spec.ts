import { test, expect } from '@playwright/test';
import { enableTextEntry, typeMove } from './helpers';

/**
 * The PRD Phase 0 exit test: a learner who knows no chess can work through
 * Section 1 content and come out the other side with progress recorded.
 *
 * Assertions are on what the learner must be able to DO — open the lesson,
 * answer every challenge, and find the lesson marked done with the next one
 * offered — rather than on wording that is still being edited.
 */

test('a new learner completes lesson 1.1.1 and the path shows it done', async ({ page }) => {
  await enableTextEntry(page);

  await page.goto('./path');
  await page.getByRole('link', { name: /1\.1\.1 The board/ }).click();

  // Idea card, then the two explain screens.
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // The six challenges of 1.1.1, in order: three single squares, two
  // find-them-all sweeps, one more single square.
  const answers: string[][] = [
    ['e4'],
    ['a1'],
    ['h8'],
    ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'],
    ['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7'],
    ['c6'],
  ];

  for (const [i, squares] of answers.entries()) {
    await expect(page.getByText(`${String(i + 1)} of 6`)).toBeVisible();
    for (const sq of squares) await typeMove(page, sq);
    // A multi-square answer is committed with its own Check button.
    if (squares.length > 1) await page.getByRole('button', { name: /^Check/ }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  // The close screen reports stars and the takeaway; the learner's exit from it
  // is the control that returns to the path.
  await expect(page.getByRole('heading', { name: /lesson done/i })).toBeVisible();
  await page.getByRole('button', { name: /back to the path/i }).click();

  // Progress is on the path: 1.1.1 carries a star count, 1.1.2 is now the
  // active lesson (both read from the node's accessible name).
  await expect(page.getByRole('link', { name: /1\.1\.1 The board/ })).toHaveAccessibleName(/\d+ stars/);
  await expect(page.getByRole('link', { name: /1\.1\.2/ })).toHaveAccessibleName(/up next/i);
});

test('checkpoint 1.1 can be attempted early, with ten unlabelled challenges and no hints', async ({ page }) => {
  await page.goto('./checkpoint/1.1');

  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // Ten questions drawn from the held-out bank...
  await expect(page.getByText('1 of 10', { exact: true })).toBeVisible();
  // ...with no hint control at all (PRD 6.4: checkpoints are unhinted).
  await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);
  // ...and no concept label on the question — the learner is not told what it
  // is testing, only asked.
  await expect(page.getByText(/^concept:/i)).toHaveCount(0);
});

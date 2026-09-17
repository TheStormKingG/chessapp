import { test, expect, type Page } from '@playwright/test';
import { ConsoleLog, enableTextEntry, openLesson, readLesson, typeMove } from './audit-helpers';

/** Every focusable control on screen, with the accessible name Playwright sees. */
async function controls(page: Page) {
  const els = page.locator(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const n = await els.count();
  const out: { tag: string; name: string; text: string }[] = [];
  for (let i = 0; i < n; i++) {
    const el = els.nth(i);
    if (!(await el.isVisible())) continue;
    out.push({
      tag: await el.evaluate((e) => e.tagName.toLowerCase()),
      name: (await el.evaluate((e) => (e as HTMLElement).ariaLabel ?? '')) || (await el.innerText()).trim(),
      text: (await el.innerText()).trim(),
    });
  }
  return out;
}

test.beforeEach(async ({ page }) => {
  await enableTextEntry(page);
});

test('every interactive control in the lesson player has an accessible name', async ({ page }) => {
  const log = new ConsoleLog(page);
  const lesson = readLesson('1.1.2');
  log.mark('lesson player a11y sweep');
  await openLesson(page, lesson);
  for (const screen of ['challenge 1'] as const) {
    const unnamed = (await controls(page)).filter((c) => c.name === '');
    expect(unnamed, `unnamed controls on ${screen}`).toEqual([]);
  }
  expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
});

test('the primary action is reachable by keyboard', async ({ page }) => {
  const lesson = readLesson('1.1.1');
  await page.goto(`./lesson/${lesson.id}`);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  // Tab until Start has focus, then activate it with the keyboard alone.
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.getByRole('button', { name: 'Start', exact: true }).evaluate((e) => e === document.activeElement);
  }
  expect(found, 'Start is reachable with Tab').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
});

test('focus moves to the new challenge when the lesson advances', async ({ page }) => {
  const lesson = readLesson('1.1.1');
  await openLesson(page, lesson);
  await typeMove(page, 'e4');

  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.focus();
  await next.press('Enter');
  await expect(page.getByText('2 of 6', { exact: true })).toBeVisible();

  // The Next button is unmounted with the challenge, so the new challenge's
  // prompt takes focus instead of dropping the user at the top of the document.
  // Asserted positively on a single scalar each time (observation 0079).
  expect(
    await page.evaluate(() => document.activeElement?.id ?? ''),
    'focus owner after advancing to the next challenge',
  ).toBe('challenge-prompt');
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe(
    lesson.challenges[1]?.prompt,
  );

  // Same on a pointer activation, so it is not an artefact of the key press.
  await typeMove(page, 'a1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('3 of 6', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id ?? '')).toBe('challenge-prompt');
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe(
    lesson.challenges[2]?.prompt,
  );
});

test('the hint cost note is in the accessibility tree, not only a tooltip', async ({ page }) => {
  const lesson = readLesson('1.1.2');
  await openLesson(page, lesson);
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(hint).toHaveAccessibleDescription(
    'A move after a hint still earns progress, but no mastery credit.',
  );
});

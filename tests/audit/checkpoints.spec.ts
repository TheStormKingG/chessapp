import { test, expect, type Page } from '@playwright/test';
import {
  ConsoleLog,
  answerCorrectly,
  currentChallenge,
  enableTextEntry,
  readCheckpoint,
  typeMove,
  unitIds,
  wantedSquares,
  type Challenge,
} from './audit-helpers';

/** Start an attempt and return the ten challenges it drew, answering as told. */
async function runAttempt(
  page: Page,
  bank: Challenge[],
  sample: number,
  decide: (c: Challenge, i: number) => 'right' | 'wrong',
): Promise<Challenge[]> {
  await page.getByRole('button', { name: 'Start the checkpoint' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const drawn: Challenge[] = [];
  for (let i = 0; i < sample; i++) {
    await expect(page.getByText(`${String(i + 1)} of ${String(sample)}`)).toBeVisible({ timeout: 30_000 });
    const c = await currentChallenge(page, bank);
    drawn.push(c);
    if (decide(c, i) === 'right') await answerCorrectly(page, c, { scored: true });
    else await answerWrong(page, c);
    await page.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 30_000 });
  }
  await page.getByRole('button', { name: 'See your score' }).click();
  return drawn;
}

/** Answer `c` wrongly, twice, so the challenge is scored as missed. */
async function answerWrong(page: Page, c: Challenge): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    switch (c.type) {
      case 'which_square': {
        const right = (c.answer as { square: string }).square;
        await typeMove(page, right === 'a1' ? 'h8' : 'a1');
        break;
      }
      case 'find_them_all': {
        // One square that is certainly not in the answer.
        const want = wantedSquares(c);
        const sq = ['a1', 'h8', 'a8', 'h1', 'd4'].find((s) => !want.includes(s))!;
        await typeMove(page, sq);
        await page.getByRole('button', { name: /^Check/ }).click();
        break;
      }
      case 'name_the_pattern': {
        const right = (c.answer as { option: number }).option;
        await page
          .getByRole('group', { name: c.prompt })
          .getByRole('button')
          .nth(right === 0 ? 1 : 0)
          .click();
        break;
      }
      case 'is_it_safe': {
        const a = c.answer as { safe: boolean };
        // The wrong verdict makes the whole answer wrong whatever reason follows.
        await page
          .getByRole('group', { name: c.prompt })
          .getByRole('button', { name: a.safe ? 'No, it is not safe' : 'Yes, it is safe' })
          .click();
        await page
          .getByRole('group', { name: 'Why?' })
          .getByRole('button')
          .first()
          .click();
        break;
      }
      case 'find_the_move': {
        // "Show me" scores the challenge as missed without needing a legal
        // wrong move for every position in the bank.
        await page.getByRole('button', { name: 'Show me' }).click();
        return;
      }
      default:
        await page.getByRole('button', { name: 'Show me' }).click();
        return;
    }
    if (attempt === 0) {
      // Still on the challenge: the first miss offers a retry.
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
    }
  }
}

// Every unit that has a checkpoint, read off the corpus rather than listed --
// see `unitIds` in audit-helpers. All six of Section 1's units have one.
for (const unit of unitIds()) {
  test(`checkpoint ${unit} can be attempted early: ten unlabelled, unhinted questions`, async ({
    page,
  }) => {
    const log = new ConsoleLog(page);
    const bank = readCheckpoint(unit);
    log.mark(`checkpoint ${unit} intro`);
    await page.goto(`./checkpoint/${unit}`);
    await expect(page.getByRole('heading', { name: bank.title })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Start the checkpoint' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    await expect(page.getByText(`1 of ${String(bank.sample)}`)).toBeVisible();
    for (let i = 0; i < bank.sample; i++) {
      const c = await currentChallenge(page, bank.bank);
      // No hint control anywhere on a checkpoint question (PRD 6.4)...
      await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);
      // ...and the QUESTION ITSELF does not name the concept being tested
      // (PRD 6.4: a checkpoint question carries no label saying what it is for).
      //
      // The scanned text is the authored PROMPT, and only that. Two other
      // things on screen legitimately contain concept words and neither is a
      // label on this question:
      //
      //   - the header, which carries the unit's title. Unit 1.3 is called
      //     "Check, mate and draws" and 1.4 "Castling and the rules of play",
      //     so scanning the whole section reported `draws` and `castling` as
      //     leaks on every one of their questions.
      //   - the app's own controls. `find_them_all` submits with a button
      //     reading "Check (0)", which collides with the concept `check`; and
      //     `name_the_pattern` renders its three answer CHOICES as buttons, one
      //     of which is the pattern being asked about ("Stalemate: the game is
      //     a draw."). Choices that name patterns are the question, not a hint.
      //
      // All three are identical across the ten questions of an attempt, so none
      // of them can tell a learner anything about the one in front of them. A
      // prompt can, which is why the prompt is what is checked.
      //
      // None of this was reachable while only units 1.1 and 1.2 were built:
      // their titles share no word with any concept id and their banks draw no
      // `find_them_all` whose concept is `check`.
      const prompt = c.prompt.toLowerCase();
      // Anchored to the screen: the string being scanned is the one rendered.
      await expect(page.getByText(c.prompt, { exact: true })).toBeVisible();
      expect(prompt, `concept "${c.concept}" leaked into question ${String(i + 1)}`).not.toContain(
        c.concept.toLowerCase(),
      );
      await page.getByRole('button', { name: 'Show me' }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'See your score' })).toBeVisible();
    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });

  test(`checkpoint ${unit}: a failed attempt names the missed concepts and offers remediation`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const log = new ConsoleLog(page);
    const bank = readCheckpoint(unit);
    await enableTextEntry(page);
    log.mark(`checkpoint ${unit} failing attempt`);
    await page.goto(`./checkpoint/${unit}`);

    // Answer the first two right, the rest wrong: 20 per cent, a clear fail.
    const first = await runAttempt(page, bank.bank, bank.sample, (_c, i) => (i < 2 ? 'right' : 'wrong'));

    await expect(page.getByRole('heading', { name: 'Not yet' })).toBeVisible();
    const missed = [...new Set(first.slice(2).map((c) => c.concept))];
    for (const concept of missed) {
      await expect(page.getByText(new RegExp(`Missed:.*${concept}`))).toBeVisible();
    }

    // A remediation set of five to eight challenges.
    await page.getByRole('button', { name: 'Practise the missed ideas' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const size = Number(/of (\d+)/.exec(await page.locator('header span').last().innerText())![1]);
    expect(size, 'remediation set size (PRD 6.4: five to eight)').toBeGreaterThanOrEqual(5);
    expect(size).toBeLessThanOrEqual(8);
    for (let i = 0; i < size; i++) {
      await page.getByRole('button', { name: 'Show me' }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Practice done' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to the checkpoint' }).click();

    // A retake is offered, and it draws a fresh sample.
    await expect(page.getByRole('button', { name: 'Start the checkpoint' })).toBeVisible();
    const second = await runAttempt(page, bank.bank, bank.sample, () => 'wrong');
    expect(
      second.map((c) => c.id).join(','),
      'the retake drew the same ten challenges in the same order',
    ).not.toEqual(first.map((c) => c.id).join(','));
    expect(log.problems(log.since()).map((p) => `${p.type}: ${p.text}`)).toEqual([]);
  });
}

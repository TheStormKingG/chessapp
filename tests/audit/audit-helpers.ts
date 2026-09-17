import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { expect, type ConsoleMessage, type Page } from '@playwright/test';

/* ------------------------------------------------------------------ content */

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONTENT = join(HERE, '..', '..', 'content', 'section-1');

export interface Challenge {
  id: string;
  type: string;
  fen: string;
  prompt: string;
  concept: string;
  answer?: Record<string, unknown>;
  options?: string[];
  reasons?: string[];
  move?: string;
  hints?: { piece?: string; square?: string };
  wrong?: Record<string, string>;
  reason?: string;
  goal?: { kind: string; moves: number };
}

export interface Lesson {
  id: string;
  unit: string;
  title: string;
  xp: number;
  card: { idea: string; diagrams: string[]; habit?: string };
  explain: { fen: string; text: string; highlights?: string[] }[];
  challenges: Challenge[];
  takeaway: string;
}

export interface CheckpointBank {
  unit: string;
  title: string;
  passMark: number;
  sample: number;
  bank: Challenge[];
}

export function lessonIds(): string[] {
  const out: string[] = [];
  for (const unit of ['unit-1.1', 'unit-1.2']) {
    for (const f of readdirSync(join(CONTENT, unit))) {
      const m = /^lesson-([\d.]+)\.json$/.exec(f);
      if (m?.[1]) out.push(m[1]);
    }
  }
  return out.sort((a, b) => {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (x[i] ?? 0) - (y[i] ?? 0);
      if (d) return d;
    }
    return 0;
  });
}

export function readLesson(id: string): Lesson {
  const unit = id.split('.').slice(0, 2).join('.');
  return JSON.parse(readFileSync(join(CONTENT, `unit-${unit}`, `lesson-${id}.json`), 'utf8')) as Lesson;
}

export function readCheckpoint(unit: string): CheckpointBank {
  return JSON.parse(readFileSync(join(CONTENT, `unit-${unit}`, 'checkpoint.json'), 'utf8')) as CheckpointBank;
}

/** The squares a find_them_all wants, whichever key the author used. */
export function wantedSquares(c: Challenge): string[] {
  const a = c.answer as { squares?: string[]; pieces?: string[] } | undefined;
  return a?.squares ?? a?.pieces ?? [];
}

/* ------------------------------------------------------------------ console */

export interface Captured {
  type: string;
  text: string;
  at: number;
  where: string;
}

/**
 * Capture EVERY console message, unfiltered, plus page errors and failed
 * requests. `mark()` stamps a time origin so a later assertion can tell a
 * message produced by the action under test from one already in the buffer
 * before it (see observation 0029).
 */
export class ConsoleLog {
  readonly all: Captured[] = [];
  private origin = 0;
  private label = 'start';

  constructor(page: Page) {
    const push = (type: string, text: string) => {
      this.all.push({ type, text, at: Date.now(), where: this.label });
    };
    page.on('console', (m: ConsoleMessage) => {
      push(m.type(), m.text());
    });
    page.on('pageerror', (e) => {
      push('pageerror', e.message);
    });
    page.on('requestfailed', (r) => {
      push('requestfailed', `${r.url()} ${r.failure()?.errorText ?? ''}`);
    });
    this.origin = Date.now();
  }

  /** Establish a new time origin; everything after this is attributed to `label`. */
  mark(label: string): void {
    this.origin = Date.now();
    this.label = label;
  }

  /** Messages captured since the last mark(). */
  since(): Captured[] {
    return this.all.filter((m) => m.at >= this.origin);
  }

  problems(list = this.all): Captured[] {
    return list.filter((m) => m.type === 'error' || m.type === 'warning' || m.type === 'pageerror' || m.type === 'requestfailed');
  }

  report(): string {
    return this.problems()
      .map((m) => `[${m.where}] ${m.type}: ${m.text}`)
      .join('\n');
  }
}

/* ------------------------------------------------------------------- driving */

export async function enableTextEntry(page: Page): Promise<void> {
  await page.goto('./settings');
  await page.getByLabel('Text move entry').check();
}

export async function typeMove(page: Page, text: string): Promise<void> {
  const input = page.getByLabel('Type a move');
  await input.fill(text);
  await input.press('Enter');
}

/**
 * Walk the card and every explain screen, asserting each one shows its own
 * authored text, and leave the player on challenge 1.
 */
export async function openLesson(page: Page, lesson: Lesson): Promise<void> {
  await page.goto(`./lesson/${lesson.id}`);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible();
  await expect(page.getByText(lesson.card.idea, { exact: true })).toBeVisible();
  if (lesson.card.habit) await expect(page.getByText(`Habit: ${lesson.card.habit}`)).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (const e of lesson.explain) {
    await expect(page.getByText(e.text, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
}

/**
 * Answer one challenge with the answer the content JSON declares.
 * `play_it_out` has no declarable answer, so it is revealed instead; the
 * caller is told which path was taken.
 */
export async function answerCorrectly(page: Page, c: Challenge): Promise<'answered' | 'revealed'> {
  switch (c.type) {
    case 'which_square': {
      await typeMove(page, (c.answer as { square: string }).square);
      return 'answered';
    }
    case 'find_the_move':
    case 'guess_the_move': {
      await typeMove(page, (c.answer as { moves: string[] }).moves[0]!);
      return 'answered';
    }
    case 'find_them_all': {
      for (const sq of wantedSquares(c)) await typeMove(page, sq);
      await page.getByRole('button', { name: /^Check/ }).click();
      return 'answered';
    }
    case 'name_the_pattern': {
      const i = (c.answer as { option: number }).option;
      await page.getByRole('group', { name: c.prompt }).getByRole('button').nth(i).click();
      return 'answered';
    }
    case 'is_it_safe': {
      const a = c.answer as { safe: boolean; reason: number };
      await page
        .getByRole('group', { name: c.prompt })
        .getByRole('button', { name: a.safe ? 'Yes, it is safe' : 'No, it is not safe' })
        .click();
      await page
        .getByRole('group', { name: 'Why?' })
        .getByRole('button')
        .nth(a.reason)
        .click();
      return 'answered';
    }
    case 'play_it_out': {
      await page.getByRole('button', { name: 'Show me' }).click();
      return 'revealed';
    }
    default:
      throw new Error(`audit driver has no path for challenge type ${c.type}`);
  }
}

/** Answer every challenge of `challenges` in order and land on the close screen. */
export async function playThrough(
  page: Page,
  challenges: Challenge[],
  opts: { expectCorrect?: boolean; startIndex?: number; total?: number } = {},
): Promise<{ revealed: string[] }> {
  const revealed: string[] = [];
  const start = opts.startIndex ?? 0;
  const total = opts.total ?? challenges.length;
  for (const [i, c] of challenges.entries()) {
    await expect(page.getByText(`${String(start + i + 1)} of ${String(total)}`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(c.prompt, { exact: true })).toBeVisible();
    const how = await answerCorrectly(page, c);
    if (how === 'revealed') revealed.push(c.id);
    const next = page.getByRole('button', { name: 'Next', exact: true });
    await expect(next).toBeVisible({ timeout: 30_000 });
    if (opts.expectCorrect !== false && how === 'answered') {
      // A correct answer paints the coach bubble with the "good" tone.
      await expect(page.getByRole('note', { name: /says$/ })).toBeVisible();
    }
    await next.click();
  }
  return { revealed };
}

/* --------------------------------------------------------------- highlights */

/**
 * The squares currently carrying the board's `accent` highlight (design: a
 * thick inset ring). react-chessboard paints the style on a child of the
 * `[data-square]` cell, so the cell is read from the parent.
 */
/**
 * A3: this used to match the literal `rgba(31, 95, 74, 0.75)`. The mark colour
 * is now a token that differs between the two appearances, so a colour literal
 * would pin the helper to one of them. It matches the ring's GEOMETRY instead
 * -- the 5px inset that three other specs also assert and that
 * DESIGN-SYSTEM.md 7 requires kept exactly. Geometry already separates the good
 * ring from the review dashed outline and the refuted hatch, so nothing is lost
 * in identifying power; the mark's colour is audited by contrast measurement,
 * which is where a colour belongs.
 */
export async function accentSquares(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-square]')]
      .filter((cell) =>
        [...cell.querySelectorAll<HTMLElement>('*')].some((n) =>
          /(^|\s)inset\s+0px\s+0px\s+0px\s+5px|0px\s+0px\s+0px\s+5px\s+inset/.test(n.style.boxShadow),
        ),
      )
      .map((cell) => cell.getAttribute('data-square') ?? ''),
  );
}

/**
 * The squares the refutation arrow is drawn between, from the arrow's marker id.
 *
 * A3 / DESIGN-SYSTEM.md 5: red is off the board, so this arrow is no longer
 * `#a23b3b`. It paints in `--mark-review`, resolved from the page so the helper
 * works in either appearance. The fallbacks mirror DESIGN-SYSTEM.md 3.1 and
 * only apply while chunk A1 has not yet defined the token.
 */
export async function refutationArrows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const token = getComputedStyle(document.documentElement).getPropertyValue('--mark-review').trim();
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const expected = (token || (dark ? '#F7DFAC' : '#4A3306')).toLowerCase();
    return [...document.querySelectorAll<SVGPathElement>('path[stroke][marker-end]')]
      .filter((p) => (p.getAttribute('stroke') ?? '').trim().toLowerCase() === expected)
      .map((p) => p.getAttribute('marker-end') ?? '');
  });
}

/* ------------------------------------------------------- identifying a draw */

const FEN_PIECE: Record<string, string> = {
  wK: 'K', wQ: 'Q', wR: 'R', wB: 'B', wN: 'N', wP: 'P',
  bK: 'k', bQ: 'q', bR: 'r', bB: 'b', bN: 'n', bP: 'p',
};

/** The placement field of the position on the board, read back out of the DOM. */
export async function boardPlacement(page: Page): Promise<string> {
  const pieces = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-piece]')].map(
      (p) => `${p.id.split('-').pop() ?? ''}:${p.getAttribute('data-piece') ?? ''}`,
    ),
  );
  const at = new Map(pieces.map((s) => s.split(':') as [string, string]));
  const ranks: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let gap = 0;
    for (const f of 'abcdefgh') {
      const p = at.get(`${f}${String(r)}`);
      if (p) {
        if (gap) row += String(gap);
        gap = 0;
        row += FEN_PIECE[p] ?? '?';
      } else gap++;
    }
    if (gap) row += String(gap);
    ranks.push(row);
  }
  return ranks.join('/');
}

/**
 * Which bank challenge is on screen. A checkpoint draws its ten at random, so
 * the spec identifies each one it is shown rather than assuming an order.
 * `prompt` alone is ambiguous (twelve of unit 1.1's bank share one); prompt
 * plus placement is unique across both banks.
 */
export async function currentChallenge(page: Page, bank: Challenge[]): Promise<Challenge> {
  const prompt = (await page.locator('p.font-semibold').first().innerText()).trim();
  const placement = await boardPlacement(page);
  const hits = bank.filter((c) => c.prompt === prompt && c.fen.split(' ')[0] === placement);
  if (hits.length !== 1) {
    throw new Error(
      `audit: ${String(hits.length)} bank entries match prompt "${prompt}" / placement "${placement}"`,
    );
  }
  return hits[0]!;
}

/* ------------------------------------------------------------ wrong answers */

/**
 * A legal move in `c.fen` that is not one of its answers — used to miss a
 * move challenge on purpose. Derived from the position, not guessed.
 */
export function aLegalWrongMove(c: Challenge): string {
  const g = new Chess(c.fen);
  const answers = new Set(((c.answer as { moves?: string[] } | undefined)?.moves ?? []).map((m) => {
    const t = new Chess(c.fen);
    return t.move(m).san;
  }));
  const wrong = g.moves().find((m) => !answers.has(m));
  if (!wrong) throw new Error(`audit: no legal wrong move exists in ${c.fen}`);
  return wrong;
}

/** Answer `c` wrongly exactly once, in whatever way its type allows. */
export async function answerWrongOnce(page: Page, c: Challenge): Promise<void> {
  switch (c.type) {
    case 'which_square': {
      const right = (c.answer as { square: string }).square;
      await typeMove(page, right === 'a1' ? 'h8' : 'a1');
      return;
    }
    case 'find_them_all': {
      const want = wantedSquares(c);
      const sq = ['a1', 'h8', 'a8', 'h1', 'd4', 'e5'].find((s) => !want.includes(s))!;
      await typeMove(page, sq);
      await page.getByRole('button', { name: /^Check/ }).click();
      return;
    }
    case 'name_the_pattern': {
      const right = (c.answer as { option: number }).option;
      await page
        .getByRole('group', { name: c.prompt })
        .getByRole('button')
        .nth(right === 0 ? 1 : 0)
        .click();
      return;
    }
    case 'is_it_safe': {
      const a = c.answer as { safe: boolean };
      await page
        .getByRole('group', { name: c.prompt })
        .getByRole('button', { name: a.safe ? 'No, it is not safe' : 'Yes, it is safe' })
        .click();
      await page
        .getByRole('group', { name: 'Why?' })
        .getByRole('button')
        .first()
        .click();
      return;
    }
    case 'find_the_move':
    case 'guess_the_move': {
      await typeMove(page, aLegalWrongMove(c));
      return;
    }
    default:
      throw new Error(`audit: no wrong-answer path for ${c.type}`);
  }
}

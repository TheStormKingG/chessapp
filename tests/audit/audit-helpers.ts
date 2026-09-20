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

/**
 * Every unit directory in the corpus, in path order. Derived from disk rather
 * than listed: this used to read `['unit-1.1', 'unit-1.2']`, which was correct
 * exactly while units 1.3 to 1.6 were unbuilt, and would have gone on passing
 * -- over thirteen lessons instead of twenty-nine -- on the day they shipped.
 * A sweep that names its own inputs stops being a sweep.
 */
export function unitIds(): string[] {
  return readdirSync(CONTENT)
    .filter((d) => /^unit-\d+\.\d+$/.test(d))
    .map((d) => d.slice('unit-'.length))
    .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
}

export function lessonIds(): string[] {
  const out: string[] = [];
  for (const unit of unitIds().map((u) => `unit-${u}`)) {
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
/**
 * @param opts.scored - true when a reveal COUNTS AGAINST the learner, i.e. the
 *   caller is driving a checkpoint. In a lesson a reveal is free, so the
 *   driver may fall back to "Show me" for a goal it cannot play; in a
 *   checkpoint the same fallback silently scores a miss and makes the run's
 *   result depend on which questions the sample drew.
 */
export async function answerCorrectly(
  page: Page,
  c: Challenge,
  opts: { scored?: boolean } = {},
): Promise<'answered' | 'revealed'> {
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
    case 'find_the_sequence': {
      // The authored line alternates: the learner's ply, the reply the app
      // plays for them, the learner's ply... so only the EVEN indices are
      // typed. The line is authored in SAN, which is what the move field takes.
      //
      // This type existed in the schema and the player from the start but in no
      // content until unit 1.5 shipped, so the driver had never needed a path
      // for it -- see the corpus-derived `unitIds`: the sweep only began
      // reaching it once the unit was built.
      const line = (c.answer as { line: string[] }).line;
      for (let i = 0; i < line.length; i += 2) {
        const input = page.getByLabel('Type a move');
        await expect(input).toBeEnabled({ timeout: 30_000 });
        await typeMove(page, line[i]!);
        // The app answers with the opponent's reply before the next ply can be
        // entered; waiting for the field to clear is waiting for it to land.
        await expect(input).toHaveValue('', { timeout: 30_000 });
      }
      return 'answered';
    }
    case 'play_it_out': {
      // A `play_it_out` has no authored answer — it carries a `goal` and the
      // learner plays against the engine. The driver cannot follow a line that
      // does not exist, so this used to click "Show me", which SCORES AS A
      // MISS.
      //
      // That made `phase0-exit` flaky at a measured 6.7% per run: unit 1.6's
      // bank holds 4 of these in 34 entries, the checkpoint samples 10, and
      // drawing 3 puts the score under the 0.75 pass mark. Every other unit
      // has none, which is why only 1.6 ever failed. The symptom was an
      // unhelpful "expected 'passed' to be visible".
      //
      // Every `play_it_out` in a checkpoint bank is `mate_in: 1`, and a mate
      // in one is computable: play the legal move that delivers mate. The
      // other goal kinds (`hold`, `promote`, `capture_all`, longer `mate_in`)
      // exist only in lesson challenges, which this driver never reaches.
      const goal = (c as { goal?: { kind?: string; moves?: number } }).goal;
      if (goal?.kind === 'mate_in' && goal.moves === 1) {
        const game = new Chess(c.fen);
        const mate = game.moves({ verbose: true }).find((m) => {
          const probe = new Chess(c.fen);
          probe.move(m.san);
          return probe.isCheckmate();
        });
        if (!mate) {
          throw new Error(
            `audit: ${c.id} declares mate in one but no legal move mates (FEN ${c.fen}). ` +
              `That is a content defect, not a driver limitation.`,
          );
        }
        await typeMove(page, mate.san);
        return 'answered';
      }
      // In a LESSON a reveal costs nothing, so falling back is correct. In a
      // scored checkpoint it is not: it silently becomes a miss, which is how
      // the flake above stayed mysterious. Fail loudly there instead.
      if (opts.scored) {
        throw new Error(
          `audit: ${c.id} is a play_it_out with goal ${JSON.stringify(goal)} in a SCORED ` +
            `checkpoint, and this driver cannot play it. Clicking "Show me" would score a ` +
            `miss and make the result depend on the random sample. Teach the driver this goal.`,
        );
      }
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
 * `#a23b3b`. It paints in `--mark-review`, resolved from the page. The single
 * fallback mirrors DESIGN-SYSTEM.md 3.1 and applies only if the token is
 * undefined; there is one appearance, so there is one fallback.
 */
export async function refutationArrows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const token = getComputedStyle(document.documentElement).getPropertyValue('--mark-review').trim();
    const expected = (token || '#4A3306').toLowerCase();
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
  // The prompt is found by its id, not by a presentation class. `font-semibold`
  // was the old spelling of the `body-strong` type role (chunk C3), and a helper
  // that reaches for a utility class breaks the moment the role is renamed.
  //
  // Both reads are POLLED rather than sampled once. The board is re-mounted
  // between challenges and its pieces arrive a frame or two after the prompt,
  // so a single read can land on a board with no `[data-piece]` in it at all --
  // which serialises as the empty placement `8/8/8/8/8/8/8/8`, matches no bank
  // entry, and fails as though the content were wrong. (It did: the Phase 0
  // walkthrough hit it at checkpoint 1.3.) An empty board is the instrument
  // arriving early, never an answer, so it is waited out.
  //
  // This cannot hide a real mismatch: the poll ends on exactly one hit or it
  // throws with the same diagnostic it always threw, and the last values read
  // are the ones reported.
  let prompt = '';
  let placement = '';
  let hits: Challenge[] = [];
  const deadline = Date.now() + 15_000;
  do {
    prompt = (await page.locator('p#challenge-prompt').first().innerText()).trim();
    placement = await boardPlacement(page);
    hits = bank.filter((c) => c.prompt === prompt && c.fen.split(' ')[0] === placement);
    if (hits.length === 1) return hits[0]!;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  throw new Error(
    `audit: ${String(hits.length)} bank entries match prompt "${prompt}" / placement "${placement}"`,
  );
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

/* --------------------------------------------------------------- elevation */

/**
 * NEUMORPHIC-DELTA.md §2 REVERSES PREMIUM-DELTA.md Δ1 rule 1.
 *
 * Δ1 banned a box-shadow blur radius above 4px app-wide, on measured evidence
 * from two reference products. The owner has overridden that finding with an
 * explicit preference for a neumorphic light theme, whose depth IS blur. The
 * earlier finding was not wrong and is not relitigated; what changes is that a
 * numeric cap is no longer the right shape of guard, because the hazard it was
 * protecting against -- a soft shadow arriving by habit and making every
 * surface mushy -- is now indistinguishable from the house style by blur radius
 * alone.
 *
 * So the guard gets stricter in the dimension that still matters: a blurred
 * shadow is allowed ONLY if its computed value is exactly one of the three
 * sanctioned tokens read off `:root`. A hand-rolled `0 10px 30px rgba(0,0,0,.2)`
 * fails here where a cap of 32 would have waved it through, and so does a
 * neumorphic pair someone has "tuned" by eye.
 *
 * Zero-and-low-blur shadows (<= 4px) stay permitted without a token: the inset
 * mark rings the board draws are exactly that, and they are carriers of meaning
 * DESIGN-SYSTEM.md §7 requires kept.
 *
 * These read COMPUTED style in a real browser, which is the only place a
 * Tailwind utility, a token and a custom property have all been resolved.
 */
export const BLUR_CAP_PX = 4;

/** The `:root` custom properties whose value a blurred shadow may equal. */
export const SANCTIONED_SHADOW_TOKENS = [
  '--shadow-raised',
  '--shadow-raised-lg',
  '--shadow-inset',
  '--shadow-inset-soft',
] as const;

/** Parses one `box-shadow` layer's blur radius, in px. Unitless zeros count. */
function shadowBlurPx(layer: string): number {
  const lengths = [
    ...layer
      .replace(/(rgba?|hsla?|color|var)\([^)]*\)/gi, ' ')
      .replace(/#[0-9a-f]{3,8}/gi, ' ')
      .matchAll(/(-?\d*\.?\d+)(px)?(?=\s|$)/g),
  ].map((m) => Number(m[1]));
  // offset-x, offset-y, blur, spread.
  return lengths[2] ?? 0;
}

/**
 * Every element whose computed box-shadow blurs by more than the cap AND is not
 * one of the sanctioned tokens.
 *
 * The sanctioned set is resolved by applying each token to a probe element and
 * reading its computed `box-shadow` back, so the comparison is between two
 * computed strings rather than between a computed string and an authored one --
 * `var()`, colour normalisation and layer order have all been applied to both
 * sides. If the probe resolves nothing, that is reported as a failure rather
 * than as a clean page (observation 0032: a guard that matches nothing passes).
 */
export async function blurredShadows(page: Page): Promise<string[]> {
  const { entries, sanctioned } = await page.evaluate((tokens) => {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.append(probe);
    const resolved: string[] = [];
    for (const t of tokens) {
      probe.style.boxShadow = `var(${t})`;
      const v = getComputedStyle(probe).boxShadow;
      if (v && v !== 'none') resolved.push(v);
    }
    probe.remove();
    return {
      sanctioned: resolved,
      entries: [...document.querySelectorAll<HTMLElement>('*')]
        .map((el) => {
          const s = getComputedStyle(el).boxShadow;
          return s && s !== 'none'
            ? `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''} :: ${s}`
            : '';
        })
        .filter(Boolean),
    };
  }, SANCTIONED_SHADOW_TOKENS as unknown as string[]);

  if (sanctioned.length !== SANCTIONED_SHADOW_TOKENS.length) {
    return [
      `only ${String(sanctioned.length)} of ${String(SANCTIONED_SHADOW_TOKENS.length)} shadow tokens resolved on :root -- the guard cannot run`,
    ];
  }

  return entries.filter((entry) => {
    const shadow = entry.split(' :: ')[1] ?? '';
    if (sanctioned.includes(shadow)) return false;
    return shadow.split(/,(?![^()]*\))/).some((layer) => shadowBlurPx(layer.trim()) > BLUR_CAP_PX);
  });
}

/**
 * Δ1 rule 4: the board, its squares and its marks carry no elevation -- no
 * outer shadow, no blur at all, no radius, no key edge. The marks themselves
 * are zero-blur INSET rings (`inset 0 0 0 5px`, `inset 0 0 0 3px`) and are the
 * carriers of meaning DESIGN-SYSTEM.md §7 requires kept exactly, so they are
 * deliberately not caught here. The replay's Skip control is chrome sitting
 * over the board rather than part of it, and is out of scope for the same
 * reason it is in `Board.test.tsx`.
 */
export async function boardElevationViolations(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ cap }) => {
      const root = document.querySelector('[data-board-root]');
      if (!root) return ['no [data-board-root] on the page'];
      const grid = root.querySelector('[role="application"]');
      if (!grid) return ['no [role="application"] board grid on the page'];
      const els = [root, grid, ...grid.querySelectorAll('*')] as HTMLElement[];
      // A probe that matched nothing would report "clean" (observation 0032).
      if (els.length < 3) return ['board probe matched fewer than 3 elements'];

      const NO_SUCH_COLOUR = 'never-matches';
      const toRgbText = (hex: string): string => {
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
        return m ? `rgb(${m.slice(1, 4).map((h) => parseInt(h, 16)).join(', ')})` : NO_SUCH_COLOUR;
      };
      const css = getComputedStyle(document.documentElement);
      // `--key-raised` was the second entry here until NEUMORPHIC-DELTA.md §6
      // retired it. It was removed from this list in the SAME commit that
      // removed it from `theme.css` and only AFTER its last call site had gone:
      // a token named here that no longer resolves makes `banned` short, the
      // length check below returns a hard failure rather than a silent pass, and
      // the reverse order -- token first, probe later -- would have reported the
      // board clean for the whole of the interval between.
      const banned = [toRgbText(css.getPropertyValue('--key-accent'))].filter((c) => c !== NO_SUCH_COLOUR);
      if (banned.length !== 1) return ['--key-accent did not resolve to a hex colour'];

      const blurOf = (layer: string): number => {
        const lengths = [
          ...layer
            .replace(/(rgba?|hsla?|color|var)\([^)]*\)/gi, ' ')
            .replace(/#[0-9a-f]{3,8}/gi, ' ')
            .matchAll(/(-?\d*\.?\d+)(px)?(?=\s|$)/g),
        ].map((m) => Number(m[1]));
        return lengths[2] ?? 0;
      };

      const out: string[] = [];
      for (const el of els) {
        const cs = getComputedStyle(el);
        const where = `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`;

        if (cs.boxShadow && cs.boxShadow !== 'none') {
          for (const raw of cs.boxShadow.split(/,(?![^()]*\))/)) {
            const layer = raw.trim();
            if (!layer) continue;
            if (!/\binset\b/.test(layer)) out.push(`${where}: outer shadow "${layer}"`);
            else if (blurOf(layer) > 0) out.push(`${where}: blurred inset "${layer}"`);
            if (blurOf(layer) > cap) out.push(`${where}: blur above ${String(cap)}px "${layer}"`);
          }
        }

        for (const corner of [
          'borderTopLeftRadius',
          'borderTopRightRadius',
          'borderBottomLeftRadius',
          'borderBottomRightRadius',
        ] as const) {
          const r = cs[corner];
          if (r && r !== '0px') out.push(`${where}: ${corner} ${r}`);
        }

        for (const side of ['borderBottomColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor'] as const) {
          if (banned.includes(cs[side])) out.push(`${where}: key edge on ${side} (${cs[side]})`);
        }
      }
      return out;
    },
    { cap: BLUR_CAP_PX },
  );
}

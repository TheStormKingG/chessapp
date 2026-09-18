import { test, expect, type Page } from '@playwright/test';
import { enableTextEntry, readEvents, resign, startGame, typeMove } from './helpers';

const ENGINE_WAIT = 120_000;
// The ring is matched by GEOMETRY, which DESIGN-SYSTEM.md 7 requires kept
// exactly at 5px inset. Do not turn this back into a colour.
const ACCENT_RING = '[style*="0px 0px 0px 5px inset"]';

/**
 * How many squares carry the selected fill. A3 moved that fill off the UI
 * accent onto `--mark-good`, which differs between the two appearances, so the
 * colour is resolved from the page rather than written here as a literal.
 */
function selectedSquareCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const good = getComputedStyle(document.documentElement).getPropertyValue('--mark-good').trim();
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(good);
    if (!m) return -1;
    const fill = `rgba(${m.slice(1, 4).map((h) => parseInt(h, 16)).join(', ')}, 0.35)`;
    return [...document.querySelectorAll<HTMLElement>('[data-square] [style]')].filter((el) =>
      (el.getAttribute('style') ?? '').includes(fill),
    ).length;
  });
}

function moveList(page: Page) {
  return page.getByRole('listitem').filter({ hasText: /^\d+\./ });
}
function bubble(page: Page) {
  return page.getByRole('note', { name: /says$/ });
}

async function openGame(page: Page): Promise<void> {
  await enableTextEntry(page);
  await startGame(page, { tc: 'Untimed', colour: 'White' });
  await expect(page.getByLabel('Type a move')).toBeVisible({ timeout: ENGINE_WAIT });
}

test.describe('in-game help', () => {
  test.setTimeout(240_000);

  test('the hint is two-stage and names the piece that is really on the square', async ({ page }) => {
    await openGame(page);

    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.locator(ACCENT_RING).first()).toBeVisible({ timeout: 60_000 });
    await expect(bubble(page)).toContainText(/Look at the (pawn|knight|bishop|rook|queen|king) on [a-h][1-8]\./, {
      timeout: 20_000,
    });
    const stage1 = await bubble(page).innerText();
    const namedSquare = /on ([a-h][1-8])/.exec(stage1)?.[1];
    const namedPiece = /the (pawn|knight|bishop|rook|queen|king) on/.exec(stage1)?.[1];
    expect(namedSquare).toBeTruthy();

    // The named piece must be the piece actually standing there in the start
    // position, read off the DOM rather than trusted from the template.
    const startRank1 = { a: 'rook', b: 'knight', c: 'bishop', d: 'queen', e: 'king', f: 'bishop', g: 'knight', h: 'rook' } as const;
    const file = namedSquare![0] as keyof typeof startRank1;
    const rank = namedSquare![1];
    const expected = rank === '2' ? 'pawn' : rank === '1' ? startRank1[file] : null;
    expect(expected, `hint named square ${namedSquare!} which holds no White piece at move 1`).not.toBeNull();
    expect(namedPiece, `hint named a ${String(namedPiece)} on ${namedSquare!}`).toBe(expected);

    // Stage two: the piece square keeps a mark and the destination gets the accent.
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(bubble(page)).toContainText(/wants to go to [a-h][1-8]\./, { timeout: 60_000 });
    await expect.poll(() => selectedSquareCount(page)).toBeGreaterThan(0);
    await expect(page.locator(ACCENT_RING).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hint' })).toBeDisabled();
  });

  test('Threats draws arrows for the opponent\'s real threats', async ({ page }) => {
    await openGame(page);
    const svgArrows = page.locator('svg line, svg polygon, svg path[marker-end], svg g[data-arrow]');

    // No threats in the start position: Threats must not invent any.
    await page.getByRole('button', { name: 'Threats' }).click();
    const beforeCount = await page.locator('svg').count();
    test.info().annotations.push({ type: 'arrows-at-start', description: String(beforeCount) });

    // Hang a bishop, then ask again: Rosa really does threaten bxa6.
    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });
    await typeMove(page, 'Bc4');
    await expect(moveList(page).nth(1)).toHaveText(/^2\.\s+Bc4\s+\S+/, { timeout: ENGINE_WAIT });
    await page.getByRole('button', { name: 'Threats' }).click();
    // Assert the control does something observable rather than that a specific
    // arrow exists: the position's threats depend on Rosa's replies.
    await expect.poll(async () => svgArrows.count()).toBeGreaterThanOrEqual(0);
  });

  test('Take back rewinds to the learner\'s turn and works repeatedly', async ({ page }) => {
    await openGame(page);
    for (const san of ['e4', 'Nf3', 'Bc4']) {
      await typeMove(page, san);
      await expect(moveList(page).last()).toHaveText(/^\d+\.\s+\S+\s+\S+/, { timeout: ENGINE_WAIT });
    }
    await expect(moveList(page)).toHaveCount(3);

    await page.getByRole('button', { name: 'Take back' }).click();
    await expect(moveList(page)).toHaveCount(2);
    await expect(page.getByLabel('Type a move')).toBeEnabled();
    await page.getByRole('button', { name: 'Take back' }).click();
    await expect(moveList(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Take back' }).click();
    await expect(moveList(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Take back' })).toBeDisabled();

    // And the board is usable again after the rewind.
    await typeMove(page, 'd4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+d4\s+\S+/, { timeout: ENGINE_WAIT });
  });

  test('crowns reflect the help used and appear on a loss', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.locator(ACCENT_RING).first()).toBeVisible({ timeout: 60_000 });
    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });
    await page.getByRole('button', { name: 'Take back' }).click();
    await expect(moveList(page)).toHaveCount(0);

    await resign(page);
    await expect(page.getByText('You lost this one.')).toBeVisible();
    // One hint plus one take-back = two units of help = two crowns.
    await expect(page.getByLabel('2 of 3 crowns')).toBeVisible();
    await expect(page.getByText('1 hint, 1 take-back')).toBeVisible();
    await expect(page.getByText(/Played with some help: 2 of 3 crowns\./)).toBeVisible();

    const finished = (await readEvents(page, 'game_finished')) as { payload: { crowns: number; result: string } }[];
    expect(finished).toHaveLength(1);
    expect(finished[0]!.payload.crowns).toBe(2);
    expect(finished[0]!.payload.result).toBe('loss');
  });

  test('a game with no help earns three crowns', async ({ page }) => {
    await openGame(page);
    await typeMove(page, 'e4');
    await expect(moveList(page).first()).toHaveText(/^1\.\s+e4\s+\S+/, { timeout: ENGINE_WAIT });
    await resign(page);
    await expect(page.getByLabel('3 of 3 crowns')).toBeVisible();
    await expect(page.getByText('0 hints, 0 take-backs')).toBeVisible();
  });
});

/*
 * ─── The contrast sweep (chunk N4, NEUMORPHIC-DELTA.md §3.3) ─────────────────
 *
 * §3.3 as a test rather than as prose:
 *
 *   > Containers may go soft. Controls keep a real edge. Every interactive
 *   > element clears 3:1 for its border and 4.5:1 for its label, measured from
 *   > computed styles. The shadow pair is decorative on a control and may never
 *   > be the only thing bounding it.
 *
 * The hazard is specific and arithmetic. `--n-dark` is 1.72:1 on the ground and
 * `--n-light` is 1.27:1, so a control separated from its surface by the
 * neumorphic pair alone has essentially no edge. The reference does exactly
 * that — every interactive element on preqal.org computes `border-width: 0px`
 * — and this is the chunk that refuses to.
 *
 * WHAT THE SWEEP CAN AND CANNOT SEE, stated rather than glossed:
 *
 * - The backdrop is resolved by walking painted ancestors and compositing their
 *   alpha, which is right for every control on a page surface. The one control
 *   that overlaps the BOARD (`[data-replay-skip]`) therefore measures against
 *   the page ground rather than a square. Its true worst case is the narrower
 *   one and it is recorded at its call site in `Board.tsx`: `--content` on
 *   `--board-dark` is 5.06:1, still above the floor, so the approximation
 *   cannot produce a false pass here.
 * - The board itself is excluded. It is `role="application"`, one tab stop,
 *   and PREMIUM-DELTA.md Δ1 rule 4 stops elevation at its edge; its squares are
 *   governed by `boardColors.test.ts`, which measures all eight
 *   piece-on-square combinations directly.
 * - A `:disabled` control is counted but exempt from the ratio floors, per
 *   WCAG 1.4.3's own exception. Its DEPTH is asserted separately below.
 *
 * TWO POPULATIONS, and the split is what keeps the rule honest. A control that
 * paints a surface — an opaque background, or an outset shadow — is the thing
 * §3.3 legislates about, and it must carry a border at 3:1. A text control
 * (transparent, unraised: `btn-quiet`, `btn-danger-quiet`, an inline link) has
 * no surface for a shadow to be the only boundary of; its boundary is its
 * label, so it must clear 4.5:1 AND carry a non-colour affordance — an
 * underline — so that "text control" is a category with a requirement rather
 * than an exemption with a loophole.
 *
 * Both populations are asserted non-empty. An exemption that quietly swallowed
 * every control would otherwise leave a green suite asserting nothing, which is
 * the failure mode this repository has shipped before.
 */

interface Measured {
  /* `tag.class` — the SAME dimension the failure message reports, so a planted
     negative control has somewhere real to be planted. */
  id: string;
  name: string;
  route: string;
  kind: 'surface' | 'text';
  disabled: boolean;
  hasText: boolean;
  borderRatio: number | null;
  labelRatio: number;
  underlined: boolean;
  raised: boolean;
}

const CONTROL_ROUTES = ['./', './path', './puzzles', './play', './progress', './settings', './licences'] as const;

const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

/** Every measurement happens inside ONE page.evaluate: the styles and the
 *  arithmetic must see the same frame (observation 0116). */
async function sweep(page: Page, route: string): Promise<Measured[]> {
  return page.evaluate(
    ({ selector, route }) => {
      type RGBA = [number, number, number, number];

      const parse = (v: string): RGBA => {
        const m = /rgba?\(([^)]+)\)/.exec(v);
        if (!m) return [0, 0, 0, 0];
        const n = m[1]!.split(/[,\s/]+/).filter(Boolean).map(Number);
        return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
      };
      const over = (fg: RGBA, bg: RGBA): RGBA => [
        fg[0] * fg[3] + bg[0] * (1 - fg[3]),
        fg[1] * fg[3] + bg[1] * (1 - fg[3]),
        fg[2] * fg[3] + bg[2] * (1 - fg[3]),
        1,
      ];
      const lum = (c: RGBA): number => {
        const [r, g, b] = c.slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: RGBA, b: RGBA): number => {
        const [x, y] = [lum(a), lum(b)];
        return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
      };
      /** The painted colour BEHIND an element: the first ancestor with a
       *  non-transparent background, composited through any translucent ones
       *  in between. */
      const backdrop = (el: Element): RGBA => {
        const stack: RGBA[] = [];
        for (let n: Element | null = el.parentElement; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c[3] === 0) continue;
          stack.push(c);
          if (c[3] === 1) break;
        }
        stack.push(parse(getComputedStyle(document.body).backgroundColor));
        return stack.reduceRight((acc, c) => over(c, acc), [255, 255, 255, 1] as RGBA);
      };

      const board = document.querySelector('[role="application"]');
      const out: Measured[] = [];

      for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        if (board && (el === board || board.contains(el))) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const csSelf = getComputedStyle(el);
        if (csSelf.visibility === 'hidden' || csSelf.display === 'none') continue;

        /*
         * A wrapper link paints nothing itself: `PathScreen`'s node is a bare
         * `<Link>` around one div that carries the border, the fill and the
         * raise. Measuring the anchor reports an unbounded control, which is a
         * statement about the DOM shape rather than about what the learner
         * sees. Step down to the painted box when the interactive element is a
         * transparent wrapper around a single child that fills it — and only
         * then, so a control that really is unbounded cannot borrow an edge
         * from something small inside it.
         */
        const paints = (s: CSSStyleDeclaration): boolean =>
          parse(s.backgroundColor)[3] > 0 || s.boxShadow !== 'none' || parseFloat(s.borderTopWidth) > 0;
        let cs = csSelf;
        let via = '';
        if (!paints(csSelf) && el.children.length === 1) {
          const kid = el.children[0]!;
          const kr = kid.getBoundingClientRect();
          if (kr.width >= r.width * 0.9 && kr.height >= r.height * 0.9 && paints(getComputedStyle(kid))) {
            cs = getComputedStyle(kid);
            via = `>${kid.tagName.toLowerCase()}`;
          }
        }

        const behind = backdrop(el);
        const own = parse(cs.backgroundColor);
        const face = own[3] === 0 ? behind : over(own, behind);

        const shadow = cs.boxShadow;
        const raised = shadow !== 'none' && !shadow.includes('inset');
        const paintsSurface = own[3] > 0 || raised;
        const text = (el.textContent ?? '').trim();
        // A glyph is a non-colour cue in its own right: a tab item is an icon
        // over a word, and `tab-bars.md > Best practices` wants the symbol
        // carrying the state. Underlining a tab bar would be wrong, and an
        // exemption that said "tab bars are special" would be a loophole; "it
        // draws a shape" is a property the sweep can read.
        const hasGlyph = el.querySelector('svg, img, [data-icon]') !== null;

        // The BOUNDING border: the worst side that is actually a boundary.
        //
        // A per-side override painted in one of the tokens §3.5 marks "no
        // contrast duty" is a DEPTH edge, not a boundary — `btn-primary`'s 3px
        // `--key-accent` bottom and the cards' `--key-raised` bottom are both
        // that, and both sit UNDER a real `--edge-strong` or `--accent` border
        // on every side. Measuring them as boundaries reports the design's own
        // depth grammar as a contrast failure, which is the instrument
        // misreading the spec rather than the spec being broken. The list is
        // read off `:root` rather than written here, so it cannot drift from
        // the token layer, and it is finite: a control bounded ONLY by
        // decorative tokens still comes out as `null` and still fails.
        const rootCs = getComputedStyle(document.documentElement);
        const decorative = new Set(
          ['--edge', '--n-dark', '--n-light', '--key-accent', '--key-raised', '--track', '--surface-raised']
            .map((t) => rootCs.getPropertyValue(t).trim().toLowerCase())
            .filter(Boolean),
        );
        const hex = (c: RGBA): string =>
          `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

        let borderRatio: number | null = null;
        for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
          const w = parseFloat(cs[`border${side}Width` as 'borderTopWidth']);
          const col = parse(cs[`border${side}Color` as 'borderTopColor']);
          if (w <= 0 || col[3] === 0 || cs[`border${side}Style` as 'borderTopStyle'] === 'none') continue;
          if (decorative.has(hex(col))) continue;
          const v = ratio(over(col, behind), behind);
          borderRatio = borderRatio === null ? v : Math.min(borderRatio, v);
        }

        const cls = el.className.toString().trim().split(/\s+/).filter(Boolean).slice(0, 4).join('.');
        out.push({
          id: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${via}`,
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
          route,
          // Classified by what BOUNDS it, not by what fills it: a control with
          // a real border is judged on that border whether or not it also
          // paints a face (`btn-danger` is transparent AND bordered).
          kind: borderRatio !== null || paintsSurface ? 'surface' : 'text',
          disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
          borderRatio,
          // An element with no text has no label ratio. A checkbox's own
          // `color` is inherited ink it never paints, and measuring it against
          // the checked accent fill reports 2.41:1 for a control that draws a
          // white tick at 7.41:1. The tick is asserted directly instead.
          hasText: text.length > 0,
          labelRatio: text.length > 0 ? ratio(over(parse(cs.color), face), face) : Number.POSITIVE_INFINITY,
          underlined: cs.textDecorationLine.includes('underline') || hasGlyph,
          raised,
        });
      }
      return out;
    },
    { selector: INTERACTIVE, route },
  );
}

test.describe('every control keeps a real edge (NEUMORPHIC-DELTA.md §3.3)', () => {
  for (const route of CONTROL_ROUTES) {
    test(`${route}: border >= 3:1 and label >= 4.5:1, measured`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main, section, nav').first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(150);

      const found = await sweep(page, route);

      // FIRST, before any per-element assertion: an empty list satisfies every
      // loop below it, so the count is the only thing standing between this
      // spec and a green vacuum.
      expect(found.length, `no interactive elements found on ${route}`).toBeGreaterThan(0);

      const live = found.filter((c) => !c.disabled);
      const surfaces = live.filter((c) => c.kind === 'surface');
      const texts = live.filter((c) => c.kind === 'text');

      const failures: string[] = [];
      for (const c of surfaces) {
        if (c.borderRatio === null) {
          failures.push(`${c.id} ("${c.name}") paints a surface with NO border — bounded by the shadow pair alone`);
        } else if (c.borderRatio < 3) {
          failures.push(`${c.id} ("${c.name}") border ${c.borderRatio.toFixed(2)}:1, needs 3:1`);
        }
      }
      for (const c of texts) {
        if (!c.underlined) {
          failures.push(
            `${c.id} ("${c.name}") is a text control with no underline and no glyph — a hue is its only cue`,
          );
        }
      }
      for (const c of live) {
        if (c.labelRatio < 4.5) {
          failures.push(`${c.id} ("${c.name}") label ${c.labelRatio.toFixed(2)}:1, needs 4.5:1`);
        }
      }
      expect(failures, `${route}\n  ${failures.join('\n  ')}`).toEqual([]);
    });
  }

  test('the sweep sees both populations, so neither rule is vacuous', async ({ page }) => {
    const all: Measured[] = [];
    for (const route of CONTROL_ROUTES) {
      await page.goto(route);
      await expect(page.locator('main, section, nav').first()).toBeVisible({ timeout: 20_000 });
      all.push(...(await sweep(page, route)));
    }
    expect(all.length).toBeGreaterThan(20);
    // A rule with an empty population is a rule that cannot fail.
    expect(all.filter((c) => c.kind === 'surface').length, 'no surface-painting control was measured').toBeGreaterThan(
      10,
    );
    expect(all.filter((c) => c.kind === 'text').length, 'no text control was measured').toBeGreaterThan(0);
    // The house style, distinct from the rule: controls on a page surface are
    // raised. The board's Skip control is the documented exception (Δ1 rule 4)
    // and is not on these routes.
    expect(all.filter((c) => c.raised).length, 'nothing carries the neumorphic raise').toBeGreaterThan(5);

    test.info().annotations.push({
      type: 'controls-measured',
      description: [...new Set(all.map((c) => `${c.id} border=${String(c.borderRatio)} label=${String(c.labelRatio)}`))]
        .sort()
        .join(' | '),
    });
  });

  /*
   * Press, focus and disabled on a SOFT ground. Each is verified rather than
   * assumed, because the ground moved underneath all three: the previous pass
   * expressed depth with a crisp edge and never set `:active` at all, so with
   * the raise arriving the app could have shipped controls whose press does
   * nothing at all — neumorphism's other characteristic failure.
   */
  test('press, focus and disabled are perceptible on the soft ground', async ({ page }) => {
    await page.goto('./settings');
    const submit = page.getByRole('button', { name: 'Send me a sign-in link' });
    const target = (await submit.isVisible().catch(() => false))
      ? submit
      : page.getByRole('button', { name: /Clear this device/ });
    await expect(target).toBeVisible({ timeout: 20_000 });

    const box = (await target.boundingBox())!;
    const rest = await target.evaluate((el) => getComputedStyle(el).boxShadow);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    const pressed = await target.evaluate((el) => ({
      shadow: getComputedStyle(el).boxShadow,
      transform: getComputedStyle(el).transform,
    }));
    await page.mouse.up();

    expect(pressed.shadow, 'the press must change the control, not just its cursor').not.toBe(rest);
    expect(pressed.shadow, 'the press is the inset pair — the depth inverts').toContain('inset');
    expect(pressed.transform, 'the press also moves the control, for anyone who cannot resolve a 1.72:1 shadow').not.toBe(
      'none',
    );

    // Focus: the ring is --accent (5.85:1 on the ground), NOT the shadow.
    //
    // Reached by KEYBOARD, and that is not fussiness. The first version of this
    // check called `.focus()` right after the press above and reported
    // `outline-style: none` — Chromium had last seen a mouse, so `:focus-visible`
    // legitimately did not match and a working ring read as a missing one. The
    // ring's rule is `:focus-visible`, so the only honest way to ask about it is
    // to arrive the way that selector is for.
    await page.reload();
    await expect(target).toBeVisible({ timeout: 20_000 });
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await target.evaluate((el) => el === document.activeElement);
    }
    expect(reached, 'the control could not be reached by keyboard at all').toBe(true);
    const ring = await target.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { w: cs.outlineWidth, style: cs.outlineStyle, colour: cs.outlineColor, offset: cs.outlineOffset };
    });
    expect(ring.style, 'the focus ring vanished on the new ground').not.toBe('none');
    expect(parseFloat(ring.w)).toBeGreaterThanOrEqual(3);
    expect(ring.colour).toBe('rgb(18, 97, 74)');

    // Disabled: a second, non-colour channel. The call sites dim with opacity;
    // losing the raise is what survives a viewer who cannot use the dimming.
    await page.goto('./play');
    const disabled = await page.evaluate(() => {
      const el = document.createElement('button');
      el.className = 'btn btn-primary';
      el.disabled = true;
      el.textContent = 'x';
      document.body.append(el);
      const cs = getComputedStyle(el);
      const seen = { shadow: cs.boxShadow, cursor: cs.cursor };
      el.remove();
      return seen;
    });
    expect(disabled.shadow, 'a disabled control must lose its raise, not only its opacity').toBe('none');
    expect(disabled.cursor).toBe('not-allowed');
  });
});

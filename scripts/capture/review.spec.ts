import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openLesson, readLesson, enableTextEntry } from '../../tests/audit/audit-helpers';

/**
 * PREMIUM-DELTA P4d — the review probes, read from computed styles.
 *
 * Nothing here reads a screenshot. Every number is `getComputedStyle` or a
 * `getBoundingClientRect` on the running production build, because a rendered
 * image cannot tell you whether a declaration took effect or a focus ring is
 * merely painted underneath something.
 *
 * Output: one JSON file per (appearance x text size), for the report to cite.
 */

const OUT = process.env['REVIEW_OUT'] ?? '/tmp/chessapp-review';

const PROBE = `(() => {
  const toRgb = (s) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(s);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (fg, bg) => fg.a >= 1 ? fg : {
    r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  };
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const c = toRgb(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.99) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\\s+/).slice(0, 3).join('.') : '') + ' :: ' + (el.textContent || '').trim().slice(0, 40);
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /* ---- contrast: every element with its own visible text ---- */
  const contrast = [];
  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    if (el.closest('[aria-hidden="true"]') || el.closest('.sr-only')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const s = getComputedStyle(el);
    const fg = toRgb(s.color); if (!fg) continue;
    const bg = bgOf(el);
    const px = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10) || 400;
    const large = px >= 24 || (px >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(over(fg, bg), bg);
    if (got < need - 0.005) contrast.push({ el: label(el), px, weight, got: +got.toFixed(2), need, fg: s.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')' });
  }

  /* ---- elevation: blur cap, and the one key-accent edge ---- */
  const blurs = [];
  const parseBlur = (layer) => {
    const nums = [...layer.replace(/(rgba?|hsla?|color|var)\\([^)]*\\)/gi, ' ').replace(/#[0-9a-f]{3,8}/gi, ' ').matchAll(/(-?\\d*\\.?\\d+)px/g)].map((m) => parseFloat(m[1]));
    return nums.length >= 3 ? nums[2] : 0;
  };
  const css = getComputedStyle(document.documentElement);
  const hexToRgbText = (h) => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((h||'').trim()); return m ? 'rgb(' + m.slice(1,4).map((x)=>parseInt(x,16)).join(', ') + ')' : '__none__'; };
  const keyAccent = hexToRgbText(css.getPropertyValue('--key-accent'));
  let keyAccentCount = 0;
  const keyAccentEls = [];
  let elementsSeen = 0;
  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    elementsSeen++;
    const s = getComputedStyle(el);
    if (s.boxShadow && s.boxShadow !== 'none') {
      for (const layer of s.boxShadow.split(/,(?![^()]*\\))/)) {
        if (parseBlur(layer.trim()) > 4) blurs.push({ el: label(el), shadow: s.boxShadow });
      }
    }
    if (keyAccent !== '__none__') {
      for (const side of ['borderBottomColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor']) {
        const w = parseFloat(s[side.replace('Color', 'Width')]) || 0;
        if (w > 0 && s[side] === keyAccent) { keyAccentCount++; keyAccentEls.push(label(el)); break; }
      }
    }
  }

  /* ---- touch targets: everything a pointer can act on ---- */
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [tabindex="0"]')) {
    if (!visible(el)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) small.push({ el: label(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  }

  /* ---- emoji used as an icon: a pictograph that is the whole of an element ---- */
  const EMOJI = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/u;
  const emoji = [];
  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (t && EMOJI.test(t)) emoji.push({ el: label(el), text: t });
  }

  return { contrast, blurs, keyAccentCount, keyAccentEls, small, emoji, elementsSeen };
})()`;

/** Focus every interactive element and require a measurable visual change. */
const FOCUS_PROBE = `(async () => {
  const sig = (el) => { const s = getComputedStyle(el); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|'); };
  const out = [];
  const els = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex="0"]')]
    .filter((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]'); });
  for (const el of els) {
    const before = sig(el);
    el.focus();
    await new Promise((r) => requestAnimationFrame(r));
    const after = sig(el);
    if (document.activeElement !== el) { out.push({ el: el.tagName + ' :: ' + (el.textContent||'').trim().slice(0,30), why: 'not focusable' }); continue; }
    if (before === after) out.push({ el: el.tagName + ' :: ' + (el.textContent||'').trim().slice(0,30), why: 'no visual change on focus', sig: after });
    el.blur();
  }
  return { checked: els.length, noRing: out };
})()`;

const LESSON = readLesson('1.1.1');

const SCREENS: { name: string; go: (p: Page) => Promise<void> }[] = [
  { name: 'today', go: async (p) => { await p.goto('./'); await p.waitForTimeout(800); } },
  { name: 'path', go: async (p) => { await p.goto('./path'); await p.waitForTimeout(400); } },
  { name: 'lesson-card', go: async (p) => { await p.goto(`./lesson/${LESSON.id}`); await p.waitForTimeout(800); } },
  { name: 'lesson-challenge', go: async (p) => { await openLesson(p, LESSON); await p.waitForTimeout(400); } },
  { name: 'checkpoint-intro', go: async (p) => { await p.goto('./checkpoint/1.1'); await p.waitForTimeout(400); } },
  { name: 'choose-opponent', go: async (p) => { await p.goto('./play'); await p.waitForTimeout(400); } },
  { name: 'progress', go: async (p) => { await p.goto('./progress'); await p.waitForTimeout(400); } },
  { name: 'settings', go: async (p) => { await p.goto('./settings'); await p.waitForTimeout(400); } },
  { name: 'licences', go: async (p) => { await p.goto('./licences'); await p.waitForTimeout(400); } },
  { name: 'not-found', go: async (p) => { await p.goto('./no-such-route'); await p.waitForTimeout(400); } },
];

const CASES = [
  { tag: 'phone-light', width: 390, height: 844, scheme: 'light' as const, zoom: 1 },
  { tag: 'phone-dark', width: 390, height: 844, scheme: 'dark' as const, zoom: 1 },
  { tag: 'desktop-light', width: 1280, height: 800, scheme: 'light' as const, zoom: 1 },
  { tag: 'desktop-dark', width: 1280, height: 800, scheme: 'dark' as const, zoom: 1 },
  // "Largest text": the browser's own largest-text setting is a root font-size
  // change, which is what the app's rem scale responds to. 200% is the WCAG
  // 1.4.4 figure and the size the reflow specs already use.
  { tag: 'phone-light-200', width: 390, height: 844, scheme: 'light' as const, zoom: 2 },
  { tag: 'phone-dark-200', width: 390, height: 844, scheme: 'dark' as const, zoom: 2 },
];

for (const c of CASES) {
  test(`probe ${c.tag}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: c.width, height: c.height });
    await page.emulateMedia({ colorScheme: c.scheme });
    if (c.zoom > 1) {
      await page.addInitScript((z) => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = `${String(16 * z)}px`;
        });
      }, c.zoom);
    }
    await enableTextEntry(page);
    const report: Record<string, unknown> = {};
    for (const s of SCREENS) {
      await s.go(page);
      if (c.zoom > 1) await page.evaluate((z) => { document.documentElement.style.fontSize = `${String(16 * z)}px`; }, c.zoom);
      await page.waitForTimeout(250);
      const base = await page.evaluate(PROBE);
      const focus = await page.evaluate(FOCUS_PROBE);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      report[s.name] = { ...(base as object), focus, overflow };
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${c.tag}.json`), JSON.stringify(report, null, 1));
  });
}

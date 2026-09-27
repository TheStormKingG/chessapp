import { SKILL_TITLE } from './types';
import type { Measure, Profile, SkillBreakdown } from './types';

/**
 * F-SW-8, "Shareable and exportable", verbatim:
 *
 * > "The profile can be exported as an image without the rating, and the
 * > underlying data as a file, for a learner who works with a human coach."
 *
 * ── TWO EXPORTS, AND THE RATING IS THE DIFFERENCE BETWEEN THEM ───────────────
 *
 * The image is for sharing, so the rating comes off it: a rating is the one number
 * on this screen a learner might not want a group chat to have, and F-SW-8 says so.
 * The data file is for a coach, who needs it, so it is there. That asymmetry is
 * the requirement, and `profileExport.test.ts` checks it in both directions —
 * absent from the image AND present in the file, because an "absent" assertion
 * alone is satisfied by an export that contains nothing at all.
 *
 * ── WHY SVG RATHER THAN PNG ──────────────────────────────────────────────────
 *
 * "An image" does not say which format. SVG is chosen because:
 *
 *  - It needs no canvas. A PNG would mean `canvas.toDataURL`, which jsdom does not
 *    implement, so the one thing that must be tested — that the rating is not in
 *    the bytes — would be untestable in the suite and would have to be asserted in
 *    a comment instead.
 *  - The bytes are text, so the check above is a string search over exactly what a
 *    recipient receives, not over a model of it.
 *  - It is a real image: every browser renders it, it can be dropped into a
 *    message, and it scales without the 390px-wide screenshot look.
 *
 * No web font is referenced, for the reason DESIGN-SYSTEM.md §3.2 gives about not
 * shipping one: the SVG names the same system stack the app uses, so it renders
 * with the recipient's own UI face and carries no download.
 *
 * ── WHAT THE IMAGE CARRIES, AND WHAT IT DOES NOT ─────────────────────────────
 *
 * The sample size, the strengths and the weaknesses with their counts. Not the
 * fourteen detail rows of F-SW-4: those are the coach's material and they are in
 * the data file, complete. An image that carried everything would be a screenshot
 * of a scrolling screen, unreadable at the size anything renders a shared image,
 * and F-SW-8's two exports exist precisely because one artefact cannot be both.
 */

/** F-SW-8's data file. The whole profile, plus provenance. */
export interface ProfileFile {
  /** Bumped when the shape changes, so a coach's saved file can be read later. */
  format: 1;
  exportedAt: string;
  app: 'ChessApp';
  /** Present here and NOT in the image. F-SW-8. */
  rating: number | null;
  /**
   * Stated in the file itself, because a coach reading it must not infer that a
   * missing comparison means "average". See bandStats.ts.
   */
  comparisonsNote: string;
  profile: Profile;
}

/**
 * Typographic quotes, not straight ones. `JSON.stringify` escapes a straight
 * double quote to `\"`, so a coach opening the file in a text editor reads
 * `never \"average\"` — and a test searching for the sentence has to know that,
 * which is a test that knows about the serialiser rather than about the sentence.
 */
const NO_BAND_NOTE =
  'No rating-bucketed population statistics ship with this app, so no number in this profile is compared with other players. An absent comparison means “not measured”, never “average”.';

export function profileFile(profile: Profile, opts: { rating: number | null; now: string }): ProfileFile {
  return {
    format: 1,
    exportedAt: opts.now,
    app: 'ChessApp',
    rating: opts.rating,
    comparisonsNote: profile.comparisons.shown
      ? 'Comparisons in this profile are against the typical value for the learner’s rating band.'
      : NO_BAND_NOTE,
    profile,
  };
}

export function profileFileName(now: string): string {
  // The date only: a coach receiving two files wants to tell them apart by day,
  // and a filename with a colon in it is rejected on Windows.
  return `chessapp-profile-${now.slice(0, 10)}.json`;
}

export function profileFileText(file: ProfileFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** What a `Measure` reads as in one line of text. */
export function measureText(m: Measure): string {
  switch (m.kind) {
    case 'percent':
      return `${String(m.value)}%`;
    case 'rate':
      return `${String(m.value)} a game`;
    case 'count':
      return String(m.value);
    case 'absent':
      return 'not measured';
  }
}

/** XML-escapes text going into an SVG. Five characters, all of them mandatory. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Breaks a line to fit the card, at word boundaries, to at most `lines` lines. */
function wrap(text: string, perLine: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let current = '';
  for (const w of words) {
    if (current.length === 0) current = w;
    else if (current.length + 1 + w.length <= perLine) current = `${current} ${w}`;
    else {
      out.push(current);
      current = w;
      if (out.length === lines) break;
    }
  }
  if (out.length < lines && current.length > 0) out.push(current);
  if (out.length === lines && words.join(' ').length > out.join(' ').length) {
    const last = out[lines - 1];
    if (last !== undefined) out[lines - 1] = `${last.slice(0, Math.max(0, perLine - 1))}…`;
  }
  return out;
}

const CARD_W = 1080;
const PAD = 64;
const FONT_UI = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const FONT_INDEX = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, 'Roboto Mono', Consolas, monospace";

/**
 * F-SW-8's image, as an SVG string.
 *
 * Light-appearance tokens only, taken from DESIGN-SYSTEM.md §3.1. A shared image
 * has no `prefers-color-scheme` to read — it is a file, and the reader's client
 * decides nothing — so it is drawn once in the appearance that composites onto
 * anything: an opaque light card, never a transparent one that vanishes on a dark
 * background.
 */
export function profileImageSvg(profile: Profile): string {
  const lines: { y: number; svg: string }[] = [];
  let y = PAD;

  const push = (svg: string, advance: number) => {
    lines.push({ y, svg });
    y += advance;
  };

  const text = (
    content: string,
    opts: { size: number; weight?: number; fill?: string; font?: string; dy?: number },
  ) =>
    `<text x="${String(PAD)}" y="${String(y + (opts.dy ?? 0))}" font-family="${opts.font ?? FONT_UI}" font-size="${String(opts.size)}" font-weight="${String(opts.weight ?? 400)}" fill="${opts.fill ?? '#1A1D1B'}">${esc(content)}</text>`;

  push(text('Your chess, in numbers', { size: 52, weight: 700 }), 62);
  push(
    text(
      `Built on ${String(profile.games)} analysed ${profile.games === 1 ? 'game' : 'games'}`,
      { size: 28, font: FONT_INDEX, fill: '#565B58' },
    ),
    58,
  );

  if (profile.strengths.length > 0) {
    push(text('What you do well', { size: 24, weight: 600, fill: '#12614A' }), 40);
    for (const s of profile.strengths) {
      for (const line of wrap(s.text, 74, 2)) {
        push(text(line, { size: 26 }), 36);
      }
      y += 8;
    }
    y += 16;
  }

  if (profile.weaknesses.length > 0) {
    push(text('What to work on', { size: 24, weight: 600, fill: '#7A5310' }), 40);
    for (const w of profile.weaknesses) {
      push(text(w.name, { size: 28, weight: 600 }), 34);
      push(
        text(
          `${String(w.occurrences)} ${w.occurrences === 1 ? 'time' : 'times'} in ${String(w.games)} ${w.games === 1 ? 'game' : 'games'}`,
          { size: 24, font: FONT_INDEX, fill: '#565B58' },
        ),
        44,
      );
    }
    y += 8;
  }

  if (profile.strengths.length === 0 && profile.weaknesses.length === 0) {
    for (const line of wrap('Not enough analysed games yet to say anything about this profile.', 74, 2)) {
      push(text(line, { size: 26, fill: '#565B58' }), 36);
    }
    y += 16;
  }

  push(text('ChessApp', { size: 22, font: FONT_INDEX, fill: '#565B58' }), 36);

  const height = y + PAD - 24;
  const body = lines.map((l) => l.svg).join('\n  ');
  // `role="img"` and the title/desc pair: an SVG dropped into a page or opened in
  // a browser announces what it is rather than being an unlabelled graphic.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(CARD_W)} ${String(height)}" width="${String(CARD_W)}" height="${String(height)}" role="img" aria-labelledby="t d">
  <title id="t">ChessApp strengths and weaknesses</title>
  <desc id="d">${esc(imageAltText(profile))}</desc>
  <rect width="${String(CARD_W)}" height="${String(height)}" fill="#FBFAF7"/>
  <rect x="0" y="0" width="${String(CARD_W)}" height="8" fill="#12614A"/>
  ${body}
</svg>
`;
}

/**
 * The image's own description, and the screen's alternative text for it.
 *
 * One function so the two cannot drift: an image whose `desc` says something
 * different from the page's `alt` is two answers to one question.
 */
export function imageAltText(profile: Profile): string {
  const parts = [`A card summarising ${String(profile.games)} analysed games.`];
  if (profile.strengths.length > 0) parts.push(`Strengths: ${profile.strengths.map((s) => s.text).join(' ')}`);
  if (profile.weaknesses.length > 0) {
    parts.push(
      `To work on: ${profile.weaknesses.map((w) => `${w.name}, ${String(w.occurrences)} times in ${String(w.games)} games`).join('; ')}.`,
    );
  }
  if (profile.strengths.length === 0 && profile.weaknesses.length === 0) {
    parts.push('Not enough analysed games yet to say anything about this profile.');
  }
  return parts.join(' ');
}

export function profileImageName(now: string): string {
  return `chessapp-profile-${now.slice(0, 10)}.svg`;
}

/** A plain-text rendering of one skill, used by the file's readers and by tests. */
export function skillText(s: SkillBreakdown): string {
  const rows = s.rows.map((r) => `  ${r.label}: ${measureText(r.measure)}`);
  const missing = s.notMeasured.map((n) => `  Not measured: ${n}`);
  return [`${SKILL_TITLE[s.id]}`, ...rows, ...missing].join('\n');
}

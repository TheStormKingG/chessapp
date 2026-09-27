import { expect, test } from 'vitest';
import { buildProfile } from './buildProfile';
import {
  imageAltText,
  measureText,
  profileFile,
  profileFileName,
  profileFileText,
  profileImageName,
  profileImageSvg,
  skillText,
} from './exportProfile';
import { games, type GameSpec } from './testGames';

const RATING = 1234;
const NOW = '2026-09-26T13:45:07.000Z';

const withTheme: GameSpec = {
  moves: [{ label: 'Mistake', drop: 30, winBefore: 70 }],
  errors: [{ theme: 'hung_piece', ply: 0 }],
};

const profile = () => buildProfile(games(14, () => withTheme), { rating: RATING });

// ── F-SW-8's asymmetry ──────────────────────────────────────────────────────

test('the exported image does not contain the rating', () => {
  const svg = profileImageSvg(profile());
  expect(svg).not.toContain(String(RATING));
  // Nor any four-digit number that could be read as one. The SVG carries
  // coordinates and a width, so the check is scoped to what a reader would see:
  // the text nodes.
  const textContent = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1] ?? '').join(' ');
  expect(textContent).not.toMatch(/\b\d{4}\b/);
  expect(textContent.length).toBeGreaterThan(20);
});

test('POSITIVE CONTROL: the data file does contain the rating', () => {
  // Without this, the test above would also pass for an image generator that
  // produced an empty string, and for a build in which the rating was never
  // available to either export. This is the query proving it would have found one.
  const text = profileFileText(profileFile(profile(), { rating: RATING, now: NOW }));
  expect(text).toContain(String(RATING));
  expect(JSON.parse(text)).toMatchObject({ rating: RATING });
});

test('the data file records a null rating as null rather than omitting it', () => {
  // Which is the shipped case: the app has no game-rating estimate. A missing key
  // would read to a coach as an export bug rather than as an absent measurement.
  const parsed: unknown = JSON.parse(profileFileText(profileFile(profile(), { rating: null, now: NOW })));
  expect(parsed).toMatchObject({ rating: null });
  expect(Object.keys(parsed as object)).toContain('rating');
});

// ── The data file ───────────────────────────────────────────────────────────

test('the file is valid JSON and round-trips the whole profile', () => {
  const p = profile();
  const parsed = JSON.parse(profileFileText(profileFile(p, { rating: RATING, now: NOW }))) as { profile: unknown };
  expect(parsed.profile).toEqual(JSON.parse(JSON.stringify(p)));
});

test('the file says in words that an absent comparison is not an average', () => {
  // A coach reading a profile with no comparisons must not infer "average". The
  // note is in the file rather than only on the screen, because the file is what
  // travels.
  const text = profileFileText(profileFile(profile(), { rating: RATING, now: NOW }));
  expect(text).toContain('never “average”');
});

test('the file carries a format version and when it was exported', () => {
  const f = profileFile(profile(), { rating: RATING, now: NOW });
  expect(f.format).toBe(1);
  expect(f.exportedAt).toBe(NOW);
});

test('the file names are safe on every platform and carry the date', () => {
  expect(profileFileName(NOW)).toBe('chessapp-profile-2026-09-26.json');
  expect(profileImageName(NOW)).toBe('chessapp-profile-2026-09-26.svg');
  for (const name of [profileFileName(NOW), profileImageName(NOW)]) {
    // A colon in a filename is rejected on Windows, which a raw ISO timestamp has.
    expect(name).not.toMatch(/[:*?"<>|]/);
  }
});

// ── The image ───────────────────────────────────────────────────────────────

test('the image is well-formed SVG that a browser will parse', () => {
  const svg = profileImageSvg(profile());
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect(doc.documentElement.tagName).toBe('svg');
  expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
});

test('the image is labelled, not an unlabelled graphic', () => {
  const svg = profileImageSvg(profile());
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.documentElement.getAttribute('role')).toBe('img');
  expect(doc.querySelector('title')?.textContent).toBeTruthy();
  expect(doc.querySelector('desc')?.textContent).toBe(imageAltText(profile()));
});

test('the image states the sample size, because the numbers on it are meaningless without one', () => {
  const svg = profileImageSvg(buildProfile(games(14, () => withTheme)));
  expect(svg).toContain('Built on 14 analysed games');
});

test('a one-game profile says game, not games', () => {
  expect(profileImageSvg(buildProfile(games(1)))).toContain('Built on 1 analysed game<');
});

test('the image escapes the five XML characters, so an opening name cannot break it', () => {
  // Opening names come from a fetched data file. One containing an ampersand would
  // produce invalid XML and an image that renders as nothing.
  //
  // The name reaches the image through the OPENING STRENGTH, which is the only
  // route by which free text from outside the app gets onto the card. So every
  // game carries all four error themes: without them the three clean-habit
  // strengths outrank the opening one, the name never reaches the image, and this
  // test passes while proving nothing — which is what it did on the first run.
  const p = buildProfile(
    games(6, () => ({
      learner: 'w',
      result: 'win',
      opening: { name: 'Bishop <&> Knight "Attack"', leftBookAtPly: 8 },
      moves: [{ accuracy: 70, phase: 'opening' }],
      errors: [
        { theme: 'hung_piece', ply: 0 },
        { theme: 'missed_capture', ply: 0 },
        { theme: 'missed_mate', ply: 0 },
        { theme: 'ignored_threat', ply: 0 },
      ],
    })),
  );
  const svg = profileImageSvg(p);
  expect(svg).toContain('&amp;');
  expect(svg).not.toMatch(/<&>/);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  // Non-vacuous: the name really did reach the image.
  expect(svg).toContain('Bishop &lt;&amp;&gt; Knight');
});

test('an empty profile still produces a readable image rather than a blank card', () => {
  const svg = profileImageSvg(buildProfile([]));
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect(svg).toContain('Built on 0 analysed games');
  expect(svg).toContain('Not enough analysed games');
});

test('the image grows with its content instead of clipping it', () => {
  // A fixed height would cut the third weakness off the bottom, silently.
  const heightOf = (svg: string) => Number(/height="(\d+)"/.exec(svg)?.[1] ?? '0');
  const small = heightOf(profileImageSvg(buildProfile([])));
  const large = heightOf(profileImageSvg(profile()));
  expect(small).toBeGreaterThan(0);
  expect(large).toBeGreaterThan(small);
});

test('the image alt text carries every claim the image makes', () => {
  // The image is the shared artefact; someone reading it with a screen reader must
  // get the same content, not "image".
  const p = profile();
  const alt = imageAltText(p);
  for (const w of p.weaknesses) expect(alt).toContain(w.name);
  for (const s of p.strengths) expect(alt).toContain(s.text);
  expect(alt).toContain(String(p.games));
});

// ── Text rendering ──────────────────────────────────────────────────────────

test('every kind of measure reads as something, and an absent one says so', () => {
  expect(measureText({ kind: 'percent', value: 61.5 })).toBe('61.5%');
  expect(measureText({ kind: 'rate', value: 0.75, per: 'game' })).toBe('0.75 a game');
  expect(measureText({ kind: 'count', value: 12 })).toBe('12');
  expect(measureText({ kind: 'absent', reason: 'No games.' })).toBe('not measured');
});

test('a skill renders with its rows and with what it cannot measure', () => {
  const p = profile();
  const habits = p.skills.find((s) => s.id === 'habits');
  expect(habits).toBeDefined();
  if (habits) {
    const text = skillText(habits);
    expect(text).toContain('Thinking and habits');
    expect(text).toContain('Blunders in winning positions');
    expect(text).toContain('Not measured:');
    expect(text).toContain('habit-score trend');
  }
});

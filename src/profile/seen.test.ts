import { beforeEach, expect, test } from 'vitest';
import { buildProfile } from './buildProfile';
import { profileHasChanged, profileSignature, reviewedGamesChanged, useProfileSeen } from './seen';
import { games, type GameSpec } from './testGames';
import { jsonDownloadHref, svgDownloadHref, dataUrl } from './download';

const hung: GameSpec = {
  moves: [{ label: 'Mistake', drop: 30, winBefore: 70 }],
  errors: [{ theme: 'hung_piece', ply: 0 }],
};
const mate: GameSpec = {
  moves: [{ label: 'Mistake', drop: 40, winBefore: 70 }],
  errors: [{ theme: 'missed_mate', ply: 0 }],
};

beforeEach(() => {
  useProfileSeen.setState({ lastSeen: null, lastSeenReviews: null });
});

test('an empty profile never announces itself', () => {
  // A link implying there is something to read, to a screen that says there is not.
  expect(profileHasChanged(buildProfile([]), null)).toBe(false);
  expect(profileHasChanged(null, null)).toBe(false);
});

test('a first profile with games announces itself', () => {
  expect(profileHasChanged(buildProfile(games(3, () => hung)), null)).toBe(true);
});

test('a profile the learner has already seen does not announce itself again', () => {
  const p = buildProfile(games(3, () => hung));
  expect(profileHasChanged(p, profileSignature(p))).toBe(false);
});

test('one more game is a change', () => {
  const before = buildProfile(games(3, () => hung));
  const after = buildProfile(games(4, () => hung));
  expect(profileHasChanged(after, profileSignature(before))).toBe(true);
});

test('a new weakness entering the top three is a change', () => {
  const before = buildProfile(games(6, () => hung));
  const after = buildProfile([...games(6, () => hung), ...games(6, () => mate, 6)]);
  expect(before.weaknesses.map((w) => w.theme)).not.toEqual(after.weaknesses.map((w) => w.theme));
  expect(profileHasChanged(after, profileSignature(before))).toBe(true);
});

test('the top three swapping order is a change', () => {
  // A learner whose first and second weaknesses have traded places has something
  // new to read, even though the set is identical.
  const a = buildProfile([...games(3, () => hung), ...games(6, () => mate, 3)]);
  const b = buildProfile([...games(6, () => hung), ...games(3, () => mate, 6)]);
  expect(a.weaknesses[0]?.theme).not.toBe(b.weaknesses[0]?.theme);
  expect(profileSignature(a)).not.toBe(profileSignature(b));
});

test('a signature is not a hash of the whole profile', () => {
  // Otherwise a tenth of a point of accuracy would put a permanent notice on
  // Today, and a notice that is always on is not a notice. Same games, same
  // weaknesses, different accuracy.
  const withAccuracy = (a: number): GameSpec => ({
    moves: [{ label: 'Mistake', drop: 30, winBefore: 70, accuracy: a }],
    errors: [{ theme: 'hung_piece', ply: 0 }],
  });
  const p1 = buildProfile(games(5, () => withAccuracy(50)));
  const p2 = buildProfile(games(5, () => withAccuracy(90)));
  expect(p1.skills).not.toEqual(p2.skills);
  expect(profileSignature(p1)).toBe(profileSignature(p2));
});

test('marking seen stops the announcement', () => {
  const p = buildProfile(games(3, () => hung));
  expect(profileHasChanged(p, useProfileSeen.getState().lastSeen)).toBe(true);
  useProfileSeen.getState().markSeen(profileSignature(p), 3);
  expect(profileHasChanged(p, useProfileSeen.getState().lastSeen)).toBe(false);
});

// ── The download hrefs ──────────────────────────────────────────────────────

test('a download href carries the exact bytes, non-ASCII included', () => {
  // The profile's own copy uses typographic quotes, which `btoa` throws on. This
  // is the reason the encoding is percent-escapes and not base64.
  const text = 'never “average” — ’';
  const href = jsonDownloadHref(text);
  expect(href.startsWith('data:application/json;charset=utf-8,')).toBe(true);
  expect(decodeURIComponent(href.slice('data:application/json;charset=utf-8,'.length))).toBe(text);
});

test('the svg href declares the image media type', () => {
  expect(svgDownloadHref('<svg/>').startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
});

test('characters that would break a URL are escaped', () => {
  // A raw `#` truncates a data URL at the fragment, silently losing the rest of
  // the file — and `#` is in every hex colour the SVG carries.
  const href = dataUrl('image/svg+xml', 'fill="#12614A" & more');
  expect(href).not.toContain('#');
  expect(decodeURIComponent(href.split(',')[1] ?? '')).toBe('fill="#12614A" & more');
});

// ── Today's cheap check (F-SW-1's "reachable from Today when it has changed") ──

test('a learner with no reviewed games is never offered the profile from Today', () => {
  expect(reviewedGamesChanged(0, null)).toBe(false);
  expect(reviewedGamesChanged(0, 0)).toBe(false);
});

test('a first reviewed game is offered, and stops being offered once seen', () => {
  expect(reviewedGamesChanged(1, null)).toBe(true);
  expect(reviewedGamesChanged(1, 1)).toBe(false);
  expect(reviewedGamesChanged(2, 1)).toBe(true);
});

test('markSeen records the reviewed count Today compares against', () => {
  const p = buildProfile(games(3, () => hung));
  useProfileSeen.getState().markSeen(profileSignature(p), 3);
  expect(useProfileSeen.getState().lastSeenReviews).toBe(3);
  expect(reviewedGamesChanged(3, useProfileSeen.getState().lastSeenReviews)).toBe(false);
  expect(reviewedGamesChanged(4, useProfileSeen.getState().lastSeenReviews)).toBe(true);
});

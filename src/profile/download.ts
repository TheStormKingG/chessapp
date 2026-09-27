/**
 * F-SW-8's two downloads, as `href` values.
 *
 * ── WHY A DATA URL AND NOT A BLOB ────────────────────────────────────────────
 *
 * `URL.createObjectURL` plus a synthetic anchor click is the usual pattern and it
 * is the wrong one here. It needs a click handler to fire, an object URL to be
 * revoked, and `URL.createObjectURL` to exist — which in jsdom it does not, so the
 * one thing worth testing (that the image the learner downloads has no rating in
 * it) would be untestable through the screen.
 *
 * A `data:` URL on an `<a download>` needs no JavaScript at all. The link is a
 * link: it works with the keyboard, it works with a middle click, it appears in the
 * accessibility tree as a link with a name, and its `href` is in the DOM where a
 * test can read the exact bytes the learner receives.
 *
 * Size. A profile's JSON is a few tens of kilobytes at the 500-game ceiling of
 * F-IM-2 — it carries game IDs and summary numbers, never moves — and the SVG card
 * is under four. Both are far inside every browser's data-URL limit for a download.
 * If the profile ever carried per-move data this would have to become a Blob, and
 * the test for the rating would have to move with it.
 */

/** Percent-encodes text for a `data:` URL, UTF-8 safe. */
export function dataUrl(mediaType: string, text: string): string {
  // `encodeURIComponent` handles every non-ASCII character as UTF-8 percent
  // escapes, which is what the typographic quotes in the profile's own copy need.
  // `btoa` would throw on them.
  return `data:${mediaType};charset=utf-8,${encodeURIComponent(text)}`;
}

export function jsonDownloadHref(text: string): string {
  return dataUrl('application/json', text);
}

export function svgDownloadHref(text: string): string {
  return dataUrl('image/svg+xml', text);
}

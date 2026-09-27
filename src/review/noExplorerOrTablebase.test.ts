import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * PRD F-ER-5, which is BLOCKED, and this file is the record of why.
 *
 * > "If the opening explorer or the tablebase is unavailable, the features that
 * > depend on them show a short 'offline' note and everything else continues.
 * > Drills that need the tablebase fall back to the engine."
 *
 * NEITHER DEPENDENCY EXISTS IN THIS APP. Measured against the repository on
 * 2026-09-27:
 *
 *   • No tablebase, of any kind. The word appears nowhere in `src/`. There is no
 *     bundled Syzygy set, no `tablebase.lichess.ovh` call, and therefore no drill
 *     that "needs the tablebase" and could fall back to anything.
 *   • No opening explorer. `public/data/openings.txt` is a BUNDLED name lookup —
 *     a sorted list of ECO lines from `lichess-org/chess-openings`, read by
 *     `review/openingBook.ts` — not an API. Its own header records why the
 *     explorer is deliberately not used: the explorer is online, and F-RV-10
 *     requires review to work offline. That is a decision, not an omission.
 *   • The only hosts `src/` reaches are `api.chess.com` and `lichess.org/api`,
 *     both for game import (F-IM-1), and both handled by F-ER-4.
 *
 * So there are no "features that depend on them", and nothing to show an offline
 * note for. A message about an explorer this app does not have would be a message
 * for a failure that cannot occur, and a file holding it would read as coverage
 * of a requirement that is in fact unimplementable as written. The honest state is
 * blocked.
 *
 * THE NEAREST THING THAT DOES EXIST, and what it does. The bundled book is
 * fetched (`/data/openings.txt`, deliberately not precached), so it CAN be
 * unavailable — and when it is, `review/ReviewScreen.tsx` catches, reports, and
 * builds the review with no opening name. That is "everything else continues"
 * without the note, and it is deliberate: the book contributes one line of prose
 * to a summary, so its absence is the absence of a nicety, not of a feature, and
 * `ReviewScreen.test.tsx` asserts that no empty field is left where the name
 * would have gone. Calling that F-ER-5 would be a stretch — the clause is about
 * two named online services — so it is named here rather than claimed there.
 *
 * WHY THIS IS A TEST AND NOT A COMMENT. "Blocked because the dependency does not
 * exist" is a claim about the repository, and the day someone adds an explorer
 * call the claim becomes false with nothing to notice. If this file fails,
 * F-ER-5 has become implementable and the right response is to implement it.
 */

const SRC = resolve(__dirname, '..');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const SOURCES = filesUnder(SRC).filter((f) => !/\.test\.tsx?$/.test(f));

describe('F-ER-5 is blocked: neither dependency exists', () => {
  test('the scan reads the app, so its absences mean something', () => {
    // The positive control for everything below. A `filesUnder` that returned
    // nothing would satisfy every absence in this file.
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(SOURCES.some((f) => f.endsWith('review/openingBook.ts'))).toBe(true);
    // And the scan really is reading contents, not just names: this string is in
    // a file the scan must have opened.
    const all = SOURCES.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(all).toContain('export function parseBook');
  });

  test('no module mentions a tablebase', () => {
    const hits = SOURCES.filter((f) => /tablebase|syzygy/i.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  test('no module calls an opening explorer or tablebase API', () => {
    const hits: string[] = [];
    for (const f of SOURCES) {
      const source = readFileSync(f, 'utf8');
      if (/explorer\.lichess|tablebase\.lichess|lichess\.ovh|lichess\.org\/api\/opening/i.test(source)) {
        hits.push(f.slice(SRC.length + 1));
      }
    }
    expect(hits).toEqual([]);
  });

  test('the bundled book is a file, not a service', () => {
    const book = readFileSync(resolve(SRC, 'review/openingBook.ts'), 'utf8');
    // It reads a path under the app's own base URL. If this ever becomes an
    // absolute URL to somebody else's host, it has become a service and F-ER-5
    // applies to it.
    expect(book).toMatch(/data\/openings\.txt/);
    expect(book).not.toMatch(/https?:\/\//);
    // And the file it reads is really shipped, so "bundled" is not aspirational.
    expect(existsSync(resolve(SRC, '../public/data/openings.txt'))).toBe(true);
  });

  test('the only hosts the app reaches are the two import sources', () => {
    const hosts = new Set<string>();
    for (const f of SOURCES) {
      for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
        const host = m[1] ?? '';
        // w3.org is the SVG namespace; the rest of the excluded set is
        // documentation links in comments and the licences screen.
        if (/w3\.org|react\.dev|dexie\.org|developer\.chrome\.com|vite-pwa-org|github\.com|\.test$|^x$/.test(host)) {
          continue;
        }
        hosts.add(host);
      }
    }
    // `database.lichess.org` is the CC0 dump the puzzle pack was BUILT from,
    // named in a comment and in the licences screen; nothing fetches it at
    // runtime. api.chess.com and lichess.org/api are F-IM-1's import sources.
    expect([...hosts].sort()).toEqual(['api.chess.com', 'database.lichess.org', 'lichess.org']);
  });
});

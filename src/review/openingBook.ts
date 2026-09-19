/**
 * The bundled opening book (PRD F-RV-3, Appendix C "Book").
 *
 * Format is produced by scripts/build-opening-book.mjs; see that file's header.
 * Lookup is a binary search over sorted, fixed-width UCI paths: a position is in
 * the book when some book path starts with the game's path so far, and a
 * position is NAMED when the game's path so far is itself a book path.
 *
 * WHAT "BOOK" MEANS HERE, AND WHAT IT DOES NOT. Appendix C defines Book as a
 * move played in at least 5 per cent of games from that position. That rule is
 * NOT implemented here and cannot be: the CC0 source this book is built from
 * (lichess-org/chess-openings) is a list of named lines and carries no game
 * counts at all, and the only source that does — the Lichess opening explorer —
 * is an online API, which F-RV-10 (review works offline) rules out. The
 * substitute rule that actually ships is:
 *
 *   Book = the position after the move is a node of the bundled named-openings
 *          book, within the first 20 plies.
 *
 * It is stricter than Appendix C in one direction (a popular sideline with no
 * ECO name is not Book) and looser in another (a named but rare line is Book).
 * Design spec section 9.2 records this deviation and names its destination: a
 * build-time frequency extract from the Lichess database dumps, which is a
 * different data source with its own licence question, not a tuning constant.
 * Do not read anything in this file as an implementation of Appendix C's rule.
 */

export interface OpeningBook {
  maxPly: number;
  /** Sorted UCI paths, 4 characters per ply. */
  paths: string[];
  /** `nameOf[i]` is the name index for `paths[i]`. */
  nameOf: number[];
  names: string[];
}

export interface OpeningLookup {
  name: string | null;
  /** The first ply index that is not in the book, or null if the game never left it. */
  leftBookAtPly: number | null;
  /** Per ply: was the position AFTER that move still in the book. */
  bookPlies: boolean[];
}

export function parseBook(text: string): OpeningBook {
  const lines = text.split('\n');
  const header = lines[0] ?? '';
  const m = /^v1 (\d+) (\d+)$/.exec(header);
  if (!m) throw new Error(`opening book: bad header ${JSON.stringify(header)}`);
  const count = Number(m[1]);
  const maxPly = Number(m[2]);

  const paths: string[] = [];
  const nameOf: number[] = [];
  let i = 1;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || line === '@@') break;
    const tab = line.indexOf('\t');
    if (tab < 0) throw new Error(`opening book: bad row at line ${i + 1}`);
    paths.push(line.slice(0, tab));
    nameOf.push(Number(line.slice(tab + 1)));
  }
  if (paths.length !== count) {
    throw new Error(`opening book: expected ${count} lines, found ${paths.length}`);
  }
  const names = lines.slice(i + 1).filter((l) => l !== '');
  return { maxPly, paths, nameOf, names };
}

/** Index of the first path >= `prefix`, by binary search. */
function lowerBound(paths: string[], prefix: string): number {
  let lo = 0;
  let hi = paths.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    // `mid` is always < paths.length here, so the entry exists; the fallback
    // only exists to satisfy noUncheckedIndexedAccess.
    const cand = paths[mid] ?? '';
    if (cand < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * `ucis` is the game's moves in order, 4 characters each (5 with a promotion).
 * Returns the deepest name reached and the ply at which the game left book.
 */
export function lookupOpening(book: OpeningBook, ucis: string[]): OpeningLookup {
  const bookPlies: boolean[] = [];
  let name: string | null = null;
  let leftBookAtPly: number | null = null;
  let path = '';

  for (let ply = 0; ply < ucis.length; ply += 1) {
    if (ply >= book.maxPly || leftBookAtPly !== null) {
      bookPlies.push(false);
      if (leftBookAtPly === null) leftBookAtPly = ply;
      continue;
    }
    path += ucis[ply] ?? '';
    const at = lowerBound(book.paths, path);
    // In book when some entry starts with the path so far. Because the list is
    // sorted, the only candidate is the first entry at or after the path.
    const entry = at < book.paths.length ? book.paths[at] : undefined;
    const inBook = entry !== undefined && entry.startsWith(path);
    bookPlies.push(inBook);
    if (!inBook) {
      leftBookAtPly = ply;
      continue;
    }
    // Named when the path so far IS an entry, not merely a prefix of one.
    if (entry === path) {
      const ni = book.nameOf[at];
      name = (ni === undefined ? undefined : book.names[ni]) ?? name;
    }
  }

  return { name, leftBookAtPly, bookPlies };
}

let cached: Promise<OpeningBook> | null = null;

/**
 * Loads the book once per session, by fetch and never by import, so the 299.3
 * KiB file stays a static data asset and never enters the shell's JavaScript
 * (PRD 11; measured with scripts/measure-shell-size.mjs — 285.7 KiB gzipped
 * before this file and 285.7 KiB after, byte for byte).
 *
 * OFFLINE, MEASURED RATHER THAN ASSUMED. As the service worker is configured
 * today (vite.config.ts), `data/openings.txt` is NOT cached: the precache
 * globPatterns list js/css/html/svg/png/woff2/json and not txt, and the only
 * runtimeCaching rule matches `/engine/`. So an offline review currently gets
 * no opening name at all, however many reviews preceded it — not just the
 * first. That degrades to "no opening name" rather than failing, which is the
 * intended floor for F-RV-10 (the opening line is one line of a summary, not
 * the review), but the better behaviour needs a caching rule for `/data/` that
 * no task in the plan owns. Do not read this comment as a claim that the book
 * is cached.
 */
export function loadBook(fetchImpl: typeof fetch = fetch): Promise<OpeningBook> {
  cached ??= fetchImpl(`${import.meta.env.BASE_URL}data/openings.txt`)
    .then((r) => {
      if (!r.ok) throw new Error(`opening book: HTTP ${r.status}`);
      return r.text();
    })
    .then(parseBook);
  return cached;
}

/** Test seam: forget the cached book. */
export function resetBookCache(): void {
  cached = null;
}

/**
 * Builds the bundled opening book from lichess-org/chess-openings (CC0).
 *
 * PRD 9.1 and Appendix D name that repository as the source of opening names,
 * and F-RV-3 wants "the opening name with the move at which the game left the
 * bundled opening book". Appendix C's Book rule also asks for a 5-per-cent
 * frequency threshold, which this source does not carry at all — see the design
 * spec, section 9.2, for the substitute that ships and where the real rule goes.
 *
 * Output: public/data/openings.txt
 *
 *   line 1                 `v1 <lineCount> <maxPly>`
 *   lines 2..lineCount+1   `<uci><uci>...<uci>\t<nameIndex>`, sorted by the path
 *   one line               `@@`
 *   remaining lines        opening names, one per line, indexed from 0
 *
 * UCI moves are fixed width (4 characters, 5 with a promotion, which cannot
 * occur inside 20 plies of a named opening), so a path is a plain string prefix
 * and "is this position in the book" is a binary search for a prefix. Sorted
 * text with heavy shared prefixes compresses about 7.5x, which is why this beats
 * a position-hash table over the wire even though it is larger on disk.
 *
 * Usage:
 *   node scripts/build-opening-book.mjs <dir-with-a.tsv..e.tsv>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';

const MAX_PLY = 20; // Appendix C: "within the first ten moves".
const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/build-opening-book.mjs <dir-with-tsvs>');
  process.exit(2);
}

const rows = [];
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const text = readFileSync(join(src, `${f}.tsv`), 'utf8');
  const lines = text.split('\n');
  if (lines[0] !== 'eco\tname\tpgn') {
    console.error(`unexpected header in ${f}.tsv: ${JSON.stringify(lines[0])}`);
    process.exit(1);
  }
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [, name, pgn] = line.split('\t');
    rows.push({ name, pgn });
  }
}
if (rows.length < 3000) {
  console.error(`only ${rows.length} rows parsed; the source looks wrong`);
  process.exit(1);
}

const names = [];
const nameIdx = new Map();
const paths = new Map();
let skippedTooDeep = 0;
let skippedIllegal = 0;

for (const r of rows) {
  const sans = r.pgn.split(/\s+/).filter((t) => t && !/^\d+\.$/.test(t));
  if (sans.length > MAX_PLY) {
    skippedTooDeep += 1;
    continue;
  }
  const g = new Chess();
  const ucis = [];
  let ok = true;
  for (const san of sans) {
    let m;
    try {
      m = g.move(san);
    } catch {
      ok = false;
      break;
    }
    ucis.push(m.from + m.to + (m.promotion || ''));
  }
  if (!ok) {
    skippedIllegal += 1;
    continue;
  }
  let ni = nameIdx.get(r.name);
  if (ni === undefined) {
    ni = names.length;
    names.push(r.name);
    nameIdx.set(r.name, ni);
  }
  const path = ucis.join('');
  if (!paths.has(path)) paths.set(path, ni);
}

if (skippedIllegal > 0) {
  console.error(`${skippedIllegal} lines did not replay legally; refusing to ship a partial book`);
  process.exit(1);
}
for (const n of names) {
  if (n.includes('\n') || n.includes('\t')) {
    console.error(`name contains a delimiter: ${JSON.stringify(n)}`);
    process.exit(1);
  }
}

const sorted = [...paths.keys()].sort();
const body = sorted.map((p) => `${p}\t${paths.get(p)}`).join('\n');
const out = `v1 ${sorted.length} ${MAX_PLY}\n${body}\n@@\n${names.join('\n')}\n`;

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/openings.txt', out, 'utf8');

console.log(
  JSON.stringify({
    sourceRows: rows.length,
    lines: sorted.length,
    names: names.length,
    skippedTooDeep,
    skippedIllegal,
    bytes: Buffer.byteLength(out),
  }),
);

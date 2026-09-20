/**
 * Curate the CC0 Lichess puzzle dump into per-band packs (PRD 8.4, F-PZ-9;
 * design spec sections 2.2 to 2.4).
 *
 * Input:  .cache/lichess-puzzles/lichess_db_puzzle.csv  (gitignored, ~1 GB raw)
 * Output: public/data/puzzles/<band>.txt                 (committed)
 *
 * Each output line is padded to a constant LINE_WIDTH and the file is sorted by
 * rating, which is what lets `src/puzzles/packs.ts` treat the pack as an array
 * of records rather than a document to parse — the technique
 * `public/data/openings.txt` already uses. Record layout, tab separated:
 *
 *   <id>\t<rating>\t<themes joined by |>\t<fen>\t<solution uci, space joined>
 *
 * A puzzle whose record exceeds LINE_WIDTH is DROPPED and counted, never
 * truncated: a truncated FEN is still a parseable FEN, so it would ship as a
 * wrong position that no verifier flags.
 *
 * THE COLUMN ORDER IS READ, NOT ASSUMED. The dump's header has changed between
 * releases. A positional parse against a changed order produces plausible
 * garbage — ratings land in the themes column, parse as an empty theme list,
 * and every puzzle is filtered out, which is indistinguishable from a working
 * filter with a strict threshold. So the header is parsed into a name->index
 * map and a missing column is a hard failure, not a `-1` that silently yields
 * the empty string.
 *
 * Usage: npm run gen:puzzles
 */
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const CACHE = '.cache/lichess-puzzles/lichess_db_puzzle.csv';
const OUT_DIR = 'public/data/puzzles';

/** The eight themes PRD Appendix B assigns to Sections 1 and 2. */
const THEMES = [
  'backRankMate',
  'mateIn1',
  'smotheredMate',
  'mateIn2',
  'attackingF2F7',
  'skewer',
  'fork',
  'discoveredAttack',
];

/** Half-open [min, max). Must match RatingBand in src/puzzles/types.ts. */
const BANDS = [
  { name: '600-900', min: 600, max: 900, target: 2700 },
  { name: '900-1200', min: 900, max: 1200, target: 2700 },
  { name: '1200-1500', min: 1200, max: 1500, target: 2600 },
];

const MIN_PLAYS = 50; // Appendix B's own settled-rating bar
const MAX_DEVIATION = 100; // ditto
const MAX_SOLUTION_PLIES_BELOW_1000 = 4; // design spec 2.3
const LINE_WIDTH = 120; // must match LINE_WIDTH in src/puzzles/packs.ts

/** Columns this script reads. A dump missing any of them is not parseable. */
const REQUIRED = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'NbPlays', 'Themes'];

function bandOf(rating) {
  return BANDS.find((b) => rating >= b.min && rating < b.max) ?? null;
}

/**
 * Take `target` rows spread evenly across a sorted list, rather than its first
 * `target`. Taking the head would fill every band from its bottom edge — a
 * '600-900' pack made entirely of sub-700 puzzles — and selection (design spec
 * 3.2) searches a rating window, so the top of every band would be empty and
 * the widen-and-apologise path would be the normal one.
 */
function spread(rows, target) {
  if (rows.length <= target) return rows;
  if (target <= 1) return rows.slice(0, target);
  const out = [];
  for (let i = 0; i < target; i += 1) {
    out.push(rows[Math.round((i * (rows.length - 1)) / (target - 1))]);
  }
  return out;
}

async function main() {
  /** @type {Map<string, number> | null} */
  let col = null;
  const kept = new Map(BANDS.map((b) => [b.name, []]));
  const dropped = { theme: 0, unsettled: 0, band: 0, tooLong: 0, oversize: 0, malformed: 0 };
  let rows = 0;

  const rl = createInterface({ input: createReadStream(CACHE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (col === null) {
      // Strip a UTF-8 BOM if the dump carries one; otherwise the first column
      // name never matches and every row silently loses its PuzzleId. Stripped
      // by code point, because a literal BOM inside a regex is itself irregular
      // whitespace and the linter rejects it.
      const header = (line.codePointAt(0) === 0xfeff ? line.slice(1) : line).split(',');
      col = new Map(header.map((name, i) => [name, i]));
      const missing = REQUIRED.filter((name) => !col.has(name));
      if (missing.length > 0) {
        console.error(
          `the dump's header does not carry ${missing.join(', ')}.\n` +
            `Header read: ${header.join(',')}\n` +
            'The column layout has changed; fix the mapping rather than the thresholds.',
        );
        process.exit(1);
      }
      continue;
    }
    const cols = line.split(',');
    if (cols.length !== col.size) {
      dropped.malformed += 1;
      continue;
    }
    rows += 1;
    const at = (name) => cols[col.get(name)] ?? '';

    const themes = at('Themes').split(' ').filter((t) => THEMES.includes(t));
    if (themes.length === 0) {
      dropped.theme += 1;
      continue;
    }

    if (Number(at('NbPlays')) < MIN_PLAYS || Number(at('RatingDeviation')) > MAX_DEVIATION) {
      dropped.unsettled += 1;
      continue;
    }

    const rating = Number(at('Rating'));
    const band = bandOf(rating);
    if (!band) {
      dropped.band += 1;
      continue;
    }

    const solution = at('Moves').split(' ').filter(Boolean);
    // Design spec 2.3: "solution length <= 4 plies for bands below 1000". Plies
    // of the whole line, including the opponent's opening move, which is how
    // the dump counts them. A six-ply combination is mis-banded for a beginner
    // whatever its rating says.
    if (band.min < 1000 && solution.length > MAX_SOLUTION_PLIES_BELOW_1000) {
      dropped.tooLong += 1;
      continue;
    }

    const record = [at('PuzzleId'), rating, themes.join('|'), at('FEN'), solution.join(' ')].join('\t');
    // Strictly less than LINE_WIDTH: the record is padded to LINE_WIDTH - 1 and
    // a newline makes up the width, so a record of exactly LINE_WIDTH would
    // ship a line one character too wide.
    if (record.length > LINE_WIDTH - 1) {
      dropped.oversize += 1;
      continue;
    }
    kept.get(band.name).push({ rating, record });
  }

  await mkdir(OUT_DIR, { recursive: true });
  const summary = [];
  for (const band of BANDS) {
    const all = kept.get(band.name).sort((a, b) => a.rating - b.rating);
    const rows = spread(all, band.target);
    const body = rows.map((r) => r.record.padEnd(LINE_WIDTH - 1) + '\n').join('');
    await writeFile(join(OUT_DIR, `${band.name}.txt`), body, 'utf8');
    summary.push({
      band: band.name,
      eligible: all.length,
      puzzles: rows.length,
      minRating: rows[0]?.rating ?? null,
      maxRating: rows[rows.length - 1]?.rating ?? null,
      bytes: body.length,
    });
  }
  console.log(JSON.stringify({ rows, summary, dropped, lineWidth: LINE_WIDTH }, null, 2));

  // A band that came out empty is a filter that is wrong, not a band with no
  // puzzles: 5 million rows cannot yield zero at these thresholds. Do not lower
  // the thresholds to clear this — check the column mapping.
  for (const s of summary) {
    if (s.puzzles === 0) {
      console.error(`band ${s.band} is empty — the filter or the column mapping is wrong`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  if (e.code === 'ENOENT') {
    console.error(
      `missing ${CACHE}\n\nDownload the CC0 puzzle dump once:\n` +
        `  mkdir -p .cache/lichess-puzzles\n` +
        `  curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst -o .cache/lichess-puzzles/puzzles.csv.zst\n` +
        `  zstd -d .cache/lichess-puzzles/puzzles.csv.zst -o ${CACHE}\n`,
    );
    process.exit(1);
  }
  throw e;
});

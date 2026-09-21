// Content verification gate for the shipped puzzle packs (design spec 2.5).
//
// What this script checks, per puzzle:
//   - the FEN is structurally valid and playable;
//   - the record is exactly LINE_WIDTH - 1 characters, so the padding is intact;
//   - the solution has at least two plies and an even number of them: the dump's
//     convention is that solution[0] is the OPPONENT's move and the learner
//     plays solution[1];
//   - every move of the solution is legal in turn from the FEN;
//   - on a mating theme, the line ends in checkmate;
//   - the position after solution[0] is WINNING FOR THE SIDE TO MOVE. This is
//     the check that catches an inverted convention — a FEN shipped with the
//     opponent's move already applied asks the learner to play the wrong colour
//     while every position in the line stays perfectly legal. The comment at
//     the check itself records why the two obvious phrasings of it are vacuous;
//   - after replaying solution[0], Stockfish at depth 14 with MultiPV 2 makes
//     solution[1] the best move by at least a 100 cp margin over the second
//     line — or, where it is a forced mate, the only mating move of that length.
//
//   - `ucinewgame` IS SENT BETWEEN POSITIONS. Non-negotiable, and copied from
//     scripts/verify-content.mjs deliberately. Without it, that verifier was
//     stably wrong across four green runs because an inherited transposition
//     table lifted two positions over the bar, and reversing the file order
//     changed the answer. A verifier that is deterministic is not thereby
//     correct.
//
// What is NOT checked here, deliberately:
//   - whether the puzzle is banded at the right DIFFICULTY. The pack's ratings
//     are the dump's own, settled ratings; design spec 7 says difficulty is
//     validated by the alpha's own data, not by a script.
//   - whether the themes are correct. The dump's tagger is the source of those
//     and there is no second tagger to disagree with it.
//
// Usage:
//   node scripts/verify-puzzles.mjs                 # every shipped pack
//   node scripts/verify-puzzles.mjs a.txt b.txt     # named files only
//   node scripts/verify-puzzles.mjs --reverse       # packs in reverse order
//   node scripts/verify-puzzles.mjs --limit 50      # first N puzzles per pack
//   node scripts/verify-puzzles.mjs --jobs 4        # N engines in parallel
//   node scripts/verify-puzzles.mjs --prune         # REWRITE packs, dropping failures
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { availableParallelism } from 'node:os';
import { Chess, validateFen } from 'chess.js';

const PACK_DIR = 'public/data/puzzles';

const argv = process.argv.slice(2);
const reverse = argv.includes('--reverse');
const limitAt = argv.indexOf('--limit');
const limit = limitAt === -1 ? Infinity : Number(argv[limitAt + 1]);
// Option VALUES are excluded by index, and only when their flag is present:
// a bare `limitAt + 1` is 0 with no --limit, which silently dropped the first
// named pack and ran the whole corpus instead of the one file asked for.
const prune = argv.includes('--prune');
const jobsAt = argv.indexOf('--jobs');
// One engine by default, as scripts/verify-content.mjs uses. Measured: the
// whole 8,000-puzzle pool verifies in about five minutes on one engine, so
// there is nothing to buy here, and a default that sizes itself to the host
// would make a shared or already-loaded machine slower rather than faster.
const jobs = jobsAt === -1 ? 1 : Math.max(1, Math.min(availableParallelism(), Number(argv[jobsAt + 1])));
const valueIndices = new Set([limitAt, jobsAt].filter((i) => i !== -1).map((i) => i + 1));
const named = argv.filter((a, i) => !a.startsWith('--') && !valueIndices.has(i));

// 60s, double scripts/verify-content.mjs's budget. A depth-14 search on a
// full-material middlegame answers in well under a second on an idle machine;
// the larger budget exists so that a loaded CI runner does not turn a slow
// search into a pruned puzzle, which would make the pool depend on the host.
const SEARCH_TIMEOUT_MS = 60_000;
const HANDSHAKE_TIMEOUT_MS = 30_000;
const RESYNC_TIMEOUT_MS = 5_000;
const DEPTH = 14;
const MARGIN_CP = 100;
const LINE_WIDTH = 120; // must match scripts/build-puzzles.mjs and src/puzzles/packs.ts

class EngineTimeout extends Error {
  constructor(ms, elapsed = ms) {
    super(`engine did not answer within ${String(ms)}ms`);
    this.name = 'EngineTimeout';
    this.ms = ms;
    this.elapsed = elapsed;
  }
}

// ---- engine over a child process; the stockfish package does not speak the
// worker_threads message protocol, so drive its stdio instead. Handling copied
// from scripts/verify-content.mjs. ----
function startEngine() {
  const child = spawn('node', ['node_modules/stockfish/bin/stockfish-19-lite-single.js'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const listeners = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    for (const l of [...listeners]) l(String(line));
  });
  const send = (s) => child.stdin.write(`${s}\n`);
  const drop = (l) => {
    const i = listeners.indexOf(l);
    if (i !== -1) listeners.splice(i, 1);
  };
  // Every wait on the engine is bounded. An unbounded wait turns one slow
  // position into a silent hang that names no input.
  const until = (pred, ms) =>
    new Promise((res, rej) => {
      let timer = null;
      const l = (line) => {
        if (!pred(line)) return;
        drop(l);
        if (timer) clearTimeout(timer);
        res(line);
      };
      listeners.push(l);
      if (ms) {
        timer = setTimeout(() => {
          drop(l);
          rej(new EngineTimeout(ms));
        }, ms);
        timer.unref();
      }
    });
  return {
    async init() {
      send('uci');
      await until((l) => l === 'uciok', HANDSHAKE_TIMEOUT_MS);
      send('setoption name MultiPV value 2');
      send('isready');
      await until((l) => l === 'readyok', HANDSHAKE_TIMEOUT_MS);
    },
    async top2(fen, depth = DEPTH, timeoutMs = SEARCH_TIMEOUT_MS) {
      const lines = new Map();
      const l = (line) => {
        const m = line.match(/multipv (\d+) score (cp|mate) (-?\d+) .*? pv (\S+)/);
        if (m) lines.set(Number(m[1]), { kind: m[2], v: Number(m[3]), move: m[4] });
      };
      listeners.push(l);
      const started = Date.now();
      // Start each position from a clean engine. See the long note in
      // scripts/verify-content.mjs: without this, a position's verdict depends
      // on everything analysed before it, and the walk order is arbitrary.
      // `isready` is waited on because `ucinewgame` is not acknowledged and the
      // clear must finish before the next `position`.
      send('ucinewgame');
      send('isready');
      await until((x) => x === 'readyok', RESYNC_TIMEOUT_MS).catch(() => {});
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
      try {
        await until((x) => x.startsWith('bestmove'), timeoutMs);
      } catch (e) {
        if (!(e instanceof EngineTimeout)) throw e;
        // Abandon this search and resynchronise, so the positions after it are
        // analysed by an idle engine rather than inheriting this one's state.
        send('stop');
        await until((x) => x.startsWith('bestmove'), RESYNC_TIMEOUT_MS).catch(() => {});
        send('isready');
        await until((x) => x === 'readyok', RESYNC_TIMEOUT_MS).catch(() => {});
        throw new EngineTimeout(timeoutMs, Date.now() - started);
      } finally {
        drop(l);
      }
      return [lines.get(1), lines.get(2)];
    },
    close() {
      send('quit');
      child.kill();
    },
  };
}

/**
 * Centipawn score, with mate DISTANCE preserved.
 *
 * This diverges from scripts/verify-content.mjs, which collapses every mate to
 * a flat 10000. That is right for a corpus of tactical find-the-move positions
 * and wrong here: five of the eight shipped themes are mating themes, so a
 * mate-in-2 solution whose runner-up is a mate-in-4 would show a margin of
 * exactly zero under flat scoring and be rejected as ambiguous. Preserving the
 * distance makes "the only mating move of that length" the thing the 100 cp bar
 * actually tests, and two mates of the SAME length still score equal and still
 * fail, which is the case the bar exists to catch.
 */
function scoreCp(s) {
  if (s.kind !== 'mate') return s.v;
  const n = Math.abs(s.v);
  return s.v > 0 ? 100_000 - n * 1000 : -100_000 + n * 1000;
}

function parsePack(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line === '') continue;
    const [id, rating, themes, fen, solution] = line.split('\t');
    out.push({
      id,
      rating: Number(rating),
      themes: (themes ?? '').split('|'),
      fen,
      solution: (solution ?? '').split(' ').filter(Boolean),
      width: raw.length,
      // The record as read, so --prune can write the surviving lines back out
      // byte for byte rather than re-serialising them from the parsed fields.
      record: line,
    });
  }
  return out;
}

async function checkPuzzle(engine, p) {
  /** Findings for this one puzzle. Returned, not pushed to a shared array, so
   *  the report stays in pack order however many engines ran in parallel. */
  const out = [];
  const v = validateFen(p.fen ?? '');
  if (!v.ok) return [`bad FEN: ${v.error}`];

  if (p.solution.length < 2) return [`solution has ${p.solution.length} ply, needs >= 2`];
  if (p.solution.length % 2 !== 0) {
    return [`solution has ${p.solution.length} plies, which is odd — solution[0] is the opponent's move, so the count must be even`];
  }

  if (p.width !== LINE_WIDTH - 1) {
    out.push(`record is ${p.width} characters, expected ${LINE_WIDTH - 1}; the padding is wrong`);
  }

  const game = new Chess(p.fen);
  // solution[0] is the opponent's, so the side to move in the shipped FEN is
  // the OPPONENT and the learner is the other colour.

  // Replay the whole line, checking legality move by move.
  let afterOpponent = null;
  for (const [i, uci] of p.solution.entries()) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4) : undefined;
    try {
      game.move(promotion ? { from, to, promotion } : { from, to });
    } catch {
      return [`solution[${i}] ${uci} is not legal`];
    }
    if (i === 0) afterOpponent = game.fen();
  }

  // A mating theme must actually end in mate. This checks the dump's tagging
  // against its own line; it does NOT catch an inverted convention (see below).
  const MATING = ['mateIn1', 'mateIn2', 'backRankMate', 'smotheredMate'];
  const promisesMate = p.themes.some((t) => MATING.includes(t));
  if (promisesMate && !game.isCheckmate()) {
    out.push(`themes ${p.themes.join('|')} promise mate but the line does not end in checkmate`);
  }

  let a, b;
  try {
    [a, b] = await engine.top2(afterOpponent);
  } catch (e) {
    if (!(e instanceof EngineTimeout)) throw e;
    return [`engine timed out after ${String(e.ms)}ms at depth ${DEPTH}; position not verified (FEN ${afterOpponent})`];
  }

  const expected = p.solution[1];
  if (!a) return [`engine returned no line for ${afterOpponent}`];
  if (a.move !== expected) {
    return [`engine best is ${a.move}, solution says ${expected}`];
  }

  // THE CHECK THAT CATCHES AN INVERTED CONVENTION, and a note on the one that
  // does not.
  //
  // The obvious phrasing — "the side to move in the FEN is the side that plays
  // solution[0]" — cannot fail. chess.js only accepts a move for the side to
  // move, so it is true of any line that replayed at all. Nor does "who gets
  // mated": a Lichess solution always has an even number of plies, so the side
  // to move after the full line is always the side to move in the FEN, and the
  // comparison is between a value and itself.
  //
  // What IS asymmetric is the EVALUATION. `a` is scored from the point of view
  // of the side to move after solution[0], and that side is the learner, for
  // whom the position is by construction winning — that is what makes it a
  // puzzle. If the pipeline ever ships a FEN with the opponent's move already
  // applied, solution[1] becomes the opponent's reply to the learner's key
  // move, and it is scored from the losing side's view. So a non-positive score
  // here means the learner is playing the wrong colour, while every position in
  // the line stays perfectly legal.
  if (promisesMate && !(a.kind === 'mate' && a.v > 0)) {
    out.push(`mating theme, but the best line scores ${a.kind} ${a.v} for the learner`);
  } else if (scoreCp(a) <= 0) {
    out.push(
      `the position after solution[0] scores ${scoreCp(a)}cp for the side to move; the learner is not winning it, so the opponent-moves-first convention may be inverted`,
    );
  }

  // No second line means there was only one legal move: unique by definition.
  if (b && scoreCp(a) - scoreCp(b) < MARGIN_CP) {
    out.push(
      `second-best ${b.move} is within ${MARGIN_CP}cp (${scoreCp(a) - scoreCp(b)}cp); not a single-solution puzzle`,
    );
  }
  return out;
}

const files =
  named.length > 0
    ? named
    : readdirSync(PACK_DIR)
        .filter((f) => f.endsWith('.txt'))
        .sort()
        .map((f) => join(PACK_DIR, f));
if (reverse) files.reverse();

/**
 * Engines run in parallel, and that does NOT weaken the `ucinewgame` guarantee.
 * The guarantee is that no position inherits another position's search state;
 * each worker still clears its own engine before every `position`, so every
 * verdict is still the verdict of an idle engine at depth 14. What parallelism
 * costs is wall-clock determinism of the ORDER positions are taken in, and the
 * report is assembled in pack order afterwards precisely so that costs nothing
 * visible.
 *
 * Opt-in via --jobs and off by default; see the note at `jobs` for why one
 * engine is enough here.
 */
const engines = await Promise.all(
  Array.from({ length: jobs }, async () => {
    const e = startEngine();
    await e.init();
    return e;
  }),
);

const started = Date.now();
let checked = 0;
let pruned = 0;
const errors = [];

try {
  for (const f of files) {
    const puzzles = parsePack(readFileSync(f, 'utf8')).slice(0, limit);
    const findings = new Array(puzzles.length);
    let next = 0;
    await Promise.all(
      engines.map(async (engine) => {
        for (;;) {
          const i = next;
          next += 1;
          if (i >= puzzles.length) return;
          findings[i] = await checkPuzzle(engine, puzzles[i]);
        }
      }),
    );
    checked += puzzles.length;

    const keep = [];
    for (const [i, p] of puzzles.entries()) {
      const msgs = findings[i] ?? [];
      if (msgs.length === 0) {
        keep.push(p);
        continue;
      }
      for (const m of msgs) errors.push(`${f} ${p.id}: ${m}`);
    }

    // --prune rewrites the pack without the puzzles that failed. The margin is
    // never relaxed to make a puzzle pass: a puzzle with two answers is removed
    // from the pool, which is the only remedy that keeps "one answer" true of
    // everything that ships.
    if (prune && keep.length !== puzzles.length && limit === Infinity) {
      pruned += puzzles.length - keep.length;
      writeFileSync(f, keep.map((p) => p.record.padEnd(LINE_WIDTH - 1) + '\n').join(''), 'utf8');
    }
  }
} finally {
  // Every engine child process is terminated on every path out of the run.
  for (const e of engines) e.close();
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (prune) {
  console.log(
    JSON.stringify({ pruned, puzzles: checked, remaining: checked - pruned, jobs, seconds: Number(seconds) }),
  );
  process.exit(0);
}
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} puzzle error(s) in ${checked} checked, ${seconds}s`);
  process.exit(1);
}
console.log(
  JSON.stringify({ files, puzzles: checked, depth: DEPTH, marginCp: MARGIN_CP, jobs, seconds: Number(seconds) }),
);

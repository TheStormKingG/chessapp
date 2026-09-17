// Content verification gate for content/section-1.
//
// What this script actually checks:
//   - every lesson/checkpoint file validates against its JSON schema;
//   - challenge ids are unique across the whole corpus;
//   - every FEN is a valid position per chess.js `validateFen`. The three
//     board-vision types (which_square, find_them_all, name_the_pattern) may
//     use a kingless teaching position, so a *missing king* is excused for
//     them — but only after the same board, with the missing king(s) put back,
//     validates cleanly. Every other rejection reason is an error for every
//     type, so a structurally broken board (bad rank length, consecutive
//     digits, pawns on the edge rows) can never ship.
//   - authored solutions, wrong-move keys and hint squares are legal/occupied
//     in the position they belong to;
//   - per-type answer shapes (squares/pieces, option and reason indices, goals);
//   - explain[].text stays under 60 words.
//   - PRD 9.2 engine check, single-solution find_the_move only: Stockfish
//     MultiPV 2 at depth 14 must agree with the authored move, and the
//     second-best must be at least 100cp worse.
//
// What is NOT checked here, deliberately:
//   - motif-tagger agreement (PRD 9.2). Deferred to the full tagger phase,
//     design spec 4.4; no tagger exists in Phase 0.
//   - human review of every position (PRD 9.2). That is a step in the content
//     plan carried out by a person, not something a script can assert.
//   - the Lichess-derived difficulty estimate (PRD 9.2). Not implemented in
//     Phase 0.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import Ajv from 'ajv';
import { Chess, validateFen } from 'chess.js';

const ajv = new Ajv({ allErrors: true });
const lessonSchema = ajv.compile(JSON.parse(readFileSync('content/schema/lesson.schema.json', 'utf8')));
const cpSchema = ajv.compile(JSON.parse(readFileSync('content/schema/checkpoint.schema.json', 'utf8')));

const errors = [];
const fail = (where, msg) => {
  errors.push(`${where}: ${msg}`);
};

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.json')) out.push(p);
  }
  return out;
}

// PRD 9.2's depth-14 search answers in a second or two; the whole 149-challenge
// run takes well under two minutes. 30s therefore means the position is
// pathological, not merely slow.
const SEARCH_TIMEOUT_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 30_000;
const RESYNC_TIMEOUT_MS = 5_000;

class EngineTimeout extends Error {
  constructor(ms, elapsed = ms) {
    super(`engine did not answer within ${String(ms)}ms`);
    this.name = 'EngineTimeout';
    this.ms = ms;
    this.elapsed = elapsed;
  }
}

// ---- engine over a child process; the stockfish package does not speak the
// worker_threads message protocol, so drive its stdio instead. ----
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
  // position into a silent hang that names no input; a bounded one degrades to
  // an error reported against the challenge that was being analysed.
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
    async top2(fen, depth = 14, timeoutMs = SEARCH_TIMEOUT_MS) {
      const lines = new Map();
      const l = (line) => {
        const m = line.match(/multipv (\d+) score (cp|mate) (-?\d+) .*? pv (\S+)/);
        if (m) lines.set(Number(m[1]), { kind: m[2], v: Number(m[3]), move: m[4] });
      };
      listeners.push(l);
      const started = Date.now();
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
        // Report the search budget, not the wall clock: the resync wait that
        // follows the timeout is not time the position was given to answer.
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

function scoreCp(s) {
  return s.kind === 'mate' ? (s.v > 0 ? 10000 : -10000) : s.v;
}

// Board-vision challenge types may use a teaching position with no kings on it
// (the empty board of lesson 1.1.1, say). That is the ONLY relaxation they get:
// the board must still be structurally sound, so the exemption is keyed to the
// rejection *reason*, never to the fact that chess.js rejected the FEN.
const BOARDLESS = new Set(['which_square', 'find_them_all', 'name_the_pattern']);
const MISSING_KING = /missing (white|black) king/;

/** Expand a FEN rank ("4p3") into 8 characters, '.' for empty. */
function expandRank(rank) {
  let out = '';
  for (const ch of rank) out += /[1-8]/.test(ch) ? '.'.repeat(Number(ch)) : ch;
  return out;
}

/**
 * Validate `fen`, allowing a missing king only when `allowKingless`. A kingless
 * board is accepted only if putting the missing king(s) back on empty squares
 * yields a FEN chess.js accepts — so every other defect (rank lengths,
 * consecutive digits, pawns on the edge rows) is still reported.
 * Returns null when the FEN is acceptable, else the reason to report.
 */
function fenProblem(fen, allowKingless) {
  const first = validateFen(fen);
  if (first.ok) return null;
  if (!allowKingless || !MISSING_KING.test(first.error)) return first.error;

  const [placement, ...rest] = fen.split(' ');
  const ranks = placement.split('/').map(expandRank);
  const board = ranks.map((r) => r.split(''));
  for (const king of ['K', 'k']) {
    if (board.some((r) => r.includes(king))) continue;
    const rank = board.findIndex((r) => r.includes('.'));
    if (rank === -1) return `${first.error} (and no empty square to place it on)`;
    board[rank][board[rank].indexOf('.')] = king;
  }
  const repaired = [
    board.map((r) => r.join('').replace(/\.+/g, (m) => String(m.length))).join('/'),
    ...rest,
  ].join(' ');
  const second = validateFen(repaired);
  return second.ok ? null : second.error;
}

function tryMove(game, san) {
  try {
    return !!game.move(san);
  } catch {
    return false;
  }
}

const engine = startEngine();
await engine.init();

async function checkChallenge(where, c) {
  const problem = fenProblem(c.fen, BOARDLESS.has(c.type));
  if (problem !== null) return fail(where, `bad FEN: ${problem}`);
  let chess = null;
  try {
    chess = new Chess(c.fen);
  } catch {
    chess = null; // accepted kingless teaching board: no playable position
  }
  const legal = chess ? chess.moves({ verbose: true }) : [];
  const ok = (san) => legal.some((m) => m.san === san);
  switch (c.type) {
    case 'find_the_move': {
      for (const s of c.answer.moves) if (!ok(s)) fail(where, `solution ${s} is not legal`);
      for (const w of Object.keys(c.wrong ?? {})) if (!ok(w)) fail(where, `wrong-move key ${w} is not legal`);
      if (c.answer.moves.length === 1 && legal.length > 1) {
        let a, b;
        try {
          [a, b] = await engine.top2(c.fen);
        } catch (e) {
          if (!(e instanceof EngineTimeout)) throw e;
          // A hang becomes a report naming the position it was stuck on.
          fail(
            where,
            `engine timed out after ${String(e.ms)}ms at depth 14; position not verified (FEN ${c.fen})`,
          );
          break;
        }
        const best = legal.find((m) => m.from + m.to + (m.promotion ?? '') === a?.move);
        if (!best || best.san !== c.answer.moves[0]) {
          fail(where, `engine best is ${best?.san ?? a?.move}, solution says ${c.answer.moves[0]}`);
        } else if (b && scoreCp(a) - scoreCp(b) < 100) {
          fail(where, `second-best ${b.move} is within 100cp; not a single-solution challenge`);
        }
      }
      break;
    }
    case 'find_the_sequence': {
      const g = new Chess(c.fen);
      for (const s of c.answer.line) {
        if (!tryMove(g, s)) {
          fail(where, `line move ${s} illegal`);
          break;
        }
      }
      break;
    }
    case 'find_them_all': {
      // Design spec 4.7 / PRD 7.4: the answer marks every square OR every piece
      // that fits; pieces are named by the square they stand on.
      const key = Array.isArray(c.answer?.squares)
        ? 'squares'
        : Array.isArray(c.answer?.pieces)
          ? 'pieces'
          : null;
      if (key === null || c.answer[key].length === 0) {
        fail(where, 'find_them_all needs a non-empty squares[] or pieces[]');
      } else {
        for (const s of c.answer[key]) if (!/^[a-h][1-8]$/.test(s)) fail(where, `bad square ${s}`);
      }
      break;
    }
    case 'is_it_safe': {
      if (!ok(c.move)) fail(where, `is_it_safe move ${c.move} is not legal`);
      if (!(c.reasons?.length === 3) || c.answer.reason < 0 || c.answer.reason > 2) {
        fail(where, 'is_it_safe needs 3 reasons and a valid index');
      }
      break;
    }
    case 'which_square':
      if (!/^[a-h][1-8]$/.test(c.answer?.square ?? '')) fail(where, 'which_square needs a square');
      break;
    case 'name_the_pattern':
      if (!(c.options?.length === 3) || c.answer.option < 0 || c.answer.option > 2) {
        fail(where, 'name_the_pattern needs 3 options');
      }
      break;
    case 'play_it_out':
      if (!c.goal?.kind || !(c.goal.moves > 0)) fail(where, 'play_it_out needs a goal with moves');
      break;
    case 'guess_the_move': {
      const g = new Chess(c.fen);
      for (const s of c.answer.moves) {
        if (!tryMove(g, s)) {
          fail(where, `guess move ${s} illegal`);
          break;
        }
      }
      break;
    }
    default:
      fail(where, `unknown type ${c.type}`);
  }
  if (c.hints?.piece && !(chess && chess.get(c.hints.piece))) {
    fail(where, `hint piece square ${c.hints.piece} is empty`);
  }
}

const files = walk('content/section-1');
const seenIds = new Set();
try {
  for (const f of files) {
    const doc = JSON.parse(readFileSync(f, 'utf8'));
    const isCp = f.endsWith('checkpoint.json');
    const valid = isCp ? cpSchema(doc) : lessonSchema(doc);
    if (!valid) {
      fail(f, ajv.errorsText(isCp ? cpSchema.errors : lessonSchema.errors));
      continue;
    }
    const challenges = isCp ? doc.bank : doc.challenges;
    for (const c of challenges) {
      if (seenIds.has(c.id)) fail(f, `duplicate challenge id ${c.id}`);
      seenIds.add(c.id);
      await checkChallenge(`${f} ${c.id}`, c);
    }
    if (!isCp) {
      for (const [i, e] of doc.explain.entries()) {
        if (e.text.split(/\s+/).length > 60) fail(f, `explain[${i}] over 60 words`);
      }
    }
  }
} finally {
  // The engine child process is terminated on every path out of the run,
  // including the timeout path that aborted a search.
  engine.close();
}
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} content error(s)`);
  process.exit(1);
}
console.log(`verify-content: ${files.length} files, ${seenIds.size} challenges OK`);

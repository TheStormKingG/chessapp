// Verifies every lesson and checkpoint file in content/ against the JSON schemas
// and against the rules engine (chess.js) plus Stockfish. PRD 9.2.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import Ajv from 'ajv';
import { Chess } from 'chess.js';

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
  const until = (pred) =>
    new Promise((res) => {
      const l = (line) => {
        if (pred(line)) {
          listeners.splice(listeners.indexOf(l), 1);
          res(line);
        }
      };
      listeners.push(l);
    });
  return {
    async init() {
      send('uci');
      await until((l) => l === 'uciok');
      send('setoption name MultiPV value 2');
      send('isready');
      await until((l) => l === 'readyok');
    },
    async top2(fen, depth = 14) {
      const lines = new Map();
      const l = (line) => {
        const m = line.match(/multipv (\d+) score (cp|mate) (-?\d+) .*? pv (\S+)/);
        if (m) lines.set(Number(m[1]), { kind: m[2], v: Number(m[3]), move: m[4] });
      };
      listeners.push(l);
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
      await until((x) => x.startsWith('bestmove'));
      listeners.splice(listeners.indexOf(l), 1);
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

// Board-free challenge types may use a teaching position (an empty board, say)
// that is not a legal game position. Every other type needs a playable FEN.
const BOARDLESS = new Set(['which_square', 'find_them_all', 'name_the_pattern']);

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
  let chess = null;
  try {
    chess = new Chess(c.fen);
  } catch (e) {
    if (!BOARDLESS.has(c.type)) return fail(where, `bad FEN: ${e.message}`);
    if (!/^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+ [wb] /.test(c.fen)) {
      return fail(where, `bad FEN: ${e.message}`);
    }
  }
  const legal = chess ? chess.moves({ verbose: true }) : [];
  const ok = (san) => legal.some((m) => m.san === san);
  switch (c.type) {
    case 'find_the_move': {
      for (const s of c.answer.moves) if (!ok(s)) fail(where, `solution ${s} is not legal`);
      for (const w of Object.keys(c.wrong ?? {})) if (!ok(w)) fail(where, `wrong-move key ${w} is not legal`);
      if (c.answer.moves.length === 1 && legal.length > 1) {
        const [a, b] = await engine.top2(c.fen);
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
      if (!Array.isArray(c.answer?.squares) || c.answer.squares.length === 0) {
        fail(where, 'find_them_all needs squares');
      } else {
        for (const s of c.answer.squares) if (!/^[a-h][1-8]$/.test(s)) fail(where, `bad square ${s}`);
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
engine.close();
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} content error(s)`);
  process.exit(1);
}
console.log(`verify-content: ${files.length} files, ${seenIds.size} challenges OK`);

// Content verification gate for the authored content sections (see SECTIONS below).
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

/**
 * A fault in the MEASURING APPARATUS, not in the content.
 *
 * Kept in its own list and reported under its own heading, because the two
 * demand opposite responses: a content error means change the challenge, an
 * instrument fault means change nothing and re-run on an idle machine. Folding
 * them together is how a busy afternoon gets a correct position rewritten.
 */
const faults = [];
const instrumentFault = (where, msg) => {
  faults.push(`${where}: ${msg}`);
};

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.json')) out.push(p);
  }
  return out;
}

// PRD 9.2's depth-14 search answers in a second or two; the whole 400-challenge
// corpus (168 of them engine-checked) runs in about 15 seconds. 30s therefore
// means the position is pathological, not merely slow.
const SEARCH_TIMEOUT_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 30_000;
const RESYNC_TIMEOUT_MS = 5_000;

/**
 * Stockfish REFUSED the position, rather than being slow on it.
 *
 * Distinguished from a timeout because the two demand opposite responses and
 * the gate could not previously tell them apart. `top2` waited for `bestmove`
 * and nothing else, so a refusal -- which never produces a `bestmove` --
 * expired the same wait as a slow search and was reported as machine load.
 * The comment at the call site then says, correctly, that a timeout is not a
 * finding about the content and must not provoke re-authoring. Applied to a
 * refusal that advice is exactly backwards: the engine is reporting a broken
 * position and the gate translates it into "your machine is busy".
 *
 * The refusal this actually catches is `King can be captured`, which is
 * Stockfish's answer to a position where the side not to move is in check --
 * the same unreachable position `sideNotToMoveInCheck` now rejects up front.
 * The two are deliberately redundant: the structural check is the one that
 * reports well, and this one stops the engine lying about why it said nothing
 * if that check is ever weakened or bypassed.
 *
 * Found by unit 3.4's author, who lost real time to a "timeout" that
 * reproduced on an idle machine, which is the tell: a load fault does not
 * reproduce on a specific position.
 */
class EngineRefusal extends Error {
  constructor(fen, line) {
    super(`engine refused the position: ${line}`);
    this.name = 'EngineRefusal';
    this.fen = fen;
    this.line = line;
  }
}

/** Lines on which Stockfish rejects the position outright instead of searching. */
const ENGINE_REFUSAL = /king can be captured|CRITICAL ERROR/i;

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
      // Start each position from a clean engine.
      //
      // Without this the whole corpus was analysed by ONE search state: the
      // transposition table, the history and killer heuristics and the
      // evaluation cache all carried from one challenge into the next. A
      // position's verdict therefore depended on everything analysed before it,
      // and the walk order is just `readdirSync` order -- so adding a unit, or
      // editing one position, silently re-decided unrelated ones.
      //
      // That is not a theory. Measured on this corpus:
      //   - forward order, stateful: green, and stably green over four runs
      //     (it is deterministic, which is exactly why it looked trustworthy);
      //   - REVERSED order, same files, same engine, same depth: 1.6-k13 fails;
      //   - with this `ucinewgame`, forward and reversed agree exactly.
      // And after two genuinely-marginal positions were fixed, the stateful
      // script began failing 1.4.1-c7 -- a challenge nobody had touched, whose
      // only change was the history that reached it.
      //
      // Stable is not the same as correct. The stateful run was hiding false
      // negatives too: a clean engine at depth 14 rates 1.2.3-c2's margin at
      // 99cp against the 100cp bar, and the inherited table was lifting it over.
      //
      // Cost: about +1.1s on a ~14s run (+8%), for 168 engine-checked
      // positions. `isready` is waited on because `ucinewgame` is not
      // acknowledged and the clear must finish before the next `position`.
      send('ucinewgame');
      send('isready');
      await until((x) => x === 'readyok', RESYNC_TIMEOUT_MS).catch(() => {});
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
      try {
        // Watch for the refusal as well as the answer. Waiting only for
        // `bestmove` is what made a rejected position indistinguishable from a
        // slow one.
        const settled = await until(
          (x) => x.startsWith('bestmove') || ENGINE_REFUSAL.test(x),
          timeoutMs,
        );
        if (ENGINE_REFUSAL.test(settled)) throw new EngineRefusal(fen, settled.trim());
      } catch (e) {
        if (e instanceof EngineRefusal) {
          // Resynchronise before rethrowing, so the positions after this one
          // are analysed by an idle engine rather than inheriting this state.
          send('isready');
          await until((x) => x === 'readyok', RESYNC_TIMEOUT_MS).catch(() => {});
          throw e;
        }
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

/**
 * Is the side that is NOT to move standing in check?
 *
 * `validateFen` says "well-formed", never "reachable", so it returns ok for a
 * position no game could produce: one where the player who just moved left
 * their own king attacked. Found by unit 3.6's author, who built two such
 * boards by accident and caught them only with a check of their own -- the
 * gate said nothing, and would have shipped a position the learner is asked to
 * reason about as if it could occur.
 *
 * The test flips the side to move and asks chess.js whether that side is in
 * check. Castling rights are irrelevant to the question and the en passant
 * square is cleared, since it describes the move that has just been made and
 * cannot survive the flip -- leaving it in makes chess.js reject the string
 * and turns a real finding into a silent `false`.
 */
function sideNotToMoveInCheck(fen) {
  const parts = fen.split(' ');
  if (parts.length < 2) return false;
  const flipped = [parts[0], parts[1] === 'w' ? 'b' : 'w', parts[2] ?? '-', '-', '0', '1'].join(' ');
  try {
    return new Chess(flipped).inCheck();
  } catch {
    // Not constructible flipped: this check has nothing to say, and the
    // checks around it have already spoken about the position as given.
    return false;
  }
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
  // Only for a real playable board. A kingless teaching position has no side
  // to be in check, and `chess` is null for exactly those.
  if (chess && sideNotToMoveInCheck(c.fen)) {
    // Returns, like the `bad FEN` check above it: everything after this reasons
    // about a position that cannot occur, so its findings would be noise. The
    // engine would ALSO reject this one (see EngineRefusal) -- the redundancy
    // is deliberate, but only one of the two should speak at a time, and the
    // structural check is the one that names the problem in the author's terms.
    return fail(where, 'bad FEN: the side not to move is in check, so the position is unreachable');
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
          if (e instanceof EngineRefusal) {
            // A refusal IS a finding about the content, and the opposite of a
            // timeout: the engine looked at the position and rejected it.
            fail(where, `${e.message} (FEN ${c.fen})`);
            break;
          }
          if (!(e instanceof EngineTimeout)) throw e;
          // A timeout is NOT a finding about the content. The limit is
          // wall-clock, so a busy machine turns a green corpus red on a
          // position nobody touched — observed on 2.1.1-c6 while three other
          // worktrees were building, on a run that took 2:21 against 1:11
          // clean. Reported as a content failure it is indistinguishable from
          // a real one, and the natural response (re-author the position, or
          // drop it) damages content that was never wrong. A sibling verifier
          // once deleted three good puzzles exactly this way.
          //
          // So: retry once with the engine reset and a doubled budget, and
          // only if THAT also times out report it — as an instrument fault,
          // counted separately, never as a solution defect.
          // No explicit reset needed: top2 sends `ucinewgame` + `isready`
          // before every search, so the retry already starts from a clean
          // hash table.
          try {
            [a, b] = await engine.top2(c.fen, 14, SEARCH_TIMEOUT_MS * 2);
          } catch (e2) {
            if (e2 instanceof EngineRefusal) {
              fail(where, `${e2.message} (FEN ${c.fen})`);
              break;
            }
            if (!(e2 instanceof EngineTimeout)) throw e2;
            instrumentFault(
              where,
              `engine timed out twice (${String(e.ms)}ms, then ${String(e2.ms)}ms) at depth 14. ` +
                `This is a machine-load fault, not a content defect: the position was never ` +
                `verified either way. Re-run on an idle machine before changing anything ` +
                `(FEN ${c.fen})`,
            );
            break;
          }
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
      // A fresh position per move. The original reused one board and played the
      // moves onto it in turn, so a second answer move was reported "illegal"
      // when it was merely White's move played on Black's turn -- a true
      // statement about the wrong position, next to the real finding. These are
      // ALTERNATIVE answers, not a line; `find_the_sequence` is the type that
      // walks a board forward.
      for (const s of c.answer.moves) {
        if (!tryMove(new Chess(c.fen), s)) fail(where, `guess move ${s} illegal`);
      }
      /*
       * The two checks that make this type different from `find_the_move`,
       * which is what it silently was until the commentary got a renderer.
       *
       * ONE move, not a list. `find_the_move` accepts alternatives because
       * several moves can be equally best. A story game is replaying a game
       * somebody actually played, and the commentary is about the move they
       * played -- so accepting a second move means the learner can be told
       * "correct" and then read a paragraph about a different move. The schema
       * cannot express this (it is the same `answer.moves` shape), so it is
       * caught here.
       */
      if (c.answer.moves.length !== 1) {
        fail(where, `guess_the_move takes exactly one move, got ${c.answer.moves.length}`);
      }
      // The schema requires a non-empty string; whitespace satisfies that and
      // renders as nothing at all, which is the state this whole type was in.
      if (!String(c.commentary ?? '').trim()) {
        fail(where, 'guess_the_move needs commentary -- it is the point of the type');
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

// Every authored section, DISCOVERED rather than listed.
//
// This was hardcoded to `content/section-1` once, so a new section was never
// examined and the run still printed OK. The fix then was to list sections
// explicitly, "so that adding one is a deliberate edit" -- and that is exactly
// what failed the second time: unit 3.1 was authored, the gate reported
// "79 files, 934 challenges OK", and it had not opened one of the new files.
//
// An explicit list silently NARROWS as content grows, and its failure mode is
// a confident pass over content nobody checked. Discovery over-includes
// instead, and over-inclusion is loud: a stray directory makes the gate fail
// and somebody looks. Prefer the construction whose mistakes announce
// themselves.
//
// The count guard below is the other half. A discovery that finds nothing
// would sail through every loop after it and print a clean run, which is the
// same silent pass by another route.
const SECTIONS = readdirSync('content')
  .filter((d) => /^section-\d+$/.test(d))
  .sort()
  .map((d) => `content/${d}`);
if (SECTIONS.length === 0) {
  console.error('verify-content: no content/section-* directories found -- the gate cannot run');
  process.exit(1);
}
const files = SECTIONS.flatMap((d) => walk(d));
if (files.length === 0) {
  console.error(`verify-content: ${SECTIONS.join(', ')} contain no files -- the gate cannot run`);
  process.exit(1);
}
const seenIds = new Set();
/**
 * Where the correct answer sat, per `is_it_safe` item, across the whole corpus.
 *
 * Collected here and judged after the walk, because this is a defect that does
 * not exist in any single item -- every one of the 176 was individually
 * correct, and every per-item check passed on all of them.
 */
const answerSlots = [];
/** The two challenge types whose answer is an index into a list of choices. */
const INDEXED_ANSWER = [
  { type: 'is_it_safe', list: 'reasons', index: 'reason' },
  { type: 'name_the_pattern', list: 'options', index: 'option' },
];
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
      for (const k of INDEXED_ANSWER) {
        if (c.type !== k.type || !Array.isArray(c[k.list])) continue;
        answerSlots.push({ type: k.type, slot: c.answer?.[k.index], of: c[k.list].length });
      }
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
/*
 * ─── A corpus-level check, because the defect is corpus-level ───────────────
 *
 * Two challenge types answer with an INDEX into a list of choices, and for
 * both of them the corpus had settled into a pattern a learner could play.
 *
 *   is_it_safe        97 / 79 / 0      -- never the third reason, in 176 items
 *   name_the_pattern  284 / 25 / 17    -- 87% the FIRST option, in 326 items
 *
 * In seventeen of twenty-five units, every single `name_the_pattern` answer was
 * option one. Tap the top choice and be right nearly nine times in ten.
 *
 * Every one of those items was written on its own, was correct on its own, and
 * passed every per-item check in this file. That is the whole difficulty: there
 * is no defect in any single item, and a hole in five hundred of them at once.
 * Nothing per-item can see it, so the unit of analysis has to be the corpus and
 * the check has to live after the walk rather than inside it.
 *
 * The bar is deliberately low. This does not ask for a uniform distribution --
 * real content clusters, and demanding balance would make authors shuffle
 * answers to satisfy a number rather than to teach. It asks only that no choice
 * is ABANDONED, which is the part a learner can exploit. Below `MIN_SAMPLE`
 * items it says nothing, since a small corpus can skew honestly.
 *
 * Found twice, independently, by the authors of units 3.10 and 3.8 while
 * measuring the corpus for other reasons -- which is itself the lesson about
 * how a defect of this shape surfaces.
 */
{
  const MIN_SAMPLE = 30;
  const MIN_SHARE = 0.1;
  const groups = new Map();
  for (const { type, slot, of } of answerSlots) {
    if (!Number.isInteger(slot) || !Number.isInteger(of) || of < 2) continue;
    const key = `${type}:${String(of)}`;
    if (!groups.has(key)) groups.set(key, { type, of, slots: [] });
    groups.get(key).slots.push(slot);
  }
  for (const { type, of, slots } of groups.values()) {
    if (slots.length < MIN_SAMPLE) continue;
    const counts = Array.from({ length: of }, (_, i) => slots.filter((s) => s === i).length);
    const floor = Math.max(1, Math.floor(slots.length * MIN_SHARE));
    const starved = counts.flatMap((n, i) => (n < floor ? [`choice ${String(i)} (${String(n)})`] : []));
    if (starved.length) {
      errors.push(
        `${type} answers are predictable across the corpus: of ${String(slots.length)} items with ` +
          `${String(of)} choices, the correct one lands at [${counts.join(', ')}]. ` +
          `Starved: ${starved.join(', ')} -- under the ${String(floor)}-item floor. ` +
          `A learner who notices can discard those choices unread. This is not a defect in ` +
          `any single item; rotate which choice is correct across the corpus.`,
      );
    }
  }
}

if (faults.length) {
  console.error('INSTRUMENT FAULTS — the apparatus, not the content:');
  console.error(faults.join('\n'));
  console.error(
    `\n${faults.length} position(s) were never verified either way. ` +
      `Do NOT change them on the strength of this run.`,
  );
}
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} content error(s)`);
  process.exit(1);
}
if (faults.length) {
  // Non-zero, so a run with unverified positions can never be read as a pass —
  // but a distinct code, so a caller can tell "your content is wrong" from
  // "my measurement did not complete".
  process.exit(2);
}
console.log(`verify-content: ${files.length} files, ${seenIds.size} challenges OK`);

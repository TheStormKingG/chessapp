// Prints find_them_all challenge objects whose answer squares are computed by
// the same rules engine the app uses, so movement answers are never hand-typed.
//
// Usage:
//   node scripts/gen-movement-challenges.mjs rook "8/8/8/3R4/8/8/8/8 w - - 0 1:d5" ...
//
// Each argument after the piece name is "<fen>:<square>". The piece standing on
// <square> is the one whose reachable squares are computed; the FEN's side to
// move is overridden to that piece's colour so a black piece can be asked about
// in a white-to-move position. A kingless teaching board is accepted, but only
// when the answer is the same under EVERY legal placement of the kings chess.js
// needs to load the position -- a parked king silently blocks squares as well as
// occupying them, so one parking proves nothing.
import { pathToFileURL } from 'node:url';
import { Chess } from 'chess.js';

const NAMES = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/** Expand a FEN rank ("4p3") into 8 characters, '.' for empty. */
function expandRank(rank) {
  let out = '';
  for (const ch of rank) out += /[1-8]/.test(ch) ? '.'.repeat(Number(ch)) : ch;
  return out;
}

/** All 64 square names, a1 first. */
const ALL_SQUARES = [];
for (let r = 1; r <= 8; r++) for (const f of 'abcdefgh') ALL_SQUARES.push(`${f}${r}`);

function adjacent(a, b) {
  return (
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 1 && Math.abs(Number(a[1]) - Number(b[1])) <= 1
  );
}

function boardOf(fen) {
  return fen
    .split(' ')[0]
    .split('/')
    .map((r) => expandRank(r).split(''));
}

function pieceOn(board, square) {
  const f = 'abcdefgh'.indexOf(square[0]);
  const r = 8 - Number(square[1]);
  const c = board[r]?.[f];
  return c === '.' ? null : (c ?? null);
}

/** Rebuild a FEN from `board`, with `turn` to move and `fen`'s remaining fields. */
function toFen(board, fen, turn) {
  const [, , ...rest] = fen.split(' ');
  return [
    board.map((r) => r.join('').replace(/\.+/g, (m) => String(m.length))).join('/'),
    turn,
    ...rest,
  ].join(' ');
}

function place(board, square, piece) {
  const copy = board.map((r) => [...r]);
  copy[8 - Number(square[1])]['abcdefgh'.indexOf(square[0])] = piece;
  return copy;
}

/**
 * Move sets for a kingless teaching board are only meaningful if the kings we
 * must add to load the position do not change them -- a parked king both
 * BLOCKS a square and can be captured on it, and the first of those is
 * invisible in the result. So compute the set under several different parkings
 * and refuse to print anything unless they all agree.
 */
function movesUnderParkings(fen, square, turn) {
  const base = boardOf(fen);
  const needs = ['K', 'k'].filter((k) => !base.some((r) => r.includes(k)));
  const empty = ALL_SQUARES.filter((s) => pieceOn(base, s) === null && s !== square);
  const placements = [];
  if (needs.length === 0) placements.push({ board: base, added: [] });
  else if (needs.length === 1) {
    for (const s of empty) placements.push({ board: place(base, s, needs[0]), added: [s] });
  } else {
    for (const a of empty)
      for (const b of empty) {
        if (a === b || adjacent(a, b)) continue;
        placements.push({ board: place(place(base, a, needs[0]), b, needs[1]), added: [a, b] });
      }
  }
  const seen = new Map();
  for (const p of placements) {
    let game;
    try {
      game = new Chess(toFen(p.board, fen, turn));
    } catch {
      continue; // an illegal parking (side not to move in check, say): skip it
    }
    const key = [...new Set(game.moves({ square, verbose: true }).map((m) => m.to))]
      .sort()
      .join(',');
    if (!seen.has(key)) seen.set(key, p.added);
    if (seen.size > 1) {
      const [[k1, a1], [k2, a2]] = [...seen];
      throw new Error(
        `the kings this teaching board lacks change the answer: kings on ${a1.join('+') || 'none'} ` +
          `give [${k1}], kings on ${a2.join('+') || 'none'} give [${k2}] -- put real kings in the FEN`,
      );
    }
  }
  if (seen.size === 0) throw new Error('no legal way to complete this position');
  return [...seen.keys()][0].split(',').filter(Boolean);
}

/** Squares the piece on `square` can move to in `fen`, computed by chess.js. */
export function reachableSquares(fen, square) {
  const board = boardOf(fen);
  const piece = pieceOn(board, square);
  if (piece === null) throw new Error(`no piece on ${square}`);
  const colour = piece === piece.toUpperCase() ? 'w' : 'b';
  return { squares: movesUnderParkings(fen, square, colour), piece: NAMES[piece.toLowerCase()] };
}

function main(argv) {
  const [pieceName, ...specs] = argv;
  if (!pieceName || specs.length === 0) {
    console.error(
      'usage: node scripts/gen-movement-challenges.mjs <piece> "<fen>:<square>" ["<fen>:<square>" ...]',
    );
    process.exit(2);
  }
  const out = specs.map((spec, i) => {
    const cut = spec.lastIndexOf(':');
    const fen = spec.slice(0, cut);
    const square = spec.slice(cut + 1);
    const { squares, piece } = reachableSquares(fen, square);
    if (piece !== pieceName) {
      console.error(`warning: ${square} holds a ${piece}, not a ${pieceName}`);
    }
    return {
      id: `TODO-c${i + 1}`,
      type: 'find_them_all',
      fen,
      prompt: `Tap every square the ${piece} can move to.`,
      concept: `${piece}-moves`,
      hints: { piece: square },
      answer: { squares },
    };
  });
  console.log(JSON.stringify(out, null, 2));
}

// pathToFileURL, not a template literal: the repo path contains spaces, which a
// raw `file://${argv[1]}` leaves unescaped and import.meta.url does not.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));

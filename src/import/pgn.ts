/**
 * PGN reading for F-IM-1's "pasting or uploading a PGN file".
 *
 * This file is pure string work and deliberately knows no chess. It does not
 * import chess.js — `src/rules/rules.ts` is the only module in the app allowed
 * to, and the rules layer is reached later, through `positionsOf`, to prove the
 * move list actually replays (see ./validate.ts). Splitting it this way means a
 * paste can be read, counted and shown to the learner with no engine, no board
 * and no network.
 *
 * Nothing here throws. A paste that is not a PGN yields no games, and a game
 * whose movetext contains a token this file cannot classify reports that token
 * in `unparsed` rather than dropping it silently — see the note on `unparsed`.
 */

/** One game's tag pairs and movetext, parsed but not validated as chess. */
export interface ParsedGame {
  /** Tag pairs exactly as spelled in the file. Use `tagValue` to read one. */
  tags: Record<string, string>;
  /** The mainline moves, in order, annotation marks stripped and `+`/`#` kept. */
  sans: string[];
  /** `1-0`, `0-1`, `1/2-1/2` or `*`, whichever closed the movetext. */
  termination: string | null;
  /**
   * Mainline tokens that were neither a move number, a game-termination marker,
   * a recognised null move, nor SAN-shaped.
   *
   * This exists because the dangerous failure of a move tokeniser is not
   * rejecting a paste — it is accepting one and being one move short. A dropped
   * move leaves a shorter game that still replays legally, so every downstream
   * check passes and the review is of a game the learner did not play. A caller
   * that cares (./validate.ts does) refuses a game with anything in here.
   */
  unparsed: string[];
  /** The game's own slice of the input, so the archival PGN is never reassembled. */
  raw: string;
}

const TERMINATIONS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

/** Tokens both sites and several editors emit for "no move was made here". */
const NULL_MOVES = new Set(['--', 'Z0', '@@@@', '0000']);

const TAG_LINE = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/;

/**
 * Standard SAN, permissively: an optional piece letter, an optional
 * disambiguating file and/or rank, an optional capture, the destination, an
 * optional promotion and an optional check or mate mark. Castling is separate
 * because it contains no destination square.
 */
const SAN_SHAPE = /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O-O|O-O|0-0-0|0-0)[+#]?$/;

/** Reads a tag by name, case-insensitively. `null` when the tag is absent. */
export function tagValue(game: ParsedGame, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(game.tags)) {
    if (k.toLowerCase() === wanted) return v;
  }
  return null;
}

/**
 * Splits a paste into games and reads each one.
 *
 * A game begins at its first tag pair, or at its first move when there are no
 * tags at all. Blank lines are NOT the separator: a paste that has been through
 * a textarea, an email client or a spreadsheet cell may have lost them, and
 * losing every game after the first would look exactly like a learner who
 * pasted one game.
 */
export function parsePgn(text: string): ParsedGame[] {
  const games: ParsedGame[] = [];
  let tagLines: string[] = [];
  let moveLines: string[] = [];
  let sawMoves = false;

  const flush = () => {
    if (tagLines.length === 0 && moveLines.length === 0) return;
    const tags: Record<string, string> = {};
    for (const line of tagLines) {
      const m = TAG_LINE.exec(line);
      const key = m?.[1];
      const value = m?.[2];
      if (key === undefined || value === undefined) continue;
      tags[key] = value.replace(/\\(.)/g, '$1');
    }
    const { sans, termination, unparsed } = tokenise(moveLines.join('\n'));
    // A tag block with no moves is a real thing both sites return (an aborted
    // game). It is not reviewable — src/review/gameSource.ts refuses a game with
    // no moves — so it is not offered as one.
    if (sans.length > 0) {
      games.push({
        tags,
        sans,
        termination,
        unparsed,
        raw: [...tagLines, '', ...moveLines].join('\n').trim(),
      });
    }
    tagLines = [];
    moveLines = [];
    sawMoves = false;
  };

  for (const line of text.split(/\r\n|\r|\n/)) {
    // "%" at column 0 is a PGN escape: the line is not data, at all.
    if (line.startsWith('%')) continue;
    if (TAG_LINE.test(line)) {
      // A tag pair after movetext is the next game starting.
      if (sawMoves) flush();
      tagLines.push(line);
      continue;
    }
    if (line.trim() === '') {
      if (moveLines.length > 0) moveLines.push('');
      continue;
    }
    moveLines.push(line);
    sawMoves = true;
  }
  flush();
  return games;
}

interface Tokenised {
  sans: string[];
  termination: string | null;
  unparsed: string[];
}

/**
 * Walks the movetext once, tracking variation depth.
 *
 * Variations are dropped rather than recursed into: F-IM-1 imports games that
 * were played, and a variation is a game that was not. Depth is counted rather
 * than matched by a regex because variations nest, and a non-greedy `\(.*?\)`
 * closes a nested variation at the inner bracket and re-enters the mainline
 * early — which reads as a handful of extra moves in the middle of the game.
 */
function tokenise(movetext: string): Tokenised {
  const sans: string[] = [];
  const unparsed: string[] = [];
  let termination: string | null = null;
  let depth = 0;
  let i = 0;
  const n = movetext.length;

  while (i < n) {
    const c = movetext[i];
    if (c === undefined) break;

    if (c === '{') {
      const end = movetext.indexOf('}', i + 1);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (c === ';') {
      const end = movetext.indexOf('\n', i + 1);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (c === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      if (depth > 0) depth -= 1;
      i += 1;
      continue;
    }
    if (c === '$') {
      i += 1;
      while (i < n && /[0-9]/.test(movetext[i] ?? '')) i += 1;
      continue;
    }
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }

    let j = i;
    while (j < n) {
      const d = movetext[j];
      if (d === undefined) break;
      if (/\s/.test(d) || d === '{' || d === '}' || d === ';' || d === '(' || d === ')' || d === '$') break;
      j += 1;
    }
    const token = movetext.slice(i, j);
    i = j;
    if (depth > 0) continue;

    // Terminations are checked before the move-number strip, because `1-0` and
    // `1/2-1/2` both begin with a digit and would otherwise be read as move 1.
    if (TERMINATIONS.has(token)) {
      termination = token;
      continue;
    }

    // `12.`, `12...` and the glued `12.Nf3` all lose their number here.
    const numbered = /^(\d+)\.*(.*)$/.exec(token);
    const afterNumber = numbered ? (numbered[2] ?? '') : token;
    if (afterNumber === '') continue;

    // Annotation marks are commentary, not notation; `+` and `#` are notation.
    const bare = afterNumber.replace(/[?!]+$/, '');
    if (bare === '' || NULL_MOVES.has(bare)) continue;

    if (SAN_SHAPE.test(bare)) sans.push(bare);
    else unparsed.push(token);
  }

  return { sans, termination, unparsed };
}

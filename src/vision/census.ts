import { Chess } from 'chess.js';
import type { Color, Square } from '@/rules';

/**
 * "How many of side X's men bear on square S" — the question F-PR-2's third
 * vision mode asks, answered so that a BATTERY counts as the two men it is.
 *
 * ── WHY `attackersOf` IN src/rules/ CANNOT ANSWER THIS ───────────────────────
 *
 * `attackersOf` delegates to chess.js `attackers()`, which answers "who could
 * capture on S *this turn*". A man whose line to S passes through one of its own
 * side's men cannot, so it is absent from the answer. Two rooks stacked on a
 * file therefore report as ONE rook. Measured, not assumed — see census.test.ts,
 * which pins the raw `attackers()` output for the same positions it pins this
 * function's, so the divergence is a fact in the suite rather than a claim in a
 * comment.
 *
 * The failure mode is an UNDER-count and never an error, and an under-count is
 * plausible: two attackers reported as one reads as a position where nobody
 * doubled. A trainer built on it would mark a learner who answered "2" wrong,
 * and the learner would be right. The whole of unit 1.2.5 ("Counting attackers
 * and defenders") is about exactly the stacking the primitive cannot see.
 *
 * ── THE DEFINITION THIS IMPLEMENTS ──────────────────────────────────────────
 *
 * A man counts when it bears on S once every FRIENDLY man that also bears on S
 * and stands between it and S has been taken off. That is the same thing as
 * "participates in the sequence of captures on S", which is what a learner is
 * counting when they count attackers: the rook behind the rook recaptures.
 *
 * It follows — and the tests pin all four — that:
 *
 *  - An ENEMY man in the way is NOT peeled away, so a rook screened by an enemy
 *    pawn does not count. That is an x-ray, not a battery: you would have to
 *    capture the pawn first, which is a different move and a different lesson.
 *  - A friendly man in the way that does not itself bear on S (a knight, a pawn
 *    facing the wrong way) is never peeled either, so the rook behind it does
 *    not count. That is a discovered attack, not a battery.
 *  - A king is never a hidden member. It reaches only adjacent squares, and an
 *    adjacent square cannot be screened.
 *  - The man STANDING on S is not an attacker of S, and it does not screen the
 *    men behind it — chess.js is already right about both.
 *
 * ── COST ────────────────────────────────────────────────────────────────────
 *
 * One `attackers()` call per peel round. Over 400 random middlegames × 128
 * queries the deepest position needed three rounds, so this is a small constant
 * multiple of the primitive, not a search.
 */

/** Hard ceiling on peel rounds. Sixteen men a side, so sixteen is unreachable. */
const MAX_ROUNDS = 17;

/**
 * Every square holding one of `by`'s men that bears on `sq`, batteries included.
 *
 * Sorted, so the result is a value a test can compare and two calls agree.
 * `skipValidation` because the peel deletes men — including, legitimately, a
 * king — and the intermediate boards are scratch positions nobody plays from.
 */
export function attackerCensus(fen: string, sq: Square, by: Color): Square[] {
  const board = new Chess(fen, { skipValidation: true });
  const found = new Set<Square>();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const revealed = (board.attackers(sq, by) as Square[]).filter((s) => !found.has(s));
    if (revealed.length === 0) return [...found].sort();
    for (const s of revealed) {
      found.add(s);
      // Taking the man off is what lets the next round see behind it. Nothing
      // else on the board moves, so a man that appears next round appeared
      // BECAUSE this one left, which is the definition of a battery member.
      board.remove(s);
    }
  }
  /* c8 ignore next 2 -- unreachable: each round adds at least one of 32 squares. */
  throw new Error(`attackerCensus did not converge on ${sq}`);
}

/** The count F-PR-2's third mode asks for. */
export function attackerCount(fen: string, sq: Square, by: Color): number {
  return attackerCensus(fen, sq, by).length;
}

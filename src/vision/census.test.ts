import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { attackerCensus, attackerCount } from './census';
import { attackersOf } from '@/rules';
import type { Color, Square } from '@/rules';

/**
 * The census is the one instrument in this feature that can teach a wrong
 * number, so it is validated the way src/profile and src/review validate
 * theirs: every expected value written out in advance, beside its input.
 *
 * Two of the expectations in the first draft of this file were WRONG (a king
 * was expected to be a hidden battery member, and an "interposed" pawn was
 * placed above both rooks instead of between them). Writing them down first is
 * what found that; reading them off the output would have enshrined both.
 */

/** A raw chess.js `attackers()` call, so the divergence is pinned, not asserted. */
function naive(fen: string, sq: Square, by: Color): Square[] {
  return [...(new Chess(fen, { skipValidation: true }).attackers(sq, by) as Square[])].sort();
}

describe('attackerCensus — the batteries attackers() cannot see', () => {
  /**
   * The positive controls. Each one is a position whose census EXCEEDS the
   * primitive's answer, which is the phenomenon this module exists for. A
   * control drawn from an ordinary single-attacker position would pass on the
   * broken query too, so it would prove nothing.
   */
  const batteries: [string, string, Square, Color, Square[], Square[]][] = [
    // label, fen, square, by, census, what attackers() alone reports
    ['two rooks stacked on a file', '4k3/8/8/8/8/8/R7/R3K3 w - - 0 1', 'a5', 'w', ['a1', 'a2'], ['a2']],
    ['queen behind a rook', '4k3/8/8/8/8/8/3R4/3QK3 w - - 0 1', 'd5', 'w', ['d1', 'd2'], ['d2']],
    ['three deep: queen, rook, rook', '4k3/8/8/8/8/Q7/R7/R3K3 w - - 0 1', 'a5', 'w', ['a1', 'a2', 'a3'], ['a3']],
    ['queen behind a bishop on a diagonal', '4k3/8/8/8/8/8/1B6/Q3K3 w - - 0 1', 'd4', 'w', ['a1', 'b2'], ['b2']],
  ];

  it.each(batteries)('counts the whole battery: %s', (_label, fen, sq, by, census) => {
    expect(attackerCensus(fen, sq, by)).toEqual(census);
  });

  /**
   * The same four positions, asserting what the PRIMITIVE says about them.
   *
   * This is the test that makes the module's reason for existing checkable. If a
   * future chess.js learned to see through its own men, these assertions fail
   * and a reader is told the census has become redundant — rather than it
   * quietly becoming a wrapper nobody can justify.
   */
  it.each(batteries)('attackersOf alone under-counts it: %s', (_label, fen, sq, by, census, alone) => {
    expect(naive(fen, sq, by)).toEqual(alone);
    expect([...attackersOf(fen, sq, by)].sort()).toEqual(alone);
    expect(alone.length).toBeLessThan(census.length);
  });

  /**
   * FALSE CONTROLS, each DERIVED from a positive control above by one change.
   *
   * Without these, "count every friendly man on the line" would pass every test
   * in the block above while being wrong about all four of these. They are the
   * assertions that separate a battery from the three things that look like one.
   */
  it.each([
    // An ENEMY man in the way: an x-ray, not a battery. Nothing counts, because
    // the front rook is blocked too.
    ['enemy pawn ahead of both rooks', '4k3/8/8/8/8/p7/R7/R3K3 w - - 0 1', 'a5', 'w', []],
    // An enemy man BETWEEN the two rooks: the front one still bears on a5, the
    // rear one does not. One, not two, and not zero.
    ['enemy pawn between the rooks', '4k3/8/8/8/8/R7/p7/R3K3 w - - 0 1', 'a5', 'w', ['a3']],
    // A FRIENDLY man in the way that does not bear on a5 itself is never peeled,
    // so the rook behind it does not count. A discovered attack, not a battery.
    ['own knight screens the rook', '4k3/8/8/8/8/N7/8/R3K3 w - - 0 1', 'a5', 'w', []],
    ['own pawn screens the rook', '4k3/8/8/8/8/P7/8/R3K3 w - - 0 1', 'a5', 'w', []],
    // A king reaches only adjacent squares, so it is never screened and never a
    // hidden member. e1 does not bear on e5 even with e2 gone.
    ['king behind a rook is not a member', '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e5', 'w', ['e2']],
  ] as [string, string, Square, Color, Square[]][])(
    'does not invent a battery: %s',
    (_label, fen, sq, by, want) => {
      expect(attackerCensus(fen, sq, by)).toEqual(want);
    },
  );

  /** Positions with no battery in them: the census must equal the primitive. */
  it.each([
    ['rook and knight, neither blocking', '4k3/8/8/R7/8/2N5/8/4K3 w - - 0 1', 'a4', 'w', ['a5', 'c3']],
    // Geometry, not move generation: a pawn covers an EMPTY square it could
    // never legally move to. See src/review — the same trap caught twice there.
    ['a pawn covers an empty square', '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1', 'd5', 'w', ['e4']],
    // The square is occupied by one of `by`'s OWN men, which is the case the
    // question is usually asked about. A legal-move query answers [] here.
    ['defenders of an own-occupied square', '4k3/8/8/3N4/4P3/8/8/3RK3 w - - 0 1', 'd5', 'w', ['d1', 'e4']],
    ['the man standing on the square is not an attacker of it', '4k3/8/8/R7/8/8/8/R3K3 w - - 0 1', 'a5', 'w', ['a1']],
    ['a king counts when it is adjacent', '4k3/8/8/8/4R3/8/8/4K3 w - - 0 1', 'e2', 'w', ['e1', 'e4']],
    ['nothing attacks an unreachable square', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a5', 'w', []],
  ] as [string, string, Square, Color, Square[]][])('agrees with the primitive: %s', (_label, fen, sq, by, want) => {
    expect(attackerCensus(fen, sq, by)).toEqual(want);
    expect(naive(fen, sq, by)).toEqual(want);
  });

  it('counts for either side from the same position', () => {
    // Black rooks doubled on the a-file, white rook alone on h-file.
    const fen = 'r3k3/r7/8/8/8/8/8/R3K2R w - - 0 1';
    expect(attackerCensus(fen, 'a5', 'b')).toEqual(['a7', 'a8']);
    expect(attackerCensus(fen, 'a5', 'w')).toEqual(['a1']);
  });

  it('is unaffected by whose turn it is', () => {
    const white = '4k3/8/8/8/8/8/R7/R3K3 w - - 0 1';
    const black = '4k3/8/8/8/8/8/R7/R3K3 b - - 0 1';
    expect(attackerCensus(white, 'a5', 'w')).toEqual(attackerCensus(black, 'a5', 'w'));
  });

  it('does not mutate the position it is given', () => {
    const fen = '4k3/8/8/8/8/Q7/R7/R3K3 w - - 0 1';
    expect(attackerCensus(fen, 'a5', 'w')).toHaveLength(3);
    // The peel removes men from its own scratch board. Asking again must give
    // the same answer, which it cannot if the caller's FEN were touched.
    expect(attackerCensus(fen, 'a5', 'w')).toHaveLength(3);
  });

  it('attackerCount is the size of the census', () => {
    const fen = '4k3/8/8/8/8/Q7/R7/R3K3 w - - 0 1';
    expect(attackerCount(fen, 'a5', 'w')).toBe(3);
    expect(attackerCount(fen, 'h5', 'w')).toBe(0);
  });
});

/**
 * The population check: over real positions, does the census ever go BELOW the
 * primitive, and how often does it go above?
 *
 * Both halves matter. "Never below" is the correctness invariant — the census is
 * a superset by construction, so a single case below it is a bug in the peel.
 * "Sometimes above" is the non-empty control: if the answer were never above,
 * every test in this file could be passing because the census silently is the
 * primitive, and the whole module would be dead code that looks tested.
 *
 * 60 positions × 128 queries rather than the 400 the module was developed
 * against: the invariant is per-query, so the extra positions buy confidence and
 * not coverage, and this runs inside the default budget with room to spare.
 */
describe('attackerCensus over played-out positions', () => {
  /** Deterministic: a fixed LCG, so a failure here is reproducible. */
  function position(seed: number): string {
    let s = seed;
    const next = (): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const game = new Chess();
    for (let i = 0; i < 24; i++) {
      const moves = game.moves();
      if (moves.length === 0) break;
      game.move(moves[Math.floor(next() * moves.length)]!);
    }
    return game.fen();
  }

  const FILES = 'abcdefgh'.split('');

  it('is never smaller than attackers(), and is sometimes larger', () => {
    let larger = 0;
    let equal = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const fen = position(seed);
      for (const file of FILES) {
        for (let rank = 1; rank <= 8; rank++) {
          const sq = `${file}${String(rank)}` as Square;
          for (const by of ['w', 'b'] as Color[]) {
            const censused = attackerCount(fen, sq, by);
            const primitive = attackersOf(fen, sq, by).length;
            expect(censused).toBeGreaterThanOrEqual(primitive);
            if (censused > primitive) larger++;
            else equal++;
          }
        }
      }
    }
    // The positive control. A run in which the two never diverged would satisfy
    // the invariant above and prove nothing, so the divergence is asserted.
    expect(larger).toBeGreaterThan(0);
    expect(equal).toBeGreaterThan(0);
  });
});

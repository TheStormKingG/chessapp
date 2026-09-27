/**
 * A tiny deterministic generator, so a vision round is reproducible from its
 * seed and every question in this module can be tested by naming a number.
 *
 * `Math.random` would make the generators untestable in exactly the way that
 * matters: a test could assert the SHAPE of a question but never that a
 * particular question has a particular answer, which is the only assertion worth
 * making about a thing that marks a learner right or wrong.
 *
 * mulberry32. Not cryptographic and not trying to be — it picks squares.
 */
export interface Rng {
  /** A float in [0, 1). */
  next: () => number;
  /** An integer in [0, n). */
  int: (n: number) => number;
  /** One member of a non-empty array. */
  pick: <T>(xs: readonly T[]) => T;
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  return {
    next,
    int,
    pick: <T,>(xs: readonly T[]): T => {
      const x = xs[int(xs.length)];
      if (x === undefined) throw new Error('rng.pick on an empty array');
      return x;
    },
  };
}

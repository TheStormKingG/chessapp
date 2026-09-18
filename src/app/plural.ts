/**
 * A count and its noun, agreeing in number.
 *
 * Every counter the product prints is read at a moment the learner is being
 * told what they just did, so "1 hints" is not a cosmetic slip: it is the
 * product mis-speaking at the one moment the learning loop exists to produce.
 * `one` takes the singular, everything else — including zero — takes the
 * plural, which is English's rule and not a special case for our copy.
 *
 * `many` is only needed for nouns whose plural is not the noun plus `s`
 * (`miss` -> `misses`).
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

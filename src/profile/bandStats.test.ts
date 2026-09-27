import { expect, test } from 'vitest';
import {
  BAND_METRICS,
  BUCKET_WIDTH,
  HIGHEST_BUCKET,
  LOWEST_BUCKET,
  NO_BAND_STATS,
  bucketFor,
  comparisonFor,
  wordComparison,
  type BandMetric,
  type BandStatsSource,
} from './bandStats';

/**
 * A source WITH data, for testing the mechanism only.
 *
 * It lives in this test file and nowhere else on purpose. If it lived in src/ it
 * would be one import away from shipping, and the numbers in it are invented —
 * which is exactly what must never reach a learner. Its job is to prove the
 * wording and the gating work, so that when a real mining pass lands there is
 * nothing left to write.
 */
function fakeSource(values: Partial<Record<BandMetric, number>>): BandStatsSource {
  return {
    hasData: true,
    typicalFor: (_bucket, metric) => values[metric] ?? null,
  };
}

// ── Buckets ─────────────────────────────────────────────────────────────────

test('a rating falls in the hundred-point bucket named by its floor', () => {
  expect(bucketFor(800)).toEqual({ floor: 800, name: '800s' });
  expect(bucketFor(899)).toEqual({ floor: 800, name: '800s' });
  expect(bucketFor(900)).toEqual({ floor: 900, name: '900s' });
  // F-SW-5's own example sentence names the population this way.
  expect(bucketFor(842)?.name).toBe('800s');
});

test('the end buckets are open-ended in both directions', () => {
  expect(bucketFor(120)?.floor).toBe(LOWEST_BUCKET - BUCKET_WIDTH);
  expect(bucketFor(LOWEST_BUCKET - 1)?.floor).toBe(LOWEST_BUCKET - BUCKET_WIDTH);
  expect(bucketFor(LOWEST_BUCKET)?.floor).toBe(LOWEST_BUCKET);
  expect(bucketFor(2600)?.floor).toBe(HIGHEST_BUCKET);
  expect(bucketFor(HIGHEST_BUCKET)?.floor).toBe(HIGHEST_BUCKET);
  expect(bucketFor(HIGHEST_BUCKET - 1)?.floor).toBe(HIGHEST_BUCKET - BUCKET_WIDTH);
});

test('no rating means no bucket', () => {
  // Which is the state the app is in: it has a PUZZLE rating and no game-rating
  // estimate, and F-AC-5 gates the only other candidate.
  expect(bucketFor(null)).toBeNull();
  expect(bucketFor(Number.NaN)).toBeNull();
  expect(bucketFor(Number.POSITIVE_INFINITY)).toBeNull();
});

// ── The shipped source has nothing ──────────────────────────────────────────

test('the shipped source answers nothing, for every metric there is', () => {
  // Every declared metric, read from BAND_METRICS rather than a hand-typed list,
  // so a metric added later is covered without anyone remembering to add it here.
  const metrics = Object.keys(BAND_METRICS) as BandMetric[];
  expect(metrics.length).toBeGreaterThan(0);
  expect(NO_BAND_STATS.hasData).toBe(false);
  for (const m of metrics) {
    expect(NO_BAND_STATS.typicalFor({ floor: 800, name: '800s' }, m), m).toBeNull();
  }
});

test('with the shipped source every comparison in the profile is absent', () => {
  for (const m of Object.keys(BAND_METRICS) as BandMetric[]) {
    expect(
      comparisonFor({
        metric: m,
        learner: 3,
        bucket: { floor: 800, name: '800s' },
        source: NO_BAND_STATS,
        early: false,
      }),
      m,
    ).toBeNull();
  }
});

test('POSITIVE CONTROL: comparisonFor does produce a sentence when there is data', () => {
  // The two tests above assert an absence. Without this one, a comparisonFor that
  // returned null unconditionally — a genuinely broken seam — would satisfy them
  // both, and the day real statistics land nothing would tell us the wiring was
  // dead. This is the query proving it would have found something.
  const got = comparisonFor({
    metric: 'hungPiecesPerGame',
    learner: 0.5,
    bucket: { floor: 800, name: '800s' },
    source: fakeSource({ hungPiecesPerGame: 1 }),
    early: false,
  });
  expect(got).toBe('You hang pieces about half as often as most 800s.');
});

test('each gate that can suppress a comparison does so on its own', () => {
  const source = fakeSource({ blundersPerGame: 2 });
  const bucket = { floor: 800, name: '800s' };
  const base = { metric: 'blundersPerGame' as const, learner: 1, bucket, source, early: false };
  // All gates open: a sentence.
  expect(comparisonFor(base)).not.toBeNull();
  // No rating to bucket.
  expect(comparisonFor({ ...base, bucket: null })).toBeNull();
  // Source declares it has nothing.
  expect(comparisonFor({ ...base, source: NO_BAND_STATS })).toBeNull();
  // Source has data but not for THIS metric — the partial-mining case.
  expect(comparisonFor({ ...base, metric: 'accuracyEndgame' })).toBeNull();
});

test('a source that declares it has no data is believed over any value it returns', () => {
  // Found by mutation: deleting the `!source.hasData` gate from comparisonFor
  // broke nothing, because NO_BAND_STATS also returns null from typicalFor and
  // the second gate covered for the first. That makes the two gates
  // indistinguishable while the only source is well-behaved — and the gate that
  // matters is this one, because `hasData` is the source's OWN statement about
  // itself and a source with a stale or default table can return a number while
  // knowing it has nothing. So: a deliberately inconsistent source.
  const lying: BandStatsSource = { hasData: false, typicalFor: () => 1.5 };
  expect(
    comparisonFor({
      metric: 'hungPiecesPerGame',
      learner: 0.5,
      bucket: { floor: 800, name: '800s' },
      source: lying,
      early: false,
    }),
  ).toBeNull();
  // Positive control on the same source shape: flipping only `hasData` produces a
  // sentence, so the null above is the gate firing and not the fake being broken.
  expect(
    comparisonFor({
      metric: 'hungPiecesPerGame',
      learner: 0.5,
      bucket: { floor: 800, name: '800s' },
      source: { hasData: true, typicalFor: () => 1.5 },
      early: false,
    }),
  ).not.toBeNull();
});

// ── The wording ─────────────────────────────────────────────────────────────

test('F-SW-5s own example sentence is what the wording function produces', () => {
  // "you hang pieces about half as often as most 800s" — the requirement quotes
  // this, so it is pinned literally rather than paraphrased.
  expect(
    wordComparison('hungPiecesPerGame', {
      learner: 0.6,
      typical: 1.2,
      bucketName: '800s',
      early: false,
    }),
  ).toBe('You hang pieces about half as often as most 800s.');
});

test('a rate comparison is worded, never numeric', () => {
  for (const [learner, expected] of [
    [0.2, 'far less often than'],
    [0.5, 'about half as often as'],
    [0.8, 'less often than'],
    [1.0, 'about as often as'],
    [1.4, 'more often than'],
    [2.0, 'about twice as often as'],
    [5.0, 'far more often than'],
  ] as const) {
    const s = wordComparison('blundersPerGame', {
      learner,
      typical: 1,
      bucketName: '800s',
      early: false,
    });
    expect(s, `learner ${String(learner)}`).toContain(expected);
    // "never just a number": no digit from the comparison appears in the
    // sentence. The bucket name carries digits, so it is removed before the
    // check — and the assertion is non-vacuous because the ratio words above
    // are asserted present in the same string.
    expect(s.replace('800s', ''), `learner ${String(learner)}`).not.toMatch(/[0-9]/);
  }
});

test('a percentage is compared by difference, not by ratio', () => {
  // 60% is not "twice as accurate" as 30%. A ratio-worded percentage is the
  // specific wrong sentence this split exists to prevent.
  const s = wordComparison('accuracyEndgame', {
    learner: 60,
    typical: 30,
    bucketName: '800s',
    early: false,
  });
  expect(s).toBe('Your endgame accuracy is well above most 800s.');
  expect(s).not.toContain('twice');

  expect(
    wordComparison('accuracyEndgame', { learner: 55, typical: 54, bucketName: '800s', early: false }),
  ).toContain('about the same as');
  expect(
    wordComparison('accuracyEndgame', { learner: 40, typical: 60, bucketName: '800s', early: false }),
  ).toContain('well below');
});

test('a population median of zero is worded as a level, never as a division', () => {
  // The typical value is a denominator. At zero there is no ratio, and the
  // sentence must still be true and readable.
  const s = wordComparison('missedMatesPerGame', {
    learner: 0.4,
    typical: 0,
    bucketName: '1500s',
    early: false,
  });
  expect(s).toBe('You miss mate in one more often than most 1500s.');
  expect(s).not.toMatch(/Infinity|NaN/);

  expect(
    wordComparison('missedMatesPerGame', { learner: 0, typical: 0, bucketName: '1500s', early: false }),
  ).toContain('about as often as');
});

test('a learner value of zero says so rather than dividing into nothing', () => {
  expect(
    wordComparison('hungPiecesPerGame', { learner: 0, typical: 1.1, bucketName: '800s', early: false }),
  ).toBe('You do not hang pieces at all, unlike most 800s.');
});

test('F-SW-6s early label rides on the sentence, in words', () => {
  // Between ten and thirty games the comparison is shown and labelled. The label
  // is part of the sentence rather than a badge, so it is announced with it.
  const early = wordComparison('blundersPerGame', {
    learner: 2,
    typical: 1,
    bucketName: '800s',
    early: true,
  });
  expect(early).toContain('early');
  const settled = wordComparison('blundersPerGame', {
    learner: 2,
    typical: 1,
    bucketName: '800s',
    early: false,
  });
  expect(settled).not.toContain('early');
  // Non-vacuous: the two sentences differ only in the caveat.
  expect(early.startsWith(settled.slice(0, -1))).toBe(true);
});

test('every declared metric words a comparison without throwing', () => {
  // Read from BAND_METRICS, so adding a metric with a missing noun or an unknown
  // unit fails here rather than at the moment a learner opens the screen.
  for (const m of Object.keys(BAND_METRICS) as BandMetric[]) {
    const s = wordComparison(m, { learner: 1, typical: 2, bucketName: '800s', early: false });
    expect(s.length, m).toBeGreaterThan(10);
    expect(s, m).toMatch(/most 800s\.$/);
    expect(s, m).not.toMatch(/undefined|NaN|Infinity/);
  }
});

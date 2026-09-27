import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PACK_BYTES, isOutOfSpace, mb, packFailureMessage } from './packMessages';
import type { RatingBand } from './types';

const BANDS: RatingBand[] = ['600-900', '900-1200', '1200-1500'];

describe('PACK_BYTES', () => {
  /**
   * The figure a learner is told to free must be the figure the file actually
   * costs. A hardcoded size is a claim about a build artefact, and a claim about
   * a file on disk can be checked against the file on disk — so it is, rather
   * than trusted for the life of the app.
   */
  test('every pack size matches the file that ships', () => {
    for (const band of BANDS) {
      const path = resolve(__dirname, '../../public/data/puzzles', `${band}.txt`);
      const actual = readFileSync(path).byteLength;
      expect(actual, `public/data/puzzles/${band}.txt`).toBe(PACK_BYTES[band]);
    }
  });

  test('every band has a size, so no band can fall through to undefined', () => {
    for (const band of BANDS) {
      expect(PACK_BYTES[band], band).toBeGreaterThan(0);
    }
    expect(Object.keys(PACK_BYTES).sort()).toEqual([...BANDS].sort());
  });
});

describe('mb', () => {
  test('one decimal, and the same 1,000,000-byte MB the engine download uses', () => {
    // Mixing MB conventions inside one app makes a pack look 5 per cent smaller
    // on one screen than on another.
    expect(mb(316_920)).toBe('0.3 MB');
    expect(mb(1_787_571)).toBe('1.8 MB');
    expect(mb(0)).toBe('0.0 MB');
  });
});

describe('packFailureMessage (F-ER-3)', () => {
  test('a failed download names WHICH pack and HOW MUCH SPACE, which is the clause verbatim', () => {
    const m = packFailureMessage({ kind: 'unavailable', band: '900-1200' });
    // Which pack. The band must be identifiable — the app ships three.
    expect(m.text).toContain('900–1200');
    // How much space.
    expect(m.text).toContain('0.3 MB');
    expect(m.needsLabel).toBe('0.3 MB');
  });

  test('the message names the pack that failed and not another one', () => {
    const m = packFailureMessage({ kind: 'unavailable', band: '600-900' });
    expect(m.text).toContain('600–900');
    // A message built from the wrong band would still pass a "contains a band"
    // check, so the other two are excluded by name.
    expect(m.text).not.toContain('900–1200');
    expect(m.text).not.toContain('1200–1500');
  });

  test('every band produces its own sentence, and no two are the same', () => {
    const texts = BANDS.map((band) => packFailureMessage({ kind: 'unavailable', band }).text);
    expect(new Set(texts).size).toBe(BANDS.length);
  });

  test('out of space says what it needs AND what the device has', () => {
    const m = packFailureMessage({ kind: 'out-of-space', band: '600-900', freeBytes: 120_000 });
    expect(m.text).toContain('0.3 MB'); // needs
    expect(m.text).toContain('0.1 MB'); // has
    expect(m.text).toMatch(/free up some space/i);
    // And it must NOT send a learner with a full disk looking for wifi.
    expect(m.text).not.toMatch(/connection/i);
  });

  test('an unknown free figure is not invented as zero', () => {
    const m = packFailureMessage({ kind: 'out-of-space', band: '600-900', freeBytes: null });
    // "0.0 MB free" would be the one fabricated fact that decides whether a
    // learner goes and deletes their photos.
    expect(m.text).not.toContain('0.0 MB');
    expect(m.text).toMatch(/not enough room/i);
    // The size it needs is still stated: that half is known.
    expect(m.text).toContain('0.3 MB');
  });

  test('both causes promise that the packs already downloaded are kept', () => {
    // "keeps whatever was already downloaded" is a promise the learner cannot
    // see unless it is said. Told a download failed, the reasonable fear is that
    // the ones that worked are gone too.
    for (const f of [
      { kind: 'unavailable', band: '600-900' } as const,
      { kind: 'out-of-space', band: '600-900', freeBytes: 0 } as const,
    ]) {
      expect(packFailureMessage(f).text, f.kind).toMatch(/already have are still here/i);
    }
  });

  test('every message is a sentence a learner can read, and offers the retry', () => {
    const all = [
      ...BANDS.map((band) => ({ kind: 'unavailable', band }) as const),
      ...BANDS.map((band) => ({ kind: 'out-of-space', band, freeBytes: 1 }) as const),
      ...BANDS.map((band) => ({ kind: 'out-of-space', band, freeBytes: null }) as const),
    ];
    for (const f of all) {
      const m = packFailureMessage(f);
      expect(m.text.length, JSON.stringify(f)).toBeGreaterThan(40);
      expect(m.text.trimEnd().endsWith('.'), m.text).toBe(true);
      // No technical residue. `loadPack` throws "puzzle pack 600-900: HTTP 404";
      // that string must never be what a learner reads.
      expect(m.text).not.toMatch(/HTTP|undefined|NaN|\[object/);
      expect(m.retryable).toBe(true);
    }
    expect(all).toHaveLength(9);
  });

  test('the message starts with a capital, because it is a sentence not a fragment', () => {
    for (const band of BANDS) {
      expect(packFailureMessage({ kind: 'unavailable', band }).text.charAt(0)).toBe('T');
    }
  });
});

describe('isOutOfSpace', () => {
  test('less room than the pack needs is out of space', () => {
    expect(isOutOfSpace('600-900', PACK_BYTES['600-900'] - 1)).toBe(true);
    expect(isOutOfSpace('600-900', 0)).toBe(true);
  });

  test('enough room is not out of space, so a fetch failure there reads as a connection', () => {
    expect(isOutOfSpace('600-900', PACK_BYTES['600-900'])).toBe(false);
    expect(isOutOfSpace('600-900', 50_000_000)).toBe(false);
  });

  test('a browser that will not report a quota is not a full one', () => {
    // Guessing otherwise sends every learner whose browser withholds
    // `estimate()` off to delete files that were never the problem.
    expect(isOutOfSpace('600-900', null)).toBe(false);
    // The positive control: the same band with a real small number DOES fire, so
    // this is a statement about `null` and not about the band.
    expect(isOutOfSpace('600-900', 10)).toBe(true);
  });

  test('the threshold is the pack’s own size, not a shared constant', () => {
    // 310,201 bytes free is enough for the 1200–1500 pack and not for the other
    // two, so a single hardcoded threshold would get at least one band wrong.
    const free = PACK_BYTES['1200-1500'] + 1;
    expect(isOutOfSpace('1200-1500', free)).toBe(false);
    expect(isOutOfSpace('600-900', free)).toBe(true);
    expect(isOutOfSpace('900-1200', free)).toBe(true);
  });
});

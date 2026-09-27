import { deviceProfile, reportEngineFailure } from './deviceClass';
import { setSink, type Sink } from './track';

/**
 * A navigator carrying only the two signals F-ER-1's report reads. Cast rather
 * than built: the real `Navigator` has eighty members and none of the others is
 * read here, so a fake that implemented them would be eighty lines asserting
 * nothing.
 */
function nav(signals: { deviceMemory?: unknown; hardwareConcurrency?: unknown }): Navigator {
  return signals as Navigator;
}

describe('deviceProfile', () => {
  test('a small phone is low, and the raw numbers travel with the class', () => {
    const p = deviceProfile(nav({ deviceMemory: 2, hardwareConcurrency: 4 }));
    expect(p.deviceClass).toBe('low');
    // The class is what you group by; these are what make the group actionable.
    expect(p.deviceMemoryGb).toBe(2);
    expect(p.cores).toBe(4);
  });

  test('a desktop is high', () => {
    expect(deviceProfile(nav({ deviceMemory: 8, hardwareConcurrency: 16 })).deviceClass).toBe('high');
  });

  test('the middle is the middle, not a rounding of either end', () => {
    expect(deviceProfile(nav({ deviceMemory: 4, hardwareConcurrency: 4 })).deviceClass).toBe('mid');
  });

  test('a browser that withholds both signals is unknown, never mid', () => {
    const p = deviceProfile(nav({}));
    // Folding this population into `mid` would hide it inside the largest
    // bucket; it is the population a Safari-only engine failure lands in.
    expect(p.deviceClass).toBe('unknown');
    expect(p.deviceMemoryGb).toBeNull();
    expect(p.cores).toBeNull();
  });

  test('one signal is enough to classify', () => {
    // Safari gives cores and no memory.
    expect(deviceProfile(nav({ hardwareConcurrency: 2 })).deviceClass).toBe('low');
    expect(deviceProfile(nav({ hardwareConcurrency: 16 })).deviceClass).toBe('high');
    // A headless environment could give the reverse.
    expect(deviceProfile(nav({ deviceMemory: 1 })).deviceClass).toBe('low');
  });

  test('low wins when the signals disagree, because the failure is an out-of-memory one', () => {
    // 16 cores and 2 GB fails the way a small device fails. Grouping it with the
    // desktops would bury exactly the report this clause exists to surface.
    expect(deviceProfile(nav({ deviceMemory: 2, hardwareConcurrency: 16 })).deviceClass).toBe('low');
  });

  test('high needs every signal the browser gave to agree', () => {
    // 8 GB with 4 cores is a middling device, not a high one.
    expect(deviceProfile(nav({ deviceMemory: 8, hardwareConcurrency: 4 })).deviceClass).toBe('mid');
    expect(deviceProfile(nav({ deviceMemory: 4, hardwareConcurrency: 16 })).deviceClass).toBe('mid');
  });

  test('a value that is not a measurement is treated as withheld, not as a low-end device', () => {
    // A spoofing extension reporting 0 or NaN must not land in the bucket
    // reserved for the phones this clause exists to find.
    for (const bad of [0, -4, Number.NaN, '4', null, undefined]) {
      const p = deviceProfile(nav({ deviceMemory: bad, hardwareConcurrency: bad }));
      expect(p.deviceClass, `deviceMemory=${String(bad)}`).toBe('unknown');
      expect(p.deviceMemoryGb).toBeNull();
    }
  });
});

describe('reportEngineFailure', () => {
  const errors: { e: unknown; context?: Record<string, unknown> }[] = [];
  const sink: Sink = {
    track: () => undefined,
    error: (e, context) => {
      errors.push({ e, context });
    },
  };

  beforeEach(() => {
    errors.length = 0;
    setSink(sink);
  });

  test('the report carries the site AND the device class, which is F-ER-1 verbatim', () => {
    const boom = new Error('wasm memory');
    reportEngineFailure(boom, 'play-bot-move', { nav: nav({ deviceMemory: 2, hardwareConcurrency: 2 }) });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.e).toBe(boom);
    expect(errors[0]?.context).toEqual({
      where: 'play-bot-move',
      deviceClass: 'low',
      deviceMemoryGb: 2,
      cores: 2,
    });
  });

  test('a withholding browser still produces a report, with the class stated as unknown', () => {
    // The failure must reach the tracker either way. An engine failure that is
    // dropped because the device would not identify itself is the one clause
    // F-ER-1 cannot afford to lose.
    reportEngineFailure(new Error('load failed'), 'engine-download', { nav: nav({}) });
    expect(errors[0]?.context).toMatchObject({ where: 'engine-download', deviceClass: 'unknown' });
  });
});

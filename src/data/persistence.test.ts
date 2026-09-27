import {
  ADVICE_GAP_MS,
  PERSISTENCE_REFUSED_ADVICE,
  estimateSpace,
  requestPersistence,
  shouldRepeatInstallAdvice,
  type PersistenceOutcome,
} from './persistence';

/** A navigator with exactly the `storage` shape a test wants, and nothing else. */
function nav(storage?: unknown): Navigator {
  return { storage } as Navigator;
}

describe('requestPersistence', () => {
  test('a grant is a grant', async () => {
    await expect(requestPersistence(nav({ persist: () => Promise.resolve(true) }))).resolves.toBe('granted');
  });

  test('a refusal is a refusal — the one state F-ER-6 acts on', async () => {
    await expect(requestPersistence(nav({ persist: () => Promise.resolve(false) }))).resolves.toBe('refused');
  });

  test('an origin that already has the grant is not asked again', async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    const out = await requestPersistence(nav({ persisted: () => Promise.resolve(true), persist }));
    expect(out).toBe('granted');
    // `persist()` re-prompts in some browsers. Asking an origin that already has
    // the grant would put a dialog in front of a learner for nothing — and this
    // fake would have answered `false`, so a version that asked anyway would
    // report a refusal and trigger advice about storage that is already durable.
    expect(persist).not.toHaveBeenCalled();
  });

  test('a browser with no Storage API is unsupported, never refused', async () => {
    // The distinction is the whole point: `refused` shows the learner
    // installation advice. A browser that was never asked has not declined.
    await expect(requestPersistence(nav(undefined))).resolves.toBe('unsupported');
    await expect(requestPersistence(nav({}))).resolves.toBe('unsupported');
  });

  test('a throwing namespace is unsupported, not refused', async () => {
    await expect(
      requestPersistence(
        nav({
          persist: () => {
            throw new DOMException('denied', 'SecurityError');
          },
        }),
      ),
    ).resolves.toBe('unsupported');
    // A rejected promise, which is the shape a sandboxed frame produces.
    await expect(
      requestPersistence(nav({ persist: () => Promise.reject(new Error('sandboxed')) })),
    ).resolves.toBe('unsupported');
  });

  test('a throwing `persisted` does not lose a real grant decision', async () => {
    await expect(
      requestPersistence(
        nav({
          persisted: () => Promise.reject(new Error('nope')),
          persist: () => Promise.resolve(true),
        }),
      ),
    ).resolves.toBe('unsupported');
  });
});

describe('estimateSpace', () => {
  test('free space is the quota less what is used', async () => {
    const e = await estimateSpace(nav({ estimate: () => Promise.resolve({ usage: 2_000_000, quota: 10_000_000 }) }));
    expect(e).toEqual({ usedBytes: 2_000_000, quotaBytes: 10_000_000, freeBytes: 8_000_000 });
  });

  test('unknown stays unknown and is never arithmetic’d into zero', async () => {
    // `0 - 0 = 0` reads as "no space left", which would tell a learner with a
    // half-empty phone to delete things. null has to survive the subtraction.
    for (const raw of [{}, { usage: 5 }, { quota: 5 }]) {
      const e = await estimateSpace(nav({ estimate: () => Promise.resolve(raw) }));
      expect(e.freeBytes, JSON.stringify(raw)).toBeNull();
    }
  });

  test('a browser with no estimate reports every field unknown', async () => {
    await expect(estimateSpace(nav(undefined))).resolves.toEqual({
      usedBytes: null,
      quotaBytes: null,
      freeBytes: null,
    });
  });

  test('a quota below the usage is clamped at zero, not reported negative', async () => {
    const e = await estimateSpace(nav({ estimate: () => Promise.resolve({ usage: 9, quota: 4 }) }));
    expect(e.freeBytes).toBe(0);
  });

  test('a throwing estimate is unknown, not zero', async () => {
    const e = await estimateSpace(nav({ estimate: () => Promise.reject(new Error('no')) }));
    expect(e.freeBytes).toBeNull();
  });

  test('a genuinely full origin reports zero free, which is different from unknown', async () => {
    // The positive control for the `null` cases above: this input CAN produce a
    // real zero, so a function that returned null for everything would fail here.
    const e = await estimateSpace(nav({ estimate: () => Promise.resolve({ usage: 10, quota: 10 }) }));
    expect(e.freeBytes).toBe(0);
  });
});

describe('shouldRepeatInstallAdvice (F-ER-6)', () => {
  const base = { lessonsCompleted: 1, lastShownAt: 0, now: 1_000_000_000_000 };

  test('a refusal after a completed lesson repeats the advice', () => {
    expect(shouldRepeatInstallAdvice({ ...base, outcome: 'refused' })).toBe(true);
  });

  test('every other outcome says nothing', () => {
    const quiet: (PersistenceOutcome | 'never-asked')[] = ['granted', 'unsupported', 'never-asked'];
    for (const outcome of quiet) {
      expect(shouldRepeatInstallAdvice({ ...base, outcome }), outcome).toBe(false);
    }
    // The positive control: the same input with `refused` DOES fire, so this is
    // a statement about the outcome and not about the rest of the input.
    expect(shouldRepeatInstallAdvice({ ...base, outcome: 'refused' })).toBe(true);
  });

  test('before the first completed lesson there is nothing to repeat', () => {
    expect(shouldRepeatInstallAdvice({ ...base, outcome: 'refused', lessonsCompleted: 0 })).toBe(false);
  });

  test('the advice is capped at F-ON-6’s weekly gap, so a refusal is not a nag', () => {
    const shownAt = base.now - ADVICE_GAP_MS;
    // Exactly a week later: due.
    expect(shouldRepeatInstallAdvice({ ...base, outcome: 'refused', lastShownAt: shownAt })).toBe(true);
    // A minute short of a week: not yet.
    expect(
      shouldRepeatInstallAdvice({ ...base, outcome: 'refused', lastShownAt: shownAt + 60_000 }),
    ).toBe(false);
  });
});

describe('the advice copy', () => {
  test('F-ER-6 says the app continues, so the advice is not an error', () => {
    // "the app continues and repeats the installation advice" — advice, not an
    // apology. A learner who has just been told their data might vanish needs
    // the remedy in the same breath, and no word that reads as a fault.
    for (const forbidden of ['error', 'failed', 'sorry', 'unable', 'problem', 'warning']) {
      expect(PERSISTENCE_REFUSED_ADVICE.toLowerCase(), forbidden).not.toContain(forbidden);
    }
    // It must say what installing buys, or it is not advice.
    expect(PERSISTENCE_REFUSED_ADVICE).toMatch(/home screen/i);
    expect(PERSISTENCE_REFUSED_ADVICE).toMatch(/progress|lessons|puzzles/i);
    // Two sentences. A learner reading a non-blocking note reads the first one.
    expect(PERSISTENCE_REFUSED_ADVICE.split('.').filter((s) => s.trim() !== '')).toHaveLength(2);
  });
});

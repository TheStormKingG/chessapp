import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { __resetStaleChunkForTest, importWithRecovery, onStaleChunk } from './loader';

const reload = vi.fn();
const takeUpdate = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  __resetStaleChunkForTest();
  reload.mockClear();
  takeUpdate.mockClear();
  vi.stubGlobal('location', { ...window.location, reload });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/lesson-2.4.1-OLD.js');

test('a successful import is returned untouched and nothing recovers', async () => {
  onStaleChunk(takeUpdate);
  await expect(importWithRecovery(() => Promise.resolve({ default: 7 }))).resolves.toBe(7);
  expect(takeUpdate).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

test('a chunk that 404s takes the waiting worker rather than merely reloading', async () => {
  // This is the whole point. A deploy replaces the artefact, so a client still
  // running the previous index asks for chunk hashes that no longer exist. The
  // held worker would serve that SAME index to a plain reload, so reloading
  // alone recovers nothing -- it has to take the update first.
  onStaleChunk(takeUpdate);
  void importWithRecovery(() => Promise.reject(chunkError())).catch(() => {});
  await vi.advanceTimersByTimeAsync(0);
  expect(takeUpdate).toHaveBeenCalledTimes(1);
  // ...and it does NOT reload immediately: taking the worker reloads the page
  // itself, and a second reload on top would race it.
  expect(reload).not.toHaveBeenCalled();
});

test('if taking the worker changes nothing, it falls back to a reload', async () => {
  // There may be no waiting worker at all -- a genuinely missing asset, or a
  // cache the browser evicted. Without the fallback the promise never settles
  // and the learner sits on a spinner for ever.
  onStaleChunk(takeUpdate);
  void importWithRecovery(() => Promise.reject(chunkError())).catch(() => {});
  await vi.advanceTimersByTimeAsync(3000);
  expect(reload).toHaveBeenCalledTimes(1);
});

test('the promise never settles, so no error state paints under a reload in flight', async () => {
  onStaleChunk(takeUpdate);
  let settled = false;
  void importWithRecovery(() => Promise.reject(chunkError())).then(
    () => (settled = true),
    () => (settled = true),
  );
  await vi.advanceTimersByTimeAsync(3000);
  expect(settled).toBe(false);
});

test('a second failure in the same session rejects instead of looping', async () => {
  onStaleChunk(takeUpdate);
  void importWithRecovery(() => Promise.reject(chunkError())).catch(() => {});
  await vi.advanceTimersByTimeAsync(3000);
  expect(reload).toHaveBeenCalledTimes(1);

  // The page "came back" and the chunk is still missing: this is not a stale
  // deploy, it is broken, and the learner must see that rather than a loop.
  __resetStaleChunkForTest();
  await expect(importWithRecovery(() => Promise.reject(chunkError()))).rejects.toThrow(/dynamically imported/);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(takeUpdate).toHaveBeenCalledTimes(1);
});

test('an ordinary error is never treated as a stale deploy', async () => {
  // Recovering from a real bug would hide it behind a refresh.
  onStaleChunk(takeUpdate);
  await expect(importWithRecovery(() => Promise.reject(new Error('bad JSON')))).rejects.toThrow('bad JSON');
  expect(takeUpdate).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

test('with no handler registered it still recovers by reloading', async () => {
  // The loader must not depend on the PWA layer having mounted.
  await expect(
    Promise.race([
      importWithRecovery(() => Promise.reject(chunkError())),
      vi.advanceTimersByTimeAsync(3000).then(() => 'timeout'),
    ]),
  ).resolves.toBe('timeout');
  expect(reload).toHaveBeenCalledTimes(1);
});

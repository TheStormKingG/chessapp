import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

const state = { needRefresh: false };
const updateServiceWorker = vi.fn();
let captured: { onRegisteredSW?: (url: string, r?: unknown) => void } = {};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (opts: Record<string, never>) => {
    captured = opts;
    return {
      needRefresh: [state.needRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    };
  },
}));

const { useAppUpdate, UPDATE_CHECK_INTERVAL_MS, LAUNCH_WINDOW_MS } = await import('./useAppUpdate');
const { UPDATE_APPLIED_KEY } = await import('./updatePolicy');

const wrapper =
  (path: string) =>
  ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;

beforeEach(() => {
  state.needRefresh = false;
  captured = {};
  updateServiceWorker.mockClear();
  sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useAppUpdate', () => {
  it('applies a worker that is already waiting at launch, without being asked', () => {
    state.needRefresh = true;
    renderHook(() => useAppUpdate(), { wrapper: wrapper('/') });
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(sessionStorage.getItem(UPDATE_APPLIED_KEY)).toBe('1');
  });

  it.each(['/lesson/L1-1', '/checkpoint/U1', '/play/game'])(
    'leaves the worker waiting when the app launches into %s',
    (path) => {
      state.needRefresh = true;
      const { result } = renderHook(() => useAppUpdate(), { wrapper: wrapper(path) });
      expect(updateServiceWorker).not.toHaveBeenCalled();
      expect(result.current.pending).toBe(true);
    },
  );

  it('reports that an update was applied after the reload, once', () => {
    sessionStorage.setItem(UPDATE_APPLIED_KEY, '1');
    const { result } = renderHook(() => useAppUpdate(), { wrapper: wrapper('/') });
    expect(result.current.justUpdated).toBe(true);
    expect(sessionStorage.getItem(UPDATE_APPLIED_KEY)).toBeNull();
  });

  it('keeps asking the server for a new build while the app stays open', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAppUpdate(), { wrapper: wrapper('/') });
    act(() => captured.onRegisteredSW?.('/sw.js', { update }));
    expect(update).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS));
    expect(update).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS));
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('asks for a new build when a backgrounded app is brought back', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAppUpdate(), { wrapper: wrapper('/') });
    act(() => captured.onRegisteredSW?.('/sw.js', { update }));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('will not reload under a learner who has been using the app for a while', () => {
    const { rerender, result } = renderHook(() => useAppUpdate(), { wrapper: wrapper('/') });
    act(() => void vi.advanceTimersByTime(LAUNCH_WINDOW_MS + 1));
    state.needRefresh = true;
    rerender();
    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);
  });

  it('stops offering the update once the learner has taken it by hand', () => {
    const { rerender, result } = renderHook(() => useAppUpdate(), { wrapper: wrapper('/') });
    act(() => void vi.advanceTimersByTime(LAUNCH_WINDOW_MS + 1));
    state.needRefresh = true;
    rerender();
    expect(result.current.pending).toBe(true);
    act(() => result.current.applyNow());
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(result.current.pending).toBe(false);
  });
});

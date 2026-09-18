import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const state = { needRefresh: true };
const updateServiceWorker = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [state.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

const { UpdateNotice } = await import('./UpdateNotice');
const { UPDATE_APPLIED_KEY } = await import('./updatePolicy');

function at(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <UpdateNotice />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.needRefresh = true;
  updateServiceWorker.mockClear();
  sessionStorage.clear();
});

describe('UpdateNotice', () => {
  it('renders nothing while no worker is waiting and none was applied', () => {
    state.needRefresh = false;
    at('/');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes the update at launch instead of asking, and says so afterwards', () => {
    at('/path');
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Apply now' })).toBeNull();
  });

  it('confirms quietly on the launch that follows an automatic update', () => {
    state.needRefresh = false;
    sessionStorage.setItem(UPDATE_APPLIED_KEY, '1');
    at('/');
    expect(screen.getByRole('status')).toHaveTextContent('ChessApp updated');
    expect(screen.queryByRole('button', { name: 'Apply now' })).toBeNull();
  });

  it.each(['/lesson/L1-1', '/checkpoint/U1', '/play/game'])(
    'holds the update and hides Apply now on %s',
    (path) => {
      at(path);
      expect(updateServiceWorker).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('Update available');
      expect(screen.getByRole('status')).toHaveTextContent('next time you open');
      expect(screen.queryByRole('button', { name: 'Apply now' })).toBeNull();
    },
  );
});

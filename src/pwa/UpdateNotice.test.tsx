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
});

describe('UpdateNotice', () => {
  it('renders nothing while no worker is waiting', () => {
    state.needRefresh = false;
    at('/');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers to apply the update outside an activity', () => {
    at('/path');
    expect(screen.getByRole('status')).toHaveTextContent('Update available');
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeInTheDocument();
  });

  it.each(['/lesson/L1-1', '/checkpoint/U1', '/play/game'])(
    'shows the notice but hides Apply now on %s',
    (path) => {
      at(path);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Apply now' })).toBeNull();
    },
  );
});

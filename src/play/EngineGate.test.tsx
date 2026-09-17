import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { ENGINE_ERROR } from '@/pwa';
import { EngineGate, ENGINE_GATE_DELAY_MS } from './EngineGate';
import { resetEngineReady } from './engineReady';

function stream(bytes: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(bytes));
      c.close();
    },
  });
  return new Response(body, { headers: { 'content-length': String(bytes) } });
}

beforeEach(() => {
  resetEngineReady();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('a cached engine resolves straight to the feature, with no progress bar', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream(8));

  render(
    <EngineGate>
      <p>board</p>
    </EngineGate>,
  );

  expect(await screen.findByText('board')).toBeInTheDocument();
  // F-OF-2: the second visit is served from the SW cache, so the learner must
  // never see a progress bar flash on the way past it.
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('a slow download shows the progress bar once the threshold passes, then the feature', async () => {
  vi.useFakeTimers();
  let release: (r: Response) => void = () => undefined;
  vi.spyOn(globalThis, 'fetch').mockReturnValue(
    new Promise<Response>((r) => {
      release = r;
    }),
  );

  render(
    <EngineGate>
      <p>board</p>
    </EngineGate>,
  );

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText('board')).not.toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(ENGINE_GATE_DELAY_MS);
  });
  expect(screen.getByRole('progressbar')).toBeInTheDocument();

  await act(async () => {
    release(stream(8));
    await vi.runAllTimersAsync();
  });
  expect(screen.getByText('board')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('a failed download explains itself instead of hiding behind the threshold', async () => {
  vi.useFakeTimers();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  render(
    <EngineGate>
      <p>board</p>
    </EngineGate>,
  );

  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(screen.getByRole('alert')).toHaveTextContent(ENGINE_ERROR);
  expect(screen.queryByText('board')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

test('a feature re-mounted after the engine is cached renders straight away', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream(8));
  const { unmount } = render(
    <EngineGate>
      <p>board</p>
    </EngineGate>,
  );
  expect(await screen.findByText('board')).toBeInTheDocument();
  unmount();

  render(
    <EngineGate>
      <p>board</p>
    </EngineGate>,
  );
  // Synchronously, on the first render: no second download UI for a cached file.
  expect(screen.getByText('board')).toBeInTheDocument();
});

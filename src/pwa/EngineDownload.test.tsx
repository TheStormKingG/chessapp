import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EngineDownload } from './EngineDownload';
import { ENGINE_ERROR, downloadEngine } from './downloadEngine';

function streamResponse(chunks: number[], total: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const n of chunks) c.enqueue(new Uint8Array(n));
      c.close();
    },
  });
  return new Response(body, { headers: { 'content-length': String(total) } });
}

describe('downloadEngine', () => {
  it('reports progress against content-length', async () => {
    const seen: number[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(streamResponse([40, 60], 100));
    const bytes = await downloadEngine(
      (p) => {
        seen.push(p.loaded);
        expect(p.total).toBe(100);
      },
      fetchImpl as unknown as typeof fetch,
      '/engine.wasm',
    );
    expect(bytes).toBe(100);
    expect(seen).toEqual([0, 40, 100]);
  });

  it('rejects on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      downloadEngine(() => undefined, fetchImpl as unknown as typeof fetch, '/engine.wasm'),
    ).rejects.toThrow(/503/);
  });
});

describe('EngineDownload', () => {
  it('explains a failure in one line with the size and retries', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(streamResponse([10], 10));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onReady = vi.fn();
    render(<EngineDownload onReady={onReady} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(ENGINE_ERROR);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

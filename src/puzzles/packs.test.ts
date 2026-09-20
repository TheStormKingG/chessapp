import { describe, expect, test, vi, beforeEach } from 'vitest';
import { loadPack, findByRating, LINE_WIDTH, __resetPacks } from './packs';

function pack(rows: { id: string; rating: number; themes: string; fen: string; sol: string }[]) {
  return rows
    .map((r) => [r.id, r.rating, r.themes, r.fen, r.sol].join('\t').padEnd(LINE_WIDTH - 1) + '\n')
    .join('');
}

const ROWS = [
  { id: 'a', rating: 620, themes: 'fork', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', sol: 'a1a2 h1h2' },
  { id: 'b', rating: 700, themes: 'skewer', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', sol: 'a1b1 h1g1' },
  { id: 'c', rating: 880, themes: 'fork', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', sol: 'a1b2 h1g2' },
];

beforeEach(() => {
  __resetPacks();
});

describe('packs', () => {
  test('a pack parses into puzzles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(pack(ROWS))));
    const p = await loadPack('600-900');
    expect(p).toHaveLength(3);
    expect(p[0]?.id).toBe('a');
    expect(p[0]?.rating).toBe(620);
    expect(p[0]?.themes).toEqual(['fork']);
    expect(p[0]?.solution).toEqual(['a1a2', 'h1h2']);
  });

  test('a record carrying several themes parses into several themes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            pack([{ ...ROWS[0]!, themes: 'fork|discoveredAttack' }]),
          ),
      ),
    );
    const p = await loadPack('600-900');
    expect(p[0]?.themes).toEqual(['fork', 'discoveredAttack']);
  });

  test('findByRating returns the window, by binary search', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(pack(ROWS))));
    const p = await loadPack('600-900');
    expect(findByRating(p, 650, 750).map((x) => x.id)).toEqual(['b']);
    expect(findByRating(p, 600, 900).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    // An empty window is a real answer, not an error.
    expect(findByRating(p, 1000, 1100)).toEqual([]);
  });

  test('findByRating is inclusive at both bounds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(pack(ROWS))));
    const p = await loadPack('600-900');
    expect(findByRating(p, 620, 620).map((x) => x.id)).toEqual(['a']);
    expect(findByRating(p, 700, 880).map((x) => x.id)).toEqual(['b', 'c']);
  });

  test('a failed fetch does not poison the module for the session', async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(pack(ROWS)));
    vi.stubGlobal('fetch', f);
    await expect(loadPack('600-900')).rejects.toThrow('offline');
    // Coming back online must work without a reload.
    await expect(loadPack('600-900')).resolves.toHaveLength(3);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('an HTTP error does not poison the module either', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
      .mockResolvedValueOnce(new Response(pack(ROWS)));
    vi.stubGlobal('fetch', f);
    await expect(loadPack('600-900')).rejects.toThrow('404');
    await expect(loadPack('600-900')).resolves.toHaveLength(3);
  });

  test('a pack is fetched once and reused', async () => {
    const f = vi.fn(async () => new Response(pack(ROWS)));
    vi.stubGlobal('fetch', f);
    await loadPack('600-900');
    await loadPack('600-900');
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('two concurrent loads of the same band share one fetch', async () => {
    const f = vi.fn(async () => new Response(pack(ROWS)));
    vi.stubGlobal('fetch', f);
    const [x, y] = await Promise.all([loadPack('600-900'), loadPack('600-900')]);
    expect(x).toHaveLength(3);
    expect(y).toHaveLength(3);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The PWA manifest's start_url and scope must follow the base Vite actually
 * builds with. They used to be `base`, a constant derived from NODE_ENV when
 * the config was evaluated, so `vite build --base=/` rewrote every asset URL
 * but left the manifest scoped to /chessapp/. A relative value is resolved by
 * the browser against the manifest's own URL, which Vite emits at the base,
 * so it is correct for every base without the config having to know it.
 */
const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

function manifestField(name: string): string {
  const m = new RegExp(`${name}:\\s*'([^']*)'`).exec(config);
  expect(m, `${name} is not a string literal in vite.config.ts`).not.toBeNull();
  return m![1]!;
}

test('start_url and scope are not pinned to a build-time base', () => {
  expect(config).not.toMatch(/start_url:\s*base/);
  expect(config).not.toMatch(/scope:\s*base/);
});

test('start_url and scope resolve to whatever base the manifest is served from', () => {
  for (const field of ['start_url', 'scope']) {
    const value = manifestField(field);
    for (const base of ['/', '/chessapp/', '/deep/nested/']) {
      const manifestUrl = `https://example.test${base}manifest.webmanifest`;
      expect(new URL(value, manifestUrl).pathname, `${field} under base ${base}`).toBe(base);
    }
  }
});

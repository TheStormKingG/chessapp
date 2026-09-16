import { readFileSync, statSync } from 'node:fs';

function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test.each([
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/apple-touch-icon.png', 180],
])('%s is %ix%i and under 60 KB', (path, size) => {
  expect(pngSize(path)).toEqual([size, size]);
  expect(statSync(path).size).toBeLessThan(60 * 1024);
});

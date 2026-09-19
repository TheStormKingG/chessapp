/**
 * Measures the review's first pass over a real game at MultiPV 1, in a real
 * browser Worker, at each rung of the depth ladder.
 *
 * PRD F-RV-1 budgets 60 seconds for a 40-move game and shows a partial review
 * past 90. The AnalysisService picks its depth at runtime from a measured rate
 * (design spec section 4.2); the RATIOS between rungs are what this script
 * produces, so that the projection from a depth-14 calibration to a depth-12 or
 * depth-10 run is arithmetic rather than a guess.
 *
 * Usage:
 *   node scripts/measure-review-depth.mjs <path-to-json-with-{fens:[...]}>
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = 'public';
const fixture = process.argv[2];
if (!fixture) {
  console.error('usage: node scripts/measure-review-depth.mjs <fens.json>');
  process.exit(2);
}
const { fens } = JSON.parse(readFileSync(fixture, 'utf8'));
const TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm' };

const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>bench</title><body>ok</body>');
    return;
  }
  try {
    const body = readFileSync(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('no');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const results = {};
for (const depth of [14, 12, 10]) {
  results[depth] = await page.evaluate(
    async ({ fens, depth }) => {
      const w = new Worker('/engine/stockfish-19-lite-single.js');
      const waiters = [];
      w.onmessage = (e) => {
        const l = typeof e.data === 'string' ? e.data : '';
        for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](l)) waiters.splice(i, 1);
      };
      const until = (pred) => new Promise((res) => waiters.push((l) => (pred(l) ? (res(l), true) : false)));
      const go = (cmd) =>
        new Promise((res) => {
          waiters.push((l) => (l.startsWith('bestmove') ? (res(l), true) : false));
          w.postMessage(cmd);
        });
      w.postMessage('uci');
      await until((l) => l === 'uciok');
      w.postMessage('setoption name Hash value 16');
      w.postMessage('setoption name Threads value 1');
      w.postMessage('setoption name MultiPV value 1');
      w.postMessage('ucinewgame');
      w.postMessage('isready');
      await until((l) => l === 'readyok');
      w.postMessage('position fen ' + fens[0]);
      await go('go depth ' + depth); // warm-up, excluded
      const t0 = performance.now();
      for (const fen of fens) {
        w.postMessage('position fen ' + fen);
        await go('go depth ' + depth);
      }
      const total = Math.round(performance.now() - t0);
      w.terminate();
      return { totalMs: total, meanMs: +(total / fens.length).toFixed(1) };
    },
    { fens, depth },
  );
}

const base = results[14].totalMs;
console.log(
  JSON.stringify(
    {
      positions: fens.length,
      perDepth: results,
      ratioToDepth14: { 14: 1, 12: +(results[12].totalMs / base).toFixed(3), 10: +(results[10].totalMs / base).toFixed(3) },
    },
    null,
    1,
  ),
);

await browser.close();
server.close();
process.exit(0);

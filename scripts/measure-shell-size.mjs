import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

/**
 * PRD 11: "App shell under 300 KB of JavaScript compressed."
 *
 * Measures the gzipped bytes of every .js emitted into dist/assets — the app
 * shell. Static data under dist/data and the engine under dist/engine are
 * reported separately and are NOT counted against the budget: neither is
 * JavaScript and neither is on the critical path of first load.
 */

const BUDGET = 300 * 1024;
const dist = 'dist';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(dist);
const shell = files.filter((f) => f.startsWith(join(dist, 'assets')) && f.endsWith('.js'));
const data = files.filter((f) => f.startsWith(join(dist, 'data')));
const engine = files.filter((f) => f.startsWith(join(dist, 'engine')));

const gz = (fs) => fs.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
const raw = (fs) => fs.reduce((n, f) => n + statSync(f).size, 0);

const shellGz = gz(shell);
console.log(
  JSON.stringify(
    {
      shellJsFiles: shell.length,
      shellGzBytes: shellGz,
      shellGzKiB: +(shellGz / 1024).toFixed(1),
      budgetKiB: BUDGET / 1024,
      withinBudget: shellGz <= BUDGET,
      dataRawKiB: +(raw(data) / 1024).toFixed(1),
      dataGzKiB: +(gz(data) / 1024).toFixed(1),
      engineRawKiB: +(raw(engine) / 1024).toFixed(1),
    },
    null,
    1,
  ),
);
if (shellGz > BUDGET) {
  console.error(`SHELL OVER BUDGET: ${shellGz} > ${BUDGET}`);
  process.exit(1);
}

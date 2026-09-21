import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

/**
 * PRD 11: "App shell under 300 KB of JavaScript compressed."
 *
 * THE SHELL IS THE FIRST-LOAD GRAPH, not every .js the build emitted.
 *
 * This script used to sum every file under dist/assets. That was wrong in a
 * way that only showed up once the app had a code split: 35 of the 38 chunks
 * are lesson and checkpoint content, reached through the `import.meta.glob` in
 * `src/lesson/loader.ts` and downloaded when a learner opens a lesson. They
 * are 57.9 KiB gzipped of the number, and they are no more on the critical
 * path of first load than dist/data or dist/engine — which this script has
 * always excluded, for exactly that reason.
 *
 * Counting them did not merely inflate the figure. It inverted the gate:
 * moving 4.9 KiB off first paint into a lazy chunk made the reported total go
 * UP, because a small chunk gzipped on its own compresses worse than the same
 * bytes inside a large one. A budget that punishes code splitting is measuring
 * the wrong thing.
 *
 * So the budget is applied to the entry module and its STATIC import closure —
 * the script tag in dist/index.html plus every `modulepreload` Vite emits
 * beside it, which is by construction what the browser must have before the
 * app renders. Everything else is reported as `allJsGz*` and is not budgeted.
 *
 * A failure to find the entry is a HARD failure. A regex that silently matches
 * nothing would report a 0 KiB shell and a passing budget, which is the one
 * outcome worse than a red build.
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
const allJs = files.filter((f) => f.startsWith(join(dist, 'assets')) && f.endsWith('.js'));
const data = files.filter((f) => f.startsWith(join(dist, 'data')));
const engine = files.filter((f) => f.startsWith(join(dist, 'engine')));

/**
 * The first-load graph, read out of the built index.html rather than guessed
 * from file names: the entry `<script type="module">` and every
 * `<link rel="modulepreload">` Vite emits for the chunks it statically imports.
 */
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const referenced = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1]);

if (referenced.length === 0) {
  console.error('MEASURE FAILED: no entry module found in dist/index.html');
  process.exit(2);
}

// The hrefs carry the build's `base`, so they are matched by basename against
// what is actually on disk. A referenced file that is not there is a hard
// failure for the same reason an unmatched regex is.
const shell = referenced.map((href) => {
  const name = href.split('/').pop();
  const hit = allJs.find((f) => f.endsWith(join(dist, 'assets', name).slice(dist.length)));
  if (!hit) {
    console.error(`MEASURE FAILED: dist/index.html references ${href}, which is not in dist/assets`);
    process.exit(2);
  }
  return hit;
});

const gz = (fs) => fs.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
const raw = (fs) => fs.reduce((n, f) => n + statSync(f).size, 0);

const shellGz = gz(shell);
// The largest single lesson/checkpoint chunk: what a learner fetches on top of
// the shell to reach one lesson. Zero if content is not split into chunks.
const lessonChunks = allJs.filter((f) => /\/(lesson|checkpoint)-[^/]*\.js$/.test(f));
const biggestLessonGz = lessonChunks.length
  ? Math.max(...lessonChunks.map((f) => gz([f])))
  : 0;

console.log(
  JSON.stringify(
    {
      shellJsFiles: shell.length,
      shellGzBytes: shellGz,
      shellGzKiB: +(shellGz / 1024).toFixed(1),
      budgetKiB: BUDGET / 1024,
      headroomKiB: +((BUDGET - shellGz) / 1024).toFixed(1),
      withinBudget: shellGz <= BUDGET,
      // Every emitted chunk, lazy ones included. Reported, NOT budgeted: these
      // are downloaded on demand and are not on the critical path.
      allJsFiles: allJs.length,
      allJsGzKiB: +(gz(allJs) / 1024).toFixed(1),
      /**
       * The shell gate measures FIRST LOAD, which is the right reading of PRD
       * 11's "app shell under 300 KB". But it means lazy-loading anything
       * removes it from the gate, so the gate alone cannot stop total JS
       * growing without limit.
       *
       * PRD 11's next clause is what bounds that — "time to first lesson under
       * five seconds" — and a learner reaching their first lesson fetches the
       * shell PLUS one lesson chunk. This is that number. It is reported, not
       * gated: the five-second promise is about a connection and a device, not
       * about bytes, so a threshold here would be invented rather than
       * specified. It exists so the trade cannot be made silently.
       */
      firstLessonGzKiB: +((shellGz + biggestLessonGz) / 1024).toFixed(1),
      biggestLessonGzKiB: +(biggestLessonGz / 1024).toFixed(1),
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

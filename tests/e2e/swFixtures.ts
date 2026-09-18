import { spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

/**
 * Two real production builds of this app, served one at a time, so a test can
 * play out a deploy against a browser that already has the old build installed.
 *
 * Build A is what ships. Build B is the same source built unminified: that is
 * enough to give every emitted chunk a different content hash, which in turn
 * gives `index.html` different asset URLs and `sw.js` a different precache
 * manifest. The point is that B is a genuinely different artefact — not build A
 * with a touched mtime, which a service worker would byte-compare and ignore.
 */

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '..', '..');

export type Fixture = {
  dir: string;
  /** Absolute-from-root URL of the entry module, e.g. `/assets/index-CVrm1wUt.js`. */
  entry: string;
};

export type Fixtures = { a: Fixture; b: Fixture };

function entryOf(dir: string): string {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const m = /<script[^>]+src="([^"]+\.js)"/.exec(html);
  if (!m?.[1]) throw new Error(`no entry module found in ${dir}/index.html`);
  return m[1];
}

function build(outDir: string, extraArgs: string[]): void {
  const r = spawnSync(
    process.execPath,
    [join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--base=/', '--outDir', outDir, '--emptyOutDir', ...extraArgs],
    { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } },
  );
  if (r.status !== 0) {
    throw new Error(`vite build into ${outDir} failed (status ${String(r.status)}):\n${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  }
}

/**
 * Build A and B into a directory of this suite's own, never into `dist-e2e`,
 * which the preview server and other runs share — a shared output directory
 * makes a failure unattributable to the run that produced it.
 */
export async function buildFixtures(): Promise<Fixtures> {
  const base = join(REPO_ROOT, 'dist-e2e-sw');
  await rm(base, { recursive: true, force: true });
  await mkdir(base, { recursive: true });

  const aDir = join(base, 'a');
  const bDir = join(base, 'b');
  build(aDir, []);
  build(bDir, ['--minify', 'false']);

  const a = { dir: aDir, entry: entryOf(aDir) };
  const b = { dir: bDir, entry: entryOf(bDir) };

  // The whole rig is worthless if the two builds are not actually different:
  // every assertion downstream would pass on A and read as proof of an upgrade.
  if (a.entry === b.entry) {
    throw new Error(`fixture builds are identical (both entry ${a.entry}) — build B is not a different build`);
  }
  const swA = readFileSync(join(aDir, 'sw.js'), 'utf8');
  const swB = readFileSync(join(bDir, 'sw.js'), 'utf8');
  if (swA === swB) throw new Error('fixture builds emitted an identical sw.js — the precache manifests did not change');

  return { a, b };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

export type SwapServer = {
  origin: string;
  /** Point the server at a different build. The next request serves that build. */
  serve: (fixture: Fixture) => void;
  close: () => Promise<void>;
};

/**
 * A static server whose document root can be swapped between requests — this is
 * what "a deploy happened" means to a browser that is already installed.
 *
 * Deliberately NOT an SPA catch-all for asset paths: a request for a hashed
 * asset that is no longer on the server must 404, exactly as it would on a real
 * host. Falling back to `index.html` there is how a missing asset gets masked.
 */
export function startSwapServer(initial: Fixture): Promise<SwapServer> {
  let root = initial.dir;

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    let file = join(root, rel === '' ? 'index.html' : rel);

    if (!existsSync(file) || statSync(file).isDirectory()) {
      // A navigation, and only a navigation, falls back to the shell. Keyed on
      // the request mode rather than on the absence of a file extension, because
      // client routes carry dots too (`/lesson/1.1.1`) and would 404.
      const navigation =
        req.headers['sec-fetch-mode'] === 'navigate' || (req.headers.accept ?? '').includes('text/html');
      if (navigation) {
        file = join(root, 'index.html');
      } else {
        res.writeHead(404, { 'Cache-Control': 'no-store' });
        res.end('not found');
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // The HTTP cache must not stand in for the service worker cache; what is
      // under test is which build the worker serves, not which one Chromium kept.
      'Cache-Control': 'no-store',
    });
    res.end(readFileSync(file));
  });

  return new Promise((ok, fail) => {
    server.once('error', fail);
    // Port 0: the OS picks a free one, so this never contends with the dev
    // server, the preview server, or another run of this suite.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      ok({
        // `localhost`, not `127.0.0.1`: a service worker needs a secure context.
        origin: `http://localhost:${String(port)}`,
        serve: (f) => {
          root = f.dir;
        },
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}

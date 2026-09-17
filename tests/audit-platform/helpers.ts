import { expect } from '@playwright/test';
import type { ConsoleMessage, Page } from '@playwright/test';

/** Settings -> "Text move entry". Every audit spec drives the board by text. */
export async function enableTextEntry(page: Page): Promise<void> {
  await page.goto('./settings');
  await page.getByLabel('Text move entry').check();
}

export async function typeMove(page: Page, text: string): Promise<void> {
  const input = page.getByLabel('Type a move');
  await input.fill(text);
  await input.press('Enter');
}

export interface Captured {
  type: string;
  text: string;
  location: string;
}

/**
 * Capture EVERY console message and page error, unfiltered. A marker is logged
 * first so a stale entry from a previous navigation is distinguishable from a
 * live one: `mark()` returns the index the caller should slice from.
 */
export function captureConsole(page: Page): {
  all: Captured[];
  mark: (label: string) => Promise<number>;
  problems: (from?: number) => Captured[];
} {
  const all: Captured[] = [];
  page.on('console', (m: ConsoleMessage) => {
    const l = m.location();
    all.push({ type: m.type(), text: m.text(), location: `${l.url}:${String(l.lineNumber)}` });
  });
  page.on('pageerror', (e) => {
    all.push({ type: 'pageerror', text: e.message, location: '' });
  });
  return {
    all,
    mark: async (label: string) => {
      await page.evaluate((s) => {
        console.info(`AUDIT-MARK ${s}`);
      }, label);
      return all.length;
    },
    problems: (from = 0) =>
      all.slice(from).filter((m) => m.type === 'error' || m.type === 'warning' || m.type === 'pageerror'),
  };
}

/** Start a game against Rosa from /play with explicit options. */
export async function startGame(
  page: Page,
  o: { tc?: 'Untimed' | '10 + 0'; colour?: 'White' | 'Black'; coach?: boolean } = {},
): Promise<void> {
  await page.goto('./play');
  if (o.tc) await page.getByRole('button', { name: o.tc, exact: true }).click();
  if (o.colour) await page.getByRole('button', { name: o.colour, exact: true }).click();
  if (o.coach === false) await page.getByRole('checkbox', { name: /coach mode/i }).uncheck();
  await page.getByRole('button', { name: 'Start game' }).click();
}

/** Read every learner event of a given type straight out of IndexedDB. */
export async function readEvents(page: Page, type: string): Promise<unknown[]> {
  return page.evaluate(async (t) => {
    // Never call indexedDB.open() blind: on a database the app has not created
    // yet (or has just deleted) that CREATES an empty version-1 database and
    // blocks Dexie's own upgrade. Only read a database that already exists.
    const names = (await indexedDB.databases()).map((d) => d.name);
    if (!names.includes('chessapp')) return [];
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const req = indexedDB.open('chessapp');
      req.onerror = () => {
        reject(new Error('open failed'));
      };
      req.onsuccess = () => {
        const dbh = req.result;
        if (!dbh.objectStoreNames.contains('events')) {
          dbh.close();
          resolve([]);
          return;
        }
        const tx = dbh.transaction('events', 'readonly');
        const get = tx.objectStore('events').getAll();
        get.onsuccess = () => {
          const rows = get.result as unknown[];
          // Close, or this read connection blocks the app's own
          // `db.delete()` and the measurement becomes a measurement of the
          // instrument.
          dbh.close();
          resolve(rows);
        };
        get.onerror = () => {
          dbh.close();
          reject(new Error('getAll failed'));
        };
      };
    });
    return rows.filter((r) => (r as { payload?: { type?: string } }).payload?.type === t);
  }, type);
}

/**
 * Resign, through the confirmation the destructive action now sits behind
 * (chunk C4 / M-2: an irreversible action is distinguishable and confirmable).
 * The quiet Resign opens the panel; the danger-styled Resign inside it commits,
 * so the same accessible name is clicked twice and never exists twice at once.
 */
export async function resign(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Resign' }).click();
  await expect(page.getByRole('heading', { name: 'Resign this game?' })).toBeVisible();
  await page.getByRole('button', { name: 'Resign' }).click();
}

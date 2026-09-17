import { db } from '@/data';

/**
 * "Clear this device's data" promises "every lesson, game and setting stored
 * on this device". Progress lives in IndexedDB, but the settings do not: they
 * are in localStorage under `chessapp-settings` (zustand persist), alongside
 * the install-prompt dismissal and the Today cool-down. Clearing the database
 * alone left all three behind, so the action did not match its confirmation.
 *
 * Keys are removed by prefix rather than by list so a future `chessapp.*` key
 * is cleared by default instead of silently surviving.
 */
export const CHESSAPP_STORAGE_PREFIX = 'chessapp';

export function clearLocalStorage(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CHESSAPP_STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Private-mode storage can throw; the database delete below still runs.
  }
}

export async function clearDeviceData(): Promise<void> {
  clearLocalStorage();
  await db.delete();
}

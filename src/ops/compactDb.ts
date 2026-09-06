import { getOpenedDatabase, nativeDbAvailable } from '../db/database';

const COMPACT_IDLE_MS = 30_000;
let compactTimer: ReturnType<typeof setTimeout> | null = null;

/** Periodic compact — not per photo delete. */
export async function compactDatabase(): Promise<void> {
  const db = getOpenedDatabase();
  if (!nativeDbAvailable() || !db) return;
  const anyDb = db as { performMaintenance?: (type: unknown) => Promise<void>; compact?: () => Promise<void> };
  if (typeof anyDb.compact === 'function') await anyDb.compact();
}

/** Debounce compact after blob deletes — one timer, reset on each delete. */
export function scheduleCompactSoon(delayMs = COMPACT_IDLE_MS): void {
  if (compactTimer) clearTimeout(compactTimer);
  compactTimer = setTimeout(() => {
    compactTimer = null;
    void compactDatabase();
  }, delayMs);
}

export function compactIsScheduled(): boolean {
  return compactTimer != null;
}

export function clearCompactSchedule(): void {
  if (compactTimer) clearTimeout(compactTimer);
  compactTimer = null;
}

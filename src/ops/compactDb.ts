import { getOpenedDatabase, nativeDbAvailable } from '../db/database';

/** Periodic compact — not per photo delete. */
export async function compactDatabase(): Promise<void> {
  const db = getOpenedDatabase();
  if (!nativeDbAvailable() || !db) return;
  const anyDb = db as { performMaintenance?: (type: unknown) => Promise<void>; compact?: () => Promise<void> };
  if (typeof anyDb.compact === 'function') await anyDb.compact();
}

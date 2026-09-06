import {
  FIELD_COLLECTIONS,
  FIELD_SCOPE,
  LOCAL_SCOPE,
  TMP_COLLECTION,
} from '../db/collections';
import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memoryAll } from '../db/memoryStore';

export type CollectionCountRow = {
  scope: string;
  name: string;
  count: number | null;
  replicated: boolean;
};

async function countNative(name: string, scope: string): Promise<number | null> {
  const col = await collectionOf(name, scope);
  if (col && typeof (col as { count?: unknown }).count === 'function') {
    try {
      const raw = await (col as { count: () => Promise<unknown> }).count();
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (raw && typeof raw === 'object' && typeof (raw as { count?: unknown }).count === 'number') {
        return (raw as { count: number }).count;
      }
    } catch {
      // fall through
    }
  }
  const db = getOpenedDatabase();
  if (!db) return null;
  try {
    const sql = `SELECT COUNT(1) AS n FROM ${scope}.${name}`;
    const query = db.createQuery(sql);
    const raw = await query.execute();
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const first = rows[0] as { n?: unknown; getValue?: (k: string) => unknown } | undefined;
    if (!first) return 0;
    const n = typeof first.getValue === 'function' ? first.getValue('n') : first.n;
    const num = Number(n);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

export async function collectionCounts(): Promise<CollectionCountRow[]> {
  const native = nativeDbAvailable() && getOpenedDatabase();
  const rows: CollectionCountRow[] = [];
  for (const name of FIELD_COLLECTIONS) {
    const count = native ? await countNative(name, FIELD_SCOPE) : memoryAll(name).length;
    rows.push({ scope: FIELD_SCOPE, name, count, replicated: true });
  }
  const tmpCount = native ? await countNative(TMP_COLLECTION, LOCAL_SCOPE) : memoryAll(TMP_COLLECTION).length;
  rows.push({ scope: LOCAL_SCOPE, name: TMP_COLLECTION, count: tmpCount, replicated: false });
  return rows;
}

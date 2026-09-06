import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memoryAll, memoryDelete, memoryGet, memorySave } from '../db/memoryStore';
import { runQuery } from '../db/query';
import { saveJsonDoc } from '../db/saveJson';
import { documentToObject } from './workOrderIn';

/** `null` means use the in-memory store (Expo Go / tests). */
export async function queryChildRowsIfNative(
  sql: string,
  params: Record<string, string | number> = {},
): Promise<Record<string, unknown>[] | null> {
  if (!nativeDbAvailable() || !getOpenedDatabase()) return null;
  return runQuery(getOpenedDatabase()!, sql, params);
}

export async function loadChild(collection: string, id: string): Promise<Record<string, unknown> | null> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf(collection)) as {
      document: (docId: string) => Promise<unknown>;
    } | null;
    if (!col) return null;
    return documentToObject(await col.document(id));
  }
  return memoryGet(collection, id);
}

export async function saveChild(collection: string, id: string, body: Record<string, unknown>): Promise<void> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf(collection)) as {
      save: (doc: unknown) => Promise<void>;
    } | null;
    if (!col) throw new Error('missing');
    await saveJsonDoc(col, id, body);
    return;
  }
  memorySave(collection, id, body);
}

export async function deleteChild(collection: string, id: string): Promise<void> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf(collection)) as {
      purge?: (docId: string) => Promise<void>;
    } | null;
    if (col?.purge) await col.purge(id);
    return;
  }
  memoryDelete(collection, id);
}

export function listChildrenMemory(
  collection: string,
  pred: (id: string, doc: Record<string, unknown>) => boolean,
): Array<{ id: string; doc: Record<string, unknown> }> {
  return memoryAll(collection).filter((row) => pred(row.id, row.doc));
}

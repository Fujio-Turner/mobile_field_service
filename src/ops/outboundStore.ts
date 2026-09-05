import { FIELD_SCOPE } from '../db/collections';
import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memoryGet, memorySave } from '../db/memoryStore';
import { saveJsonDoc } from '../db/saveJson';
import { documentToObject } from './workOrderIn';

export async function loadOutboundRaw(id: string): Promise<Record<string, unknown> | null> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const db = getOpenedDatabase();
    const col = (await db!.collection('workordersout', FIELD_SCOPE)) as {
      document: (docId: string) => Promise<unknown>;
    } | null;
    if (!col) return null;
    return documentToObject(await col.document(id));
  }
  return memoryGet('workordersout', id);
}

export async function saveOutboundRaw(id: string, body: Record<string, unknown>): Promise<void> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const db = getOpenedDatabase();
    const col = (await db!.collection('workordersout', FIELD_SCOPE)) as {
      save: (doc: unknown) => Promise<void>;
    } | null;
    if (!col) throw new Error('missing');
    await saveJsonDoc(col, id, body);
    return;
  }
  memorySave('workordersout', id, body);
}

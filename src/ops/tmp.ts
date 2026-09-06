import { stampAuditCreate } from '../audit';
import { LOCAL_SCOPE, TMP_COLLECTION } from '../db/collections';
import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memoryDelete, memoryGet, memorySave } from '../db/memoryStore';
import { saveJsonDoc } from '../db/saveJson';
import { tmpExpiryDate, TMP_TTL_MS } from '../db/tmp';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import type { StartSession } from './copyInbound';
import { documentToObject } from './workOrderIn';

export { TMP_TTL_MS, tmpExpiryDate };

export function buildPhotoStageTmp(input: {
  tmpId: string;
  wooutId?: string;
  orderId?: string;
  localUri: string;
  session: StartSession;
  dt: number;
  ver: string;
}): Record<string, unknown> {
  return stampAuditCreate(
    {
      type: 'tmp',
      kind: 'photo_stage',
      workOrderOutId: input.wooutId,
      orderId: input.orderId,
      localUri: input.localUri,
      expiresAt: Math.floor(tmpExpiryDate(input.dt * 1000).getTime() / 1000),
    },
    { by: input.session.username, ver: input.ver, dt: input.dt },
  );
}

export async function saveTmp(id: string, body: Record<string, unknown>): Promise<void> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf(TMP_COLLECTION, LOCAL_SCOPE)) as {
      save: (doc: unknown) => Promise<void>;
      setDocumentExpiration?: (docId: string, date: Date) => Promise<void>;
    } | null;
    if (!col) throw new Error('missing');
    await saveJsonDoc(col, id, body);
    if (typeof col.setDocumentExpiration === 'function') {
      await col.setDocumentExpiration(id, tmpExpiryDate());
    }
    return;
  }
  memorySave(TMP_COLLECTION, id, body);
}

export async function loadTmp(id: string): Promise<Record<string, unknown> | null> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf(TMP_COLLECTION, LOCAL_SCOPE)) as {
      document: (docId: string) => Promise<unknown>;
    } | null;
    if (!col) return null;
    return documentToObject(await col.document(id));
  }
  return memoryGet(TMP_COLLECTION, id);
}

export async function purgeTmp(id: string): Promise<void> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf(TMP_COLLECTION, LOCAL_SCOPE)) as {
      purge?: (docId: string) => Promise<void>;
    } | null;
    if (col?.purge) await col.purge(id);
    return;
  }
  memoryDelete(TMP_COLLECTION, id);
}

export function newTmpId(): string {
  return newDocId('tmp');
}

export function tmpIsExpired(doc: Record<string, unknown>, nowSec: number): boolean {
  const exp = Number(doc.expiresAt ?? 0);
  return exp > 0 && exp <= nowSec;
}

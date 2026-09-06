import { log } from '../log/logger';
import type { StartSession } from '../ops/copyInbound';
import { reconcileDuplicateOutbound } from '../ops/reconcileDuplicateOutbound';
import { setOrderSyncState, setSyncState } from '../ops/setSyncState';

export type ReplicatedDocEvent = {
  id: string;
  collection: string;
  isPush: boolean;
  error?: { code?: number | string; message?: string };
};

export function parseReplicatedDocs(change: unknown): ReplicatedDocEvent[] {
  const c = change as {
    isPush?: boolean;
    direction?: string;
    documents?: Array<{
      id?: string;
      collection?: string;
      collectionName?: string;
      isPush?: boolean;
      error?: { code?: number | string; message?: string } | string;
    }>;
  };
  const parentPush = c.isPush === true || c.direction === 'PUSH' || c.direction === 'push';
  return (c.documents ?? [])
    .filter((d) => d.id)
    .map((d) => {
      const err = d.error;
      const error =
        err == null
          ? undefined
          : typeof err === 'string'
            ? { message: err }
            : { code: err.code, message: err.message };
      return {
        id: String(d.id),
        collection: String(d.collectionName ?? d.collection ?? ''),
        isPush: d.isPush ?? parentPush,
        error,
      };
    });
}

export async function handleReplicatedDoc(ev: ReplicatedDocEvent, session: StartSession): Promise<void> {
  const errCode = ev.error?.code != null ? String(ev.error.code) : ev.error ? 'error' : undefined;
  const actionable = ev.collection === 'workordersout' || ev.collection === 'orders';
  if (!actionable) {
    if (ev.error) {
      log.warn('mfs.repl.doc', {
        op: 'OnReplicatedDoc',
        collection: ev.collection,
        docId: ev.id,
        isPush: ev.isPush,
        errCode,
      });
    }
    return;
  }
  try {
    if (ev.isPush && ev.collection === 'workordersout') {
      if (ev.error) await setSyncState(ev.id, 'push_error', session, errCode);
      else await setSyncState(ev.id, 'pushed', session);
      return;
    }
    if (ev.isPush && ev.collection === 'orders') {
      if (ev.error) await setOrderSyncState(ev.id, 'push_error', session, errCode);
      else await setOrderSyncState(ev.id, 'pushed', session);
      return;
    }
    if (!ev.isPush && ev.collection === 'workordersout' && !ev.error) {
      await reconcileDuplicateOutbound(ev.id, session.employeeId);
    }
  } catch {
    log.warn('mfs.repl.doc', { op: 'OnReplicatedDoc', collection: ev.collection, docId: ev.id, errCode: 'handler' });
  }
}

import { log } from '../log/logger';
import type { StartSession } from '../ops/copyInbound';
import { reconcileDuplicateOutbound } from '../ops/reconcileDuplicateOutbound';
import { setOrderSyncState, setSyncState } from '../ops/setSyncState';
import { classifyReplError, extractErrorCode, isDocumentAuthFailure, type ReplErrorClass } from './codes';
import { conflictPolicyFor } from './conflicts';
import { recordReplicatedDoc } from './replStats';

export type ReplicatedDocEvent = {
  id: string;
  collection: string;
  isPush: boolean;
  flags?: string[];
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
      flags?: string[];
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
            ? { message: err, code: extractErrorCode(err) }
            : { code: extractErrorCode(err) ?? err.code, message: err.message };
      return {
        id: String(d.id),
        collection: String(d.collectionName ?? d.collection ?? ''),
        isPush: d.isPush ?? parentPush,
        flags: d.flags,
        error,
      };
    });
}

export function logReplHttpError(
  ev: ReplicatedDocEvent,
  cls: ReplErrorClass,
  code: number | undefined,
): void {
  const fields = {
    op: 'OnReplicatedDoc',
    collection: ev.collection,
    docId: ev.id,
    isPush: ev.isPush,
    errCode: code,
    errClass: cls,
  };
  switch (cls) {
    case 'auth':
      log.error('mfs.repl.doc_auth', fields);
      break;
    case 'not_found':
      log.warn('mfs.repl.doc_not_found', fields);
      break;
    case 'conflict':
      log.warn('mfs.repl.conflict', {
        ...fields,
        policy: conflictPolicyFor(ev.collection).strategy,
      });
      break;
    case 'forbidden':
      log.warn('mfs.repl.doc_forbidden', fields);
      break;
    case 'payload':
      log.error('mfs.repl.doc_payload', fields);
      break;
    case 'timeout':
    case 'rate_limit':
    case 'transient':
      log.warn('mfs.repl.doc_transient', fields);
      break;
    case 'tls':
      log.error('mfs.repl.doc_tls', fields);
      break;
    case 'client':
      log.warn('mfs.repl.doc_client', fields);
      break;
    default:
      log.warn('mfs.repl.doc', fields);
  }
}

export async function handleReplicatedDoc(ev: ReplicatedDocEvent, session: StartSession): Promise<void> {
  const code = extractErrorCode(ev.error);
  const cls = recordReplicatedDoc(ev);
  if (cls) logReplHttpError(ev, cls, code);

  const errCode = code != null ? String(code) : ev.error ? 'error' : undefined;
  const actionable = ev.collection === 'workordersout' || ev.collection === 'orders';
  if (!actionable) return;
  if (isDocumentAuthFailure(code)) return;
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


import { nowSec, stampAuditUpdate } from '../audit';
import { appVersion } from '../version';
import { loadChild, saveChild } from './childStore';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';

export function shouldWriteSyncState(
  doc: Record<string, unknown>,
  syncState: 'ready_to_push' | 'pushed' | 'push_error',
  lastPushErrorCode?: string,
): boolean {
  if (String(doc.syncState) !== syncState) return true;
  if (syncState === 'push_error') {
    return String(doc.lastPushErrorCode ?? '') !== String(lastPushErrorCode ?? '');
  }
  return false;
}

export function applySyncState(
  doc: Record<string, unknown>,
  syncState: 'ready_to_push' | 'pushed' | 'push_error',
  session: StartSession,
  lastPushErrorCode?: string,
  dt = nowSec(),
  ver = appVersion(),
): Record<string, unknown> {
  const historyLen = Array.isArray(doc.history) ? doc.history.length : 0;
  let next: Record<string, unknown> = {
    ...doc,
    syncState,
  };
  if (lastPushErrorCode != null) next.lastPushErrorCode = lastPushErrorCode;
  else delete next.lastPushErrorCode;
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  if (Array.isArray(next.history) && next.history.length !== historyLen) {
    next = { ...next, history: doc.history };
  }
  return next;
}

export async function setSyncState(
  id: string,
  syncState: 'ready_to_push' | 'pushed' | 'push_error',
  session: StartSession,
  lastPushErrorCode?: string,
): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  if (!shouldWriteSyncState(doc, syncState, lastPushErrorCode)) return;
  await saveOutboundRaw(id, applySyncState(doc, syncState, session, lastPushErrorCode));
}

export async function setOrderSyncState(
  id: string,
  syncState: 'ready_to_push' | 'pushed' | 'push_error',
  session: StartSession,
  lastPushErrorCode?: string,
): Promise<void> {
  const doc = await loadChild('orders', id);
  if (!doc) return;
  if (!shouldWriteSyncState(doc, syncState, lastPushErrorCode)) return;
  await saveChild('orders', id, applySyncState(doc, syncState, session, lastPushErrorCode));
}

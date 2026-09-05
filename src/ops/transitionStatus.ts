import { nowSec, stampAuditUpdate, stampHistory } from '../audit';
import { appVersion } from '../version';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import {
  canTransition,
  completeBlockedReason,
  isBlockReason,
  isFrozen,
  nextStatus,
  type TaskLike,
} from './outStatus';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
import { listTasksForWork } from './tasks';

export function applyTransition(
  doc: Record<string, unknown>,
  op: 'StartOrResumeWork' | 'BlockWork' | 'CompleteWork' | 'CancelWork',
  session: StartSession,
  extra?: { blockedReason?: string; blockedNote?: string; cancelledReason?: string; tasks?: TaskLike[] },
  dt = nowSec(),
  ver = appVersion(),
): Record<string, unknown> {
  if (isFrozen(doc)) throw new OutError('frozen');
  const from = String(doc.status ?? '');
  if (!canTransition(from, op)) throw new OutError('illegal_transition');
  if (op === 'BlockWork') {
    if (!extra?.blockedReason || !isBlockReason(extra.blockedReason) || !extra.blockedNote?.trim()) {
      throw new OutError('reason_required');
    }
  }
  if (op === 'CancelWork' && !extra?.cancelledReason?.trim()) throw new OutError('reason_required');
  if (op === 'CompleteWork') {
    const why = completeBlockedReason(doc, extra?.tasks);
    if (why) throw new OutError('incomplete', why);
  }
  const to = nextStatus(op);
  let next: Record<string, unknown> = {
    ...doc,
    status: to,
    statusChangedAt: dt,
  };
  if (op === 'BlockWork') {
    next.blockedReason = extra!.blockedReason;
    next.blockedNote = extra!.blockedNote;
  } else {
    delete next.blockedReason;
    delete next.blockedNote;
  }
  if (op === 'CompleteWork' || op === 'CancelWork') {
    next.owner = 'backend';
    if (op === 'CompleteWork') next.completedAt = dt;
    if (op === 'CancelWork') {
      next.cancelledAt = dt;
      next.cancelledReason = extra!.cancelledReason;
    }
  }
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  return stampHistory(next as never, {
    op,
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'status', from, to }],
  });
}

export async function startOrResumeWork(id: string, session: StartSession): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  await saveOutboundRaw(id, applyTransition(doc, 'StartOrResumeWork', session));
}

export async function blockWork(
  id: string,
  session: StartSession,
  blockedReason: string,
  blockedNote: string,
): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  await saveOutboundRaw(id, applyTransition(doc, 'BlockWork', session, { blockedReason, blockedNote }));
}

export async function completeWork(id: string, session: StartSession): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  const tasks = await listTasksForWork(id);
  await saveOutboundRaw(id, applyTransition(doc, 'CompleteWork', session, { tasks }));
}

export async function cancelWork(id: string, session: StartSession, cancelledReason: string): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  await saveOutboundRaw(id, applyTransition(doc, 'CancelWork', session, { cancelledReason }));
}

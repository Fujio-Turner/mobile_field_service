import { stampAuditCreate, stampHistory } from '../audit';
import type { AssignedTo } from './workOrderIn';

const DROP_FROM_COPY = new Set([
  'type',
  'audit',
  'photos',
  'syncState',
  'source',
  'embedding',
  'history',
  'historyTruncated',
  'readyToPush',
  'lastAction',
  '_id',
  '_rev',
  '_attachments',
]);

export type StartSession = AssignedTo & { username: string; email: string; employeeId: string };

export function inboundSnapshot(inboundRaw: Record<string, unknown>, inboundId: string): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inboundRaw)) {
    if (k === 'embedding' || k.startsWith('photo:')) continue;
    snapshot[k] = v;
  }
  return { id: inboundId, collection: 'workordersin', snapshot };
}

export function buildWorkOrderOut(input: {
  inboundRaw: Record<string, unknown>;
  inboundId: string;
  outId: string;
  session: StartSession;
  ver: string;
  dt: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input.inboundRaw)) {
    if (DROP_FROM_COPY.has(k) || k.startsWith('photo:')) continue;
    body[k] = v;
  }
  body.type = 'workorderout';
  body.role = 'primary';
  body.owner = 'technician';
  body.status = 'assigned';
  body.syncState = 'local_draft';
  body.source = inboundSnapshot(input.inboundRaw, input.inboundId);
  body.assignedTo = {
    userId: input.session.userId,
    employeeId: input.session.employeeId,
    email: input.session.email,
    username: input.session.username,
    displayName: input.session.displayName ?? input.session.username,
  };
  const created = stampAuditCreate(body, {
    by: input.session.username,
    ver: input.ver,
    dt: input.dt,
  });
  return stampHistory(created, {
    op: 'StartWork',
    by: input.session.username,
    ver: input.ver,
    dt: input.dt,
    changes: [
      { path: 'status', to: 'assigned' },
      { path: 'source.id', to: input.inboundId },
    ],
  });
}

export function pickOldestPrimary(
  candidates: Array<{ id: string; auditCrDt: number }>,
): string | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.auditCrDt - b.auditCrDt || a.id.localeCompare(b.id));
  return sorted[0].id;
}

export function assertInboundStartable(
  inbound: Record<string, unknown>,
  employeeId: string,
): 'ok' | 'inbound_not_startable' | 'inbound_not_assigned' {
  const status = String(inbound.status ?? '');
  if (status === 'cancelled' || status === 'superseded') return 'inbound_not_startable';
  const assigned = (inbound.assignedTo ?? {}) as { employeeId?: string };
  if (assigned.employeeId !== employeeId) return 'inbound_not_assigned';
  return 'ok';
}

import { nowSec, stampAuditCreate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { isFrozen } from './outStatus';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';

export function buildAmendment(
  original: Record<string, unknown>,
  originalId: string,
  newId: string,
  session: StartSession,
  dt = nowSec(),
  ver = appVersion(),
): Record<string, unknown> {
  if (!isFrozen(original)) throw new OutError('not_frozen');
  const source = original.source;
  let body: Record<string, unknown> = {
    type: 'workorderout',
    role: 'amendment',
    owner: 'technician',
    status: 'assigned',
    syncState: 'local_draft',
    number: original.number,
    priority: original.priority,
    customerId: original.customerId,
    site: original.site,
    scheduled: original.scheduled,
    summary: original.summary,
    source,
    amends: {
      id: originalId,
      number: original.number,
      completedAt: original.completedAt ?? original.cancelledAt,
    },
    photos: [],
    operations: [],
    checklist: [],
    assignedTo: {
      userId: session.userId,
      employeeId: session.employeeId,
      email: session.email,
      username: session.username,
      displayName: session.displayName ?? session.username,
    },
  };
  body = stampAuditCreate(body, { by: session.username, ver, dt });
  return stampHistory(body as never, {
    op: 'CreateAmendment',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'amends.id', to: originalId }],
  });
}

export async function createAmendment(wooutId: string, session: StartSession): Promise<{ wooutId: string }> {
  const original = await loadOutboundRaw(wooutId);
  if (!original) throw new OutError('missing');
  const newId = newDocId('woout');
  await saveOutboundRaw(newId, buildAmendment(original, wooutId, newId, session));
  return { wooutId: newId };
}

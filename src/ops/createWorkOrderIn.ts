import { nowSec, stampAuditCreate, stampHistory } from '../audit';
import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memorySave } from '../db/memoryStore';
import { saveJsonDoc } from '../db/saveJson';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import type { StartSession } from './copyInbound';

export class CreateWorkOrderInError extends Error {
  constructor(public code: 'summary_empty') {
    super(code);
    this.name = 'CreateWorkOrderInError';
  }
}

export function buildFieldInbound(input: {
  woinId: string;
  session: StartSession;
  summary: string;
  kind?: string;
  site?: Record<string, unknown>;
  scheduled?: Record<string, unknown>;
  customerId?: string;
  assetIds?: string[];
  orderId?: string;
  ver: string;
  dt: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: 'workorderin',
    origin: 'field',
    status: 'assigned',
    priority: 'normal',
    number: input.woinId.replace('woin:', 'WO-'),
    summary: input.summary,
    kind: input.kind,
    site: input.site ?? { name: '' },
    scheduled: input.scheduled,
    customerId: input.customerId,
    assetIds: input.assetIds ?? [],
    orderId: input.orderId,
    readyToPush: true,
    assignedTo: {
      userId: input.session.userId,
      employeeId: input.session.employeeId,
      email: input.session.email,
      username: input.session.username,
      displayName: input.session.displayName ?? input.session.username,
    },
  };
  const created = stampAuditCreate(body, { by: input.session.username, ver: input.ver, dt: input.dt });
  return stampHistory(created, {
    op: 'CreateWorkOrderIn',
    by: input.session.username,
    ver: input.ver,
    dt: input.dt,
    changes: [{ path: 'origin', to: 'field' }],
  });
}

export async function createWorkOrderIn(input: {
  session: StartSession;
  summary: string;
  kind?: string;
  site?: Record<string, unknown>;
  scheduled?: Record<string, unknown>;
  customerId?: string;
  assetIds?: string[];
  orderId?: string;
}): Promise<{ woinId: string }> {
  const summary = input.summary.trim();
  if (!summary) throw new CreateWorkOrderInError('summary_empty');
  const woinId = newDocId('woin');
  const doc = buildFieldInbound({
    woinId,
    session: input.session,
    summary,
    kind: input.kind,
    site: input.site,
    scheduled: input.scheduled,
    customerId: input.customerId,
    assetIds: input.assetIds,
    orderId: input.orderId,
    ver: appVersion(),
    dt: nowSec(),
  });
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf('workordersin')) as {
      save: (d: unknown) => Promise<void>;
    } | null;
    if (col) await saveJsonDoc(col, woinId, doc);
  } else {
    memorySave('workordersin', woinId, doc);
  }
  return { woinId };
}

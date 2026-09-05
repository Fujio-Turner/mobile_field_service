import { nowSec, stampAuditCreate, stampAuditUpdate, stampHistory } from '../audit';
import { log } from '../log/logger';
import { newDocId, ulid } from '../ids';
import { appVersion } from '../version';
import { listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import type { StartSession } from './copyInbound';
import { createCustomer } from './customers';
import { isFrozen } from './outStatus';
import { OutError } from './outError';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
import { loadRateMap, loadTaxMap, priceLines, type PricedLine } from './pricing';

const DROP_FROM_ORDER_COPY = new Set([
  'type',
  'audit',
  'history',
  'historyTruncated',
  'lastAction',
  'embedding',
  'role',
  'owner',
  'syncState',
  'source',
  'amends',
  'readyToPush',
]);

const TODAY_ORDERS_SQL = `
SELECT META().id AS id, number, role, status, scheduled.day AS day
FROM field.orders
WHERE assignedTo.employeeId = $employeeId
  AND type = 'order'
`;

export type OrderRole = 'inbound' | 'working' | 'amendment';
export type OrderStatus = 'draft' | 'quoted' | 'accepted' | 'in_fulfillment' | 'complete' | 'cancelled';

export function isOrderFrozen(doc: Record<string, unknown>): boolean {
  const status = String(doc.status ?? '');
  const owner = String(doc.owner ?? '');
  return status === 'complete' || status === 'cancelled' || owner === 'backend';
}

export function orderReadySync(doc: Record<string, unknown>): boolean {
  const s = String(doc.syncState ?? '');
  return s === 'ready_to_push' || s === 'pushed' || s === 'push_error';
}

async function loadOrder(id: string): Promise<Record<string, unknown> | null> {
  return loadChild('orders', id);
}

async function saveOrder(id: string, body: Record<string, unknown>): Promise<void> {
  await saveChild('orders', id, body);
}

function assignedToFromSession(session: StartSession) {
  return {
    employeeId: session.employeeId,
    email: session.email,
    username: session.username,
    displayName: session.displayName,
  };
}

function stripOrderCopy(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (DROP_FROM_ORDER_COPY.has(k) || k.startsWith('photo:')) continue;
    next[k] = v;
  }
  return next;
}

function assertWritableOrder(doc: Record<string, unknown>): void {
  if (String(doc.role) === 'inbound') throw new OutError('frozen', 'never mutate inbound');
  if (isOrderFrozen(doc)) throw new OutError('frozen');
}

export async function getOrder(id: string): Promise<Record<string, unknown> | null> {
  return loadOrder(id);
}

function orderMatchesToday(doc: Record<string, unknown>, employeeId: string, day: string): boolean {
  if (String(doc.type ?? 'order') !== 'order') return false;
  const assigned = doc.assignedTo as { employeeId?: string } | undefined;
  if (assigned?.employeeId !== employeeId) return false;
  const role = String(doc.role ?? '');
  if (role === 'inbound') {
    const scheduled = doc.scheduled as { day?: string } | undefined;
    return scheduled?.day === day && String(doc.status) !== 'cancelled';
  }
  if (role === 'working' || role === 'amendment') {
    return ['draft', 'quoted', 'accepted', 'in_fulfillment'].includes(String(doc.status));
  }
  return false;
}

export async function listTodayOrders(
  employeeId: string,
  day: string,
): Promise<Array<{ id: string; doc: Record<string, unknown> }>> {
  const native = await queryChildRowsIfNative(TODAY_ORDERS_SQL, { employeeId });
  if (native) {
    const out: Array<{ id: string; doc: Record<string, unknown> }> = [];
    for (const row of native) {
      const id = String(row.id ?? '');
      const doc = await loadOrder(id);
      if (doc && orderMatchesToday(doc, employeeId, day)) out.push({ id, doc });
    }
    return out;
  }
  return listChildrenMemory('orders', (_id, doc) => orderMatchesToday(doc, employeeId, day));
}

/** Never mutates inbound. */
export async function startOrder(inboundId: string, session: StartSession): Promise<{ ordId: string; created: boolean }> {
  const inbound = await loadOrder(inboundId);
  if (!inbound) throw new OutError('missing');
  if (String(inbound.role) !== 'inbound') throw new OutError('illegal_transition', 'not inbound');
  const existing = listChildrenMemory('orders', (_id, doc) => {
    const src = doc.source as { id?: string } | undefined;
    return (
      String(doc.role) === 'working' &&
      src?.id === inboundId &&
      (doc.assignedTo as { employeeId?: string })?.employeeId === session.employeeId
    );
  });
  if (existing[0]) return { ordId: existing[0].id, created: false };

  const ver = appVersion();
  const dt = nowSec();
  const ordId = newDocId('ord');
  const body: Record<string, unknown> = {
    ...stripOrderCopy(inbound),
    type: 'order',
    role: 'working',
    origin: 'dispatch',
    owner: 'technician',
    status: String(inbound.status) === 'accepted' ? 'accepted' : 'draft',
    syncState: 'local_draft',
    assignedTo: assignedToFromSession(session),
    source: { id: inboundId, type: 'order', copiedAt: dt },
  };
  let doc = stampAuditCreate(body, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'StartOrder',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'source.id', to: inboundId }],
  });
  await saveOrder(ordId, doc);
  return { ordId, created: true };
}

export async function createOrder(
  session: StartSession,
  input: { customerId?: string; customerName?: string; currency?: string; number?: string } = {},
): Promise<string> {
  const ver = appVersion();
  const dt = nowSec();
  let customerId = input.customerId;
  if (!customerId && input.customerName) {
    customerId = await createCustomer(session, { name: input.customerName });
  }
  const ordId = newDocId('ord');
  let doc: Record<string, unknown> = {
    type: 'order',
    role: 'working',
    origin: 'field',
    owner: 'technician',
    status: 'draft',
    syncState: 'local_draft',
    number: input.number ?? `ORD-F-${ulid().slice(0, 8)}`,
    currency: input.currency ?? 'USD',
    customerId,
    assignedTo: assignedToFromSession(session),
    lines: [],
    totals: { subtotal: 0, taxTotal: 0, total: 0 },
  };
  doc = stampAuditCreate(doc, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'CreateOrder',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'origin', to: 'field' }],
  });
  await saveOrder(ordId, doc);
  return ordId;
}

export async function addOrderLine(
  ordId: string,
  session: StartSession,
  line: { productId?: string; rateId?: string; description?: string; qty: number; uom?: string; taxIds?: string[] },
): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  assertWritableOrder(doc);
  const rates = await loadRateMap();
  const taxes = await loadTaxMap();
  const id = `ln_${ulid()}`;
  const draft = [
    ...((doc.lines as PricedLine[]) ?? []).map((l) => ({
      id: l.id,
      productId: l.productId,
      rateId: l.rateId,
      description: l.description,
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.unitPrice,
      taxIds: l.taxIds,
    })),
    { id, ...line },
  ];
  const priced = priceLines(draft, rates, taxes);
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...doc, lines: priced.lines, totals: priced.totals };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'AddOrderLine',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'lines', to: id }],
  });
  await saveOrder(ordId, next);
}

export async function completeOrder(ordId: string, session: StartSession): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  assertWritableOrder(doc);
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = {
    ...doc,
    status: 'complete',
    owner: 'backend',
    completedAt: dt,
  };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'CompleteOrder',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'status', from: doc.status, to: 'complete' }],
  });
  await saveOrder(ordId, next);
}

/** Allowed at quoted | accepted | complete | cancelled (no payment). */
export async function submitOrder(ordId: string, session: StartSession): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  if (String(doc.role) === 'inbound') throw new OutError('frozen', 'never mutate inbound');
  const status = String(doc.status);
  if (!['quoted', 'accepted', 'complete', 'cancelled'].includes(status)) {
    throw new OutError('not_terminal', 'SubmitOrder needs quoted/accepted/complete/cancelled');
  }
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...doc, syncState: 'ready_to_push' };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  // SetSyncState does not append history
  await saveOrder(ordId, next);
  log.info('mfs.order.submit', { op: 'SubmitOrder', collection: 'orders', docId: ordId, syncState: 'ready_to_push' });
}

export async function createOrderAmendment(ordId: string, session: StartSession): Promise<string> {
  const parent = await loadOrder(ordId);
  if (!parent) throw new OutError('missing');
  if (!isOrderFrozen(parent)) throw new OutError('not_frozen');
  const ver = appVersion();
  const dt = nowSec();
  const id = newDocId('ord');
  let doc: Record<string, unknown> = {
    ...stripOrderCopy(parent),
    type: 'order',
    role: 'amendment',
    owner: 'technician',
    status: 'draft',
    syncState: 'local_draft',
    amends: { id: ordId, number: parent.number },
    assignedTo: assignedToFromSession(session),
  };
  doc = stampAuditCreate(doc, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'CreateOrderAmendment',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'amends.id', to: ordId }],
  });
  await saveOrder(id, doc);
  return id;
}

export async function markOrderQuoted(ordId: string, session: StartSession): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  assertWritableOrder(doc);
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...doc, status: 'quoted' };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'MarkOrderQuoted',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'status', from: doc.status, to: 'quoted' }],
  });
  await saveOrder(ordId, next);
}

export async function cancelOrder(ordId: string, session: StartSession, reason: string): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  assertWritableOrder(doc);
  if (!reason.trim()) throw new OutError('reason_required');
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = {
    ...doc,
    status: 'cancelled',
    owner: 'backend',
    cancelledAt: dt,
    cancelledReason: reason.trim(),
  };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'CancelOrder',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'status', from: doc.status, to: 'cancelled' }],
  });
  await saveOrder(ordId, next);
}

export async function repriceOrder(ordId: string, session: StartSession): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  assertWritableOrder(doc);
  const rates = await loadRateMap();
  const taxes = await loadTaxMap();
  const draft = ((doc.lines as PricedLine[]) ?? []).map((l) => ({
    id: l.id,
    productId: l.productId,
    rateId: l.rateId,
    description: l.description,
    qty: l.qty,
    uom: l.uom,
    taxIds: l.taxIds,
  }));
  const priced = priceLines(draft, rates, taxes);
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...doc, lines: priced.lines, totals: priced.totals };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'PriceLines',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'totals.total', from: (doc.totals as { total?: number })?.total, to: priced.totals.total }],
  });
  await saveOrder(ordId, next);
}

export async function linkOrderToWork(ordId: string, wooutId: string, session: StartSession): Promise<void> {
  const doc = await loadOrder(ordId);
  if (!doc) throw new OutError('missing');
  assertWritableOrder(doc);
  const wo = await loadOutboundRaw(wooutId);
  if (!wo) throw new OutError('missing');
  if (isFrozen(wo)) throw new OutError('frozen');
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...doc, workOrderOutId: wooutId };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'LinkOrderToWork',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'workOrderOutId', to: wooutId }],
  });
  await saveOrder(ordId, next);
  let woNext: Record<string, unknown> = { ...wo, orderId: ordId };
  woNext = stampAuditUpdate(woNext as never, { by: session.username, ver, dt });
  woNext = stampHistory(woNext as never, {
    op: 'LinkOrderToWork',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'orderId', to: ordId }],
  });
  await saveOutboundRaw(wooutId, woNext);
}

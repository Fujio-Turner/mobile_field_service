import { nowSec, stampAuditCreate, stampAuditUpdate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import { listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import { assignedToFromSession, type StartSession } from './copyInbound';
import { OutError } from './outError';
import { childReadyToPush, isFrozen } from './outStatus';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
import { parseProduct, searchProducts, type ProductItem } from './products';

export type { ProductItem };
export { searchProducts, parseProduct };

export const DEFAULT_VAN_ID = 'van:12';
export const NEGATIVE_STOCK_ROLES = new Set(['supervisor', 'technician_lead']);

const STOCK_SQL = `
SELECT META().id AS id, productId, sku, qtyOnHand, uom, locationId, locationType, audit.up.dt AS snapshotUpDt
FROM field.inventory
WHERE type = 'inventory' AND locationId = $locationId
`;

const TX_AT_LOC_SQL = `
SELECT META().id AS id, productId, locationId, qtyDelta, sku, reason, workOrderOutId, appliedToWo, readyToPush, audit.cr.dt AS auditCrDt
FROM field.inventory
WHERE type = 'inventory_tx' AND locationId = $locationId
`;

const TX_FOR_WO_SQL = `
SELECT META().id AS id, productId, locationId, qtyDelta, sku, reason, workOrderOutId, appliedToWo, readyToPush, audit.cr.dt AS auditCrDt
FROM field.inventory
WHERE type = 'inventory_tx' AND workOrderOutId = $wooutId
`;

const USER_ROLE_SQL = `
SELECT META().id AS id, role, vanId, employeeId
FROM field.users
WHERE employeeId = $employeeId
LIMIT 1
`;

export type StockSnapshot = {
  id: string;
  productId: string;
  sku: string;
  locationId: string;
  locationType: string;
  qtyOnHand: number;
  uom: string;
  auditUpDt: number;
};

export type InventoryTx = {
  id: string;
  productId: string;
  locationId: string;
  qtyDelta: number;
  reason: string;
  workOrderOutId?: string;
  orderId?: string;
  sku?: string;
  readyToPush?: boolean;
  appliedToWo?: boolean;
  auditCrDt: number;
};

export type DisplayStock = StockSnapshot & {
  displayQty: number;
  productName?: string;
};

export type RebuildRow = {
  productId: string;
  snapshotQty: number;
  snapshotUpDt: number;
  txSum: number;
  displayQty: number;
};

export type MaterialLine = {
  productId: string;
  sku?: string;
  description?: string;
  qtyUsed: number;
  uom?: string;
};

export function parseStock(id: string, raw: Record<string, unknown>): StockSnapshot | null {
  if (String(raw.type) !== 'inventory') return null;
  const audit = raw.audit as { up?: { dt?: number }; cr?: { dt?: number } } | undefined;
  return {
    id,
    productId: String(raw.productId ?? ''),
    sku: String(raw.sku ?? ''),
    locationId: String(raw.locationId ?? ''),
    locationType: String(raw.locationType ?? 'van'),
    qtyOnHand: Number(raw.qtyOnHand ?? 0),
    uom: String(raw.uom ?? 'ea'),
    auditUpDt: Number(audit?.up?.dt ?? audit?.cr?.dt ?? 0),
  };
}

export function parseTx(id: string, raw: Record<string, unknown>): InventoryTx | null {
  if (String(raw.type) !== 'inventory_tx') return null;
  const audit = raw.audit as { cr?: { dt?: number } } | undefined;
  return {
    id,
    productId: String(raw.productId ?? ''),
    locationId: String(raw.locationId ?? ''),
    qtyDelta: Number(raw.qtyDelta ?? 0),
    reason: String(raw.reason ?? ''),
    workOrderOutId: raw.workOrderOutId != null ? String(raw.workOrderOutId) : undefined,
    orderId: raw.orderId != null ? String(raw.orderId) : undefined,
    sku: raw.sku != null ? String(raw.sku) : undefined,
    readyToPush: raw.readyToPush === true,
    appliedToWo: raw.appliedToWo === true,
    auditCrDt: Number(audit?.cr?.dt ?? 0),
  };
}

export function canAllowNegative(role?: string): boolean {
  return NEGATIVE_STOCK_ROLES.has(String(role ?? ''));
}

/** Display qty = snapshot qtyOnHand + SUM(tx after snapshot.audit.up.dt). Never writes stock. */
export function rebuildStockDisplay(snapshot: StockSnapshot, txs: InventoryTx[]): number {
  let sum = 0;
  for (const tx of txs) {
    if (tx.productId !== snapshot.productId) continue;
    if (tx.locationId !== snapshot.locationId) continue;
    if (tx.auditCrDt <= snapshot.auditUpDt) continue;
    sum += tx.qtyDelta;
  }
  return snapshot.qtyOnHand + sum;
}

export function rebuildStockModel(
  snapshots: StockSnapshot[],
  txs: InventoryTx[],
  locationId?: string,
): RebuildRow[] {
  return snapshots
    .filter((s) => (locationId ? s.locationId === locationId : true))
    .map((s) => {
      const txSum = rebuildStockDisplay(s, txs) - s.qtyOnHand;
      return {
        productId: s.productId,
        snapshotQty: s.qtyOnHand,
        snapshotUpDt: s.auditUpDt,
        txSum,
        displayQty: s.qtyOnHand + txSum,
      };
    });
}

/** Read-model only — never writes stock. */
export function rebuildStock(
  snapshots: StockSnapshot[],
  txs: InventoryTx[],
  locationId?: string,
): DisplayStock[] {
  return snapshots
    .filter((s) => (locationId ? s.locationId === locationId : true))
    .map((s) => ({ ...s, displayQty: rebuildStockDisplay(s, txs) }));
}

function emptySnapshot(productId: string, locationId: string): StockSnapshot {
  return {
    id: '',
    productId,
    locationId,
    sku: '',
    locationType: 'van',
    qtyOnHand: 0,
    uom: 'ea',
    auditUpDt: 0,
  };
}

async function listStockRows(locationId: string): Promise<StockSnapshot[]> {
  const native = await queryChildRowsIfNative(STOCK_SQL, { locationId });
  if (native) {
    return native
      .map((row) =>
        parseStock(String(row.id ?? ''), {
          type: 'inventory',
          productId: row.productId,
          sku: row.sku,
          qtyOnHand: row.qtyOnHand,
          uom: row.uom,
          locationId: row.locationId ?? locationId,
          locationType: row.locationType,
          audit: { up: { dt: row.snapshotUpDt } },
        }),
      )
      .filter((s): s is StockSnapshot => s != null);
  }
  return listChildrenMemory('inventory', (_id, doc) => String(doc.type) === 'inventory')
    .map((r) => parseStock(r.id, r.doc))
    .filter((s): s is StockSnapshot => s != null && s.locationId === locationId);
}

async function listTxRows(opts: { locationId?: string; wooutId?: string }): Promise<InventoryTx[]> {
  if (opts.wooutId) {
    const native = await queryChildRowsIfNative(TX_FOR_WO_SQL, { wooutId: opts.wooutId });
    if (native) {
      return native
        .map((row) =>
          parseTx(String(row.id ?? ''), {
            type: 'inventory_tx',
            ...row,
            audit: { cr: { dt: row.auditCrDt } },
          }),
        )
        .filter((t): t is InventoryTx => t != null);
    }
    return listChildrenMemory('inventory', (_id, doc) => String(doc.type) === 'inventory_tx')
      .map((r) => parseTx(r.id, r.doc))
      .filter((t): t is InventoryTx => t != null && t.workOrderOutId === opts.wooutId);
  }
  const locationId = opts.locationId ?? '';
  const native = await queryChildRowsIfNative(TX_AT_LOC_SQL, { locationId });
  if (native) {
    return native
      .map((row) =>
        parseTx(String(row.id ?? ''), {
          type: 'inventory_tx',
          ...row,
          audit: { cr: { dt: row.auditCrDt } },
        }),
      )
      .filter((t): t is InventoryTx => t != null);
  }
  return listChildrenMemory('inventory', (_id, doc) => String(doc.type) === 'inventory_tx')
    .map((r) => parseTx(r.id, r.doc))
    .filter((t): t is InventoryTx => t != null && t.locationId === locationId);
}

export async function listInventoryTxForWork(wooutId: string): Promise<InventoryTx[]> {
  return listTxRows({ wooutId });
}

export async function listStockAtLocation(locationId: string): Promise<DisplayStock[]> {
  const stocks = await listStockRows(locationId);
  const txs = await listTxRows({ locationId });
  const catalog = await searchProducts();
  const names = new Map(catalog.map((p) => [p.id, p.name]));
  return rebuildStock(stocks, txs, locationId).map((s) => ({
    ...s,
    productName: names.get(s.productId),
  }));
}

export async function vanLocationIdForEmployee(employeeId: string): Promise<string> {
  const native = await queryChildRowsIfNative(USER_ROLE_SQL, { employeeId });
  if (native?.[0]?.vanId) return String(native[0].vanId);
  const hit = listChildrenMemory('users', (_id, doc) => String(doc.employeeId ?? '') === employeeId)[0];
  if (hit?.doc.vanId) return String(hit.doc.vanId);
  return DEFAULT_VAN_ID;
}

export async function roleForEmployee(employeeId: string): Promise<string> {
  const native = await queryChildRowsIfNative(USER_ROLE_SQL, { employeeId });
  if (native?.[0]?.role) return String(native[0].role);
  const hit = listChildrenMemory('users', (_id, doc) => String(doc.employeeId ?? '') === employeeId)[0];
  return String(hit?.doc.role ?? 'technician');
}

function mergeMaterials(
  existing: unknown,
  productId: string,
  qty: number,
  meta: { sku?: string; description?: string; uom?: string },
): MaterialLine[] {
  const lines = Array.isArray(existing) ? (existing as MaterialLine[]).map((m) => ({ ...m })) : [];
  const hit = lines.find((m) => m.productId === productId);
  if (hit) {
    hit.qtyUsed = Number(hit.qtyUsed ?? 0) + qty;
  } else {
    lines.push({
      productId,
      sku: meta.sku,
      description: meta.description,
      qtyUsed: qty,
      uom: meta.uom,
    });
  }
  return lines;
}

/**
 * Writes inventory_tx + woout.materials only. Never saves type:inventory stock rows.
 */
export async function consumeInventoryOnWork(
  session: StartSession,
  input: {
    wooutId?: string;
    productId: string;
    locationId: string;
    qty: number;
    reason?: string;
    orderId?: string;
  },
): Promise<string> {
  const qty = Math.abs(input.qty);
  if (!(qty > 0)) throw new OutError('reason_required', 'qty must be positive');
  if (!input.wooutId && !input.orderId) throw new OutError('missing', 'woout or order required');
  const parent = input.wooutId ? await loadOutboundRaw(input.wooutId) : null;
  const order = !input.wooutId && input.orderId ? await loadChild('orders', input.orderId) : null;
  if (input.wooutId) {
    if (!parent) throw new OutError('missing');
    if (isFrozen(parent)) throw new OutError('frozen');
  } else {
    if (!order) throw new OutError('missing');
    if (String(order.role) === 'inbound') throw new OutError('frozen', 'never mutate inbound');
    if (isFrozen(order)) throw new OutError('frozen');
  }

  const stocks = await listStockRows(input.locationId);
  const txs = await listTxRows({ locationId: input.locationId });
  const snap = stocks.find((s) => s.productId === input.productId) ?? emptySnapshot(input.productId, input.locationId);
  const displayQty = rebuildStockDisplay(snap, txs);
  const role = await roleForEmployee(session.employeeId);
  if (displayQty < qty && !canAllowNegative(role)) {
    throw new OutError('insufficient_stock', `Need ${qty}, van shows ${displayQty}`);
  }

  const productRaw = await loadChild('products', input.productId);
  const product = parseProduct(input.productId, productRaw ?? { type: 'product', sku: '', name: input.productId, uom: 'ea' });
  const ver = appVersion();
  const dt = nowSec();
  const txId = newDocId('invtx');
  let tx: Record<string, unknown> = {
    type: 'inventory_tx',
    productId: input.productId,
    locationId: input.locationId,
    qtyDelta: -qty,
    reason: input.reason ?? 'consume',
    workOrderOutId: input.wooutId,
    orderId: input.orderId,
    sku: product?.sku,
    assignedTo: assignedToFromSession(session),
    employeeId: session.employeeId,
    email: session.email,
    customerId: (parent ?? order)?.customerId != null ? String((parent ?? order)?.customerId) : undefined,
    readyToPush: childReadyToPush(parent ?? order ?? {}),
    appliedToWo: false,
  };
  tx = stampAuditCreate(tx, { by: session.username, ver, dt });
  tx = stampHistory(tx as never, {
    op: 'ConsumeInventoryOnWork',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'qtyDelta', to: tx.qtyDelta }],
  });
  await saveChild('inventory', txId, tx);

  if (parent && input.wooutId) {
    const materials = mergeMaterials(parent.materials, input.productId, qty, {
      sku: product?.sku,
      description: product?.name,
      uom: product?.uom,
    });
    let next: Record<string, unknown> = { ...parent, materials };
    next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
    next = stampHistory(next as never, {
      op: 'ConsumeInventoryOnWork',
      by: session.username,
      ver,
      dt,
      changes: [{ path: 'materials', to: materials }],
    });
    await saveOutboundRaw(input.wooutId, next);
    await saveChild('inventory', txId, { ...tx, appliedToWo: true });
  } else {
    await saveChild('inventory', txId, { ...tx, appliedToWo: true });
  }
  return txId;
}

function floorMaterials(
  existing: unknown,
  productId: string,
  minQty: number,
  meta: { sku?: string },
): MaterialLine[] {
  const lines = Array.isArray(existing) ? (existing as MaterialLine[]).map((m) => ({ ...m })) : [];
  const hit = lines.find((m) => m.productId === productId);
  if (hit) {
    hit.qtyUsed = Math.max(Number(hit.qtyUsed ?? 0), minQty);
  } else {
    lines.push({ productId, sku: meta.sku, qtyUsed: minQty });
  }
  return lines;
}

/** Merge materials from txs that never flipped appliedToWo (crash between tx and woout). */
export async function repairUnappliedInventoryTx(
  wooutId: string,
  session: StartSession,
  already?: Record<string, unknown> | null,
): Promise<number> {
  const parent = already !== undefined ? already : await loadOutboundRaw(wooutId);
  if (!parent || isFrozen(parent)) return 0;
  const txs = await listInventoryTxForWork(wooutId);
  const pending = txs.filter((t) => t.appliedToWo !== true);
  if (pending.length === 0) return 0;
  const needed = new Map<string, { qty: number; sku?: string }>();
  for (const t of pending) {
    const prev = needed.get(t.productId) ?? { qty: 0, sku: t.sku };
    prev.qty += Math.abs(t.qtyDelta);
    needed.set(t.productId, prev);
  }
  let materials: unknown = parent.materials;
  for (const [productId, rec] of needed) {
    materials = floorMaterials(materials, productId, rec.qty, { sku: rec.sku });
  }
  for (const t of pending) {
    const raw = await loadChild('inventory', t.id);
    if (raw) await saveChild('inventory', t.id, { ...raw, appliedToWo: true });
  }
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...parent, materials };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'RepairInventoryTx',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'materials', to: materials }],
  });
  await saveOutboundRaw(wooutId, next);
  return pending.length;
}

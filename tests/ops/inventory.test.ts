import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import {
  SEED_INV_ID,
  SEED_PRODUCT_ID,
  SEED_TASK_TEMPLATE_ID,
  SEED_VAN_ID,
  seedInboundJobs,
  seedProductsRatesTaxes,
} from '../../src/db/seedData';
import {
  canAllowNegative,
  consumeInventoryOnWork,
  listStockAtLocation,
  parseStock,
  parseTx,
  rebuildStock,
  rebuildStockDisplay,
  rebuildStockModel,
  repairUnappliedInventoryTx,
  searchProducts,
} from '../../src/ops/inventory';
import { createOrder } from '../../src/ops/orders';
import { OutError } from '../../src/ops/outError';
import { startWork } from '../../src/ops/startWork';
import { completeWork, startOrResumeWork } from '../../src/ops/transitionStatus';
import { completeTask, listTasksForWork } from '../../src/ops/tasks';
import { applyOutPatch } from '../../src/ops/updateWorkOrderOut';
import { submitWork } from '../../src/ops/submitWork';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of catalog.products) memorySave('products', row.id, row.doc as never);
  for (const row of catalog.inventory) memorySave('inventory', row.id, row.doc as never);
  memorySave('tasks', SEED_TASK_TEMPLATE_ID, {
    type: 'task_template',
    title: 'Lockout / tagout',
    required: true,
  });
  memorySave('users', 'usr:jon', {
    type: 'user',
    employeeId: 'E-4412',
    role: 'technician',
    vanId: SEED_VAN_ID,
  });
});

async function started() {
  const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
  const { wooutId } = await startWork(id, session);
  return wooutId;
}

describe('rebuild stock cutoff', () => {
  it('adds only txs after snapshot.audit.up.dt', () => {
    const snap = parseStock(SEED_INV_ID, memoryGet('inventory', SEED_INV_ID)!)!;
    const oldTx = parseTx('invtx:old', {
      type: 'inventory_tx',
      productId: snap.productId,
      locationId: snap.locationId,
      qtyDelta: -1,
      reason: 'old',
      audit: { cr: { dt: snap.auditUpDt - 10 } },
    })!;
    const newTx = parseTx('invtx:new', {
      type: 'inventory_tx',
      productId: snap.productId,
      locationId: snap.locationId,
      qtyDelta: -2,
      reason: 'new',
      audit: { cr: { dt: snap.auditUpDt + 10 } },
    })!;
    expect(rebuildStockDisplay(snap, [oldTx, newTx])).toBe(snap.qtyOnHand - 2);
    expect(rebuildStock([snap], [oldTx, newTx], SEED_VAN_ID)[0].displayQty).toBe(snap.qtyOnHand - 2);
    const model = rebuildStockModel([snap], [oldTx, newTx], SEED_VAN_ID)[0];
    expect(model.txSum).toBe(-2);
    expect(model.displayQty).toBe(snap.qtyOnHand - 2);
  });
});

describe('catalog FTS (memory)', () => {
  it('finds the seed valve by sku', async () => {
    const hits = await searchProducts('VLV');
    expect(hits.some((p) => p.id === SEED_PRODUCT_ID)).toBe(true);
  });
});

describe('consume', () => {
  it('writes tx + materials and never mutates stock snapshot', async () => {
    const before = structuredClone(memoryGet('inventory', SEED_INV_ID)!);
    const wooutId = await started();
    const txId = await consumeInventoryOnWork(session, {
      wooutId,
      productId: SEED_PRODUCT_ID,
      locationId: SEED_VAN_ID,
      qty: 1,
    });
    expect(memoryGet('inventory', SEED_INV_ID)).toEqual(before);
    const tx = memoryGet('inventory', txId)!;
    expect(tx.type).toBe('inventory_tx');
    expect(tx.qtyDelta).toBe(-1);
    expect(tx.appliedToWo).toBe(true);
    expect((tx.history as { op: string }[])[0].op).toBe('ConsumeInventoryOnWork');
    const materials = memoryGet('workordersout', wooutId)?.materials as { productId: string; qtyUsed: number }[];
    expect(materials.some((m) => m.productId === SEED_PRODUCT_ID && m.qtyUsed === 1)).toBe(true);
    const display = await listStockAtLocation(SEED_VAN_ID);
    expect(display[0].displayQty).toBe(Number(before.qtyOnHand) - 1);
    expect(display[0].qtyOnHand).toBe(Number(before.qtyOnHand));
  });

  it('consumes onto an order without a work order copy', async () => {
    const before = structuredClone(memoryGet('inventory', SEED_INV_ID)!);
    const ordId = await createOrder(session, { customerName: 'Walk-up' });
    const txId = await consumeInventoryOnWork(session, {
      orderId: ordId,
      productId: SEED_PRODUCT_ID,
      locationId: SEED_VAN_ID,
      qty: 1,
    });
    expect(memoryGet('inventory', SEED_INV_ID)).toEqual(before);
    expect(memoryGet('inventory', txId)?.orderId).toBe(ordId);
    expect(memoryGet('inventory', txId)?.workOrderOutId).toBeUndefined();
  });

  it('409s insufficient stock for a technician', async () => {
    const wooutId = await started();
    await expect(
      consumeInventoryOnWork(session, {
        wooutId,
        productId: SEED_PRODUCT_ID,
        locationId: SEED_VAN_ID,
        qty: 99,
      }),
    ).rejects.toMatchObject({ code: 'insufficient_stock' });
    expect(canAllowNegative('technician')).toBe(false);
  });

  it('lets supervisor go negative', async () => {
    memorySave('users', 'usr:jon', {
      type: 'user',
      employeeId: 'E-4412',
      role: 'supervisor',
      vanId: SEED_VAN_ID,
    });
    const wooutId = await started();
    await consumeInventoryOnWork(session, {
      wooutId,
      productId: SEED_PRODUCT_ID,
      locationId: SEED_VAN_ID,
      qty: 99,
    });
    const display = await listStockAtLocation(SEED_VAN_ID);
    expect(display[0].displayQty).toBeLessThan(0);
  });

  it('409s when the parent is frozen', async () => {
    const wooutId = await started();
    await startOrResumeWork(wooutId, session);
    const raw = memoryGet('workordersout', wooutId)!;
    memorySave(
      'workordersout',
      wooutId,
      applyOutPatch(
        raw,
        {
          operations: (raw.operations as { required?: boolean; status?: string }[]).map((o) => ({
            ...o,
            status: o.required ? 'done' : o.status,
          })),
          checklist: (raw.checklist as { required?: boolean; done?: boolean }[]).map((c) => ({
            ...c,
            done: c.required ? true : c.done,
          })),
        },
        session,
        20,
        '1',
      ),
    );
    for (const t of await listTasksForWork(wooutId)) {
      if (t.required) await completeTask(t.id, session);
    }
    await completeWork(wooutId, session);
    await expect(
      consumeInventoryOnWork(session, {
        wooutId,
        productId: SEED_PRODUCT_ID,
        locationId: SEED_VAN_ID,
        qty: 1,
      }),
    ).rejects.toBeInstanceOf(OutError);
  });

  it('repairs appliedToWo without writing stock', async () => {
    const wooutId = await started();
    const txId = await consumeInventoryOnWork(session, {
      wooutId,
      productId: SEED_PRODUCT_ID,
      locationId: SEED_VAN_ID,
      qty: 1,
    });
    const tx = memoryGet('inventory', txId)!;
    memorySave('inventory', txId, { ...tx, appliedToWo: false });
    const beforeStock = structuredClone(memoryGet('inventory', SEED_INV_ID)!);
    const n = await repairUnappliedInventoryTx(wooutId, session);
    expect(n).toBe(1);
    expect(memoryGet('inventory', txId)?.appliedToWo).toBe(true);
    expect(memoryGet('inventory', SEED_INV_ID)).toEqual(beforeStock);
  });

  it('marks txs readyToPush on SubmitWork', async () => {
    const wooutId = await started();
    const txId = await consumeInventoryOnWork(session, {
      wooutId,
      productId: SEED_PRODUCT_ID,
      locationId: SEED_VAN_ID,
      qty: 1,
    });
    expect(memoryGet('inventory', txId)?.readyToPush).toBe(false);
    await startOrResumeWork(wooutId, session);
    const raw = memoryGet('workordersout', wooutId)!;
    memorySave(
      'workordersout',
      wooutId,
      applyOutPatch(
        raw,
        {
          operations: (raw.operations as { required?: boolean; status?: string }[]).map((o) => ({
            ...o,
            status: o.required ? 'done' : o.status,
          })),
          checklist: (raw.checklist as { required?: boolean; done?: boolean }[]).map((c) => ({
            ...c,
            done: c.required ? true : c.done,
          })),
        },
        session,
        20,
        '1',
      ),
    );
    for (const t of await listTasksForWork(wooutId)) {
      if (t.required) await completeTask(t.id, session);
    }
    await completeWork(wooutId, session);
    await submitWork(wooutId, session);
    expect(memoryGet('inventory', txId)?.readyToPush).toBe(true);
  });
});

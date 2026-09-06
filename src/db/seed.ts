import { appVersion } from '../version';
import { nowSec } from '../audit';
import { cloneTaskIds } from '../ops/cloneTasks';
import { buildWorkOrderOut } from '../ops/copyInbound';
import { documentToObject } from '../ops/workOrderIn';
import { FIELD_SCOPE } from './collections';
import {
  SEED_CUSTOMER_ID,
  SEED_DELIVER_WOIN_ID,
  SEED_DISPATCH_USER_ID,
  SEED_EMAIL,
  SEED_EMPLOYEE_ID,
  SEED_INBOUND_ORDER_ID,
  SEED_MAYA_USER_ID,
  SEED_PRIYA_USER_ID,
  SEED_REASSIGN_WOIN_ID,
  SEED_REASSIGN_WOOUT_ID,
  SEED_USER_ID,
  SEED_USERNAME,
  seedAssets,
  seedCustomerDoc,
  seedDispatchUserDoc,
  seedInboundJobs,
  seedInboundOrders,
  seedMayaUserDoc,
  seedPriyaUserDoc,
  seedProductsRatesTaxes,
  seedTaskTemplates,
  seedUserDoc,
} from './seedData';
import { saveJsonDoc } from './saveJson';

type CollectionLike = {
  document: (id: string) => Promise<unknown>;
  save: (doc: unknown) => Promise<void>;
};

type DbLike = {
  collection: (name: string, scope: string) => Promise<unknown>;
};

async function saveIfMissing(
  col: CollectionLike,
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const existing = await col.document(id);
  if (existing) return;
  await saveJsonDoc(col, id, body);
}

/** Fill kit fields on known dispatch inbound without clobbering an already-enriched doc. */
async function enrichInboundKit(
  col: CollectionLike,
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const existing = await col.document(id);
  if (!existing) {
    await saveJsonDoc(col, id, body);
    return;
  }
  const data = documentToObject(existing);
  if (!data) return;
  const hasAssets = Array.isArray(data.assetIds) && data.assetIds.length > 0;
  const hasMove = data.move != null;
  if (hasAssets && (hasMove || body.move == null)) return;
  const next = { ...data };
  if (!hasAssets && Array.isArray(body.assetIds)) next.assetIds = body.assetIds;
  if (!hasMove && body.move != null) next.move = body.move;
  if (data.orderId == null && body.orderId != null) next.orderId = body.orderId;
  if ((!Array.isArray(data.materials) || data.materials.length === 0) && Array.isArray(body.materials)) {
    next.materials = body.materials;
  }
  await saveJsonDoc(col, id, next);
}

export async function seedIfNeeded(database: DbLike): Promise<void> {
  const ver = appVersion();
  const dt = nowSec();
  const users = (await database.collection('users', FIELD_SCOPE)) as CollectionLike | null;
  const orders = (await database.collection('orders', FIELD_SCOPE)) as CollectionLike | null;
  const woin = (await database.collection('workordersin', FIELD_SCOPE)) as CollectionLike | null;
  const woout = (await database.collection('workordersout', FIELD_SCOPE)) as CollectionLike | null;
  if (!users || !woin) return;

  const jobsEarly = seedInboundJobs(ver, dt);
  if (woout) {
    await ensureReassignedOutbound(database, woout, jobsEarly, ver, dt);
  }

  if (
    (await users.document(SEED_USER_ID)) &&
    (await users.document(SEED_MAYA_USER_ID)) &&
    (await users.document(SEED_PRIYA_USER_ID)) &&
    orders &&
    (await orders.document(SEED_INBOUND_ORDER_ID)) &&
    (await woin.document(SEED_REASSIGN_WOIN_ID)) &&
    (await woin.document(SEED_DELIVER_WOIN_ID)) &&
    woout &&
    (await woout.document(SEED_REASSIGN_WOOUT_ID))
  ) {
    return;
  }

  const customers = (await database.collection('customers', FIELD_SCOPE)) as CollectionLike | null;
  const tasks = (await database.collection('tasks', FIELD_SCOPE)) as CollectionLike | null;
  const assets = (await database.collection('assets', FIELD_SCOPE)) as CollectionLike | null;
  const products = (await database.collection('products', FIELD_SCOPE)) as CollectionLike | null;
  const rates = (await database.collection('rates', FIELD_SCOPE)) as CollectionLike | null;
  const taxes = (await database.collection('taxes', FIELD_SCOPE)) as CollectionLike | null;
  const inventory = (await database.collection('inventory', FIELD_SCOPE)) as CollectionLike | null;
  if (!customers) return;

  await saveIfMissing(users, SEED_USER_ID, seedUserDoc(ver, dt) as unknown as Record<string, unknown>);
  await saveIfMissing(
    users,
    SEED_DISPATCH_USER_ID,
    seedDispatchUserDoc(ver, dt) as unknown as Record<string, unknown>,
  );
  await saveIfMissing(users, SEED_MAYA_USER_ID, seedMayaUserDoc(ver, dt) as unknown as Record<string, unknown>);
  await saveIfMissing(users, SEED_PRIYA_USER_ID, seedPriyaUserDoc(ver, dt) as unknown as Record<string, unknown>);
  await saveIfMissing(
    customers,
    SEED_CUSTOMER_ID,
    seedCustomerDoc(ver, dt) as unknown as Record<string, unknown>,
  );
  if (tasks) {
    for (const row of seedTaskTemplates(ver, dt)) {
      await saveIfMissing(tasks, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  if (assets) {
    for (const row of seedAssets(ver, dt)) {
      await saveIfMissing(assets, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  const catalog = seedProductsRatesTaxes(ver, dt);
  if (products) {
    for (const row of catalog.products) {
      await saveIfMissing(products, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  if (rates) {
    for (const row of catalog.rates) {
      await saveIfMissing(rates, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  if (taxes) {
    for (const row of catalog.taxes) {
      await saveIfMissing(taxes, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  if (inventory) {
    for (const row of catalog.inventory) {
      await saveIfMissing(inventory, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  const jobs = jobsEarly;
  for (const row of jobs) {
    await enrichInboundKit(woin, row.id, row.doc as unknown as Record<string, unknown>);
  }
  if (woout) {
    await ensureReassignedOutbound(database, woout, jobs, ver, dt);
  }
  if (orders) {
    for (const row of seedInboundOrders(ver, dt)) {
      await saveIfMissing(orders, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
}

async function ensureReassignedOutbound(
  database: DbLike,
  woout: CollectionLike,
  jobs: ReturnType<typeof seedInboundJobs>,
  ver: string,
  dt: number,
): Promise<void> {
  const reassignIn = jobs.find((j) => j.id === SEED_REASSIGN_WOIN_ID);
  if (!reassignIn) return;
  const existing = await woout.document(SEED_REASSIGN_WOOUT_ID);
  const data = existing ? documentToObject(existing) : null;
  if (data && String(data.type) !== 'workorderout') return;
  const templates = seedTaskTemplates(ver, dt);
  const templateIds = new Set(templates.map((row) => row.id));
  const ids = Array.isArray(data?.taskIds) ? data.taskIds.map(String) : [];
  const clonedAlready = ids.length > 0 && ids.every((id) => !templateIds.has(id));
  if (clonedAlready) return;

  const session = {
    userId: SEED_USER_ID,
    employeeId: SEED_EMPLOYEE_ID,
    email: SEED_EMAIL,
    username: SEED_USERNAME,
    displayName: 'Jon Hale',
  };
  const load = (id: string) =>
    (templates.find((row) => row.id === id)?.doc as unknown as Record<string, unknown>) ?? null;
  const cloned = cloneTaskIds((reassignIn.doc as { taskIds?: unknown }).taskIds, load, {
    outId: SEED_REASSIGN_WOOUT_ID,
    session,
    ver,
    dt,
  });
  const outDoc = data
    ? { ...data, taskIds: cloned.instanceIds }
    : {
        ...buildWorkOrderOut({
          inboundRaw: reassignIn.doc as unknown as Record<string, unknown>,
          inboundId: reassignIn.id,
          outId: SEED_REASSIGN_WOOUT_ID,
          session,
          ver,
          dt,
        }),
        status: 'in_progress',
        taskIds: cloned.instanceIds,
      };
  await saveJsonDoc(woout, SEED_REASSIGN_WOOUT_ID, outDoc);
  const tasks = (await database.collection('tasks', FIELD_SCOPE)) as CollectionLike | null;
  if (!tasks) return;
  for (const row of cloned.instances) {
    await saveIfMissing(tasks, row.id, row.doc);
  }
}

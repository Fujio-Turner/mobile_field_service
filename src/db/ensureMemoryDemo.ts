import { nativeDbAvailable } from './database';
import { memorySave } from './memoryStore';
import {
  SEED_DISPATCH_USER_ID,
  SEED_MAYA_USER_ID,
  SEED_PRIYA_USER_ID,
  SEED_USER_ID,
  seedAssets,
  seedDispatchUserDoc,
  seedInboundOrders,
  seedMayaUserDoc,
  seedPriyaUserDoc,
  seedProductsRatesTaxes,
  seedUserDoc,
} from './seedData';

let assets = false;
let catalog = false;
let employees = false;
let orders = false;

/** Expo Go / tests: seed each demo slice at most once per process. */
export function resetMemoryDemoFlags(): void {
  assets = false;
  catalog = false;
  employees = false;
  orders = false;
}

export function ensureMemoryAssets(): void {
  if (nativeDbAvailable() || assets) return;
  assets = true;
  for (const row of seedAssets('0.1.0+1', 1_700_000_000)) {
    memorySave('assets', row.id, row.doc as unknown as Record<string, unknown>);
  }
}

export function ensureMemoryCatalog(): void {
  if (nativeDbAvailable() || catalog) return;
  catalog = true;
  const seeded = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of seeded.products) memorySave('products', row.id, row.doc as never);
  for (const row of seeded.rates) memorySave('rates', row.id, row.doc as never);
  for (const row of seeded.taxes) memorySave('taxes', row.id, row.doc as never);
  for (const row of seeded.inventory) memorySave('inventory', row.id, row.doc as never);
  memorySave('users', 'usr:demo', seedUserDoc('0.1.0+1', 1_700_000_000) as never);
}

export function ensureMemoryEmployees(): void {
  if (nativeDbAvailable() || employees) return;
  employees = true;
  memorySave('users', SEED_USER_ID, seedUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_DISPATCH_USER_ID, seedDispatchUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_MAYA_USER_ID, seedMayaUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_PRIYA_USER_ID, seedPriyaUserDoc('0.1.0+1', 1_700_000_000) as never);
}

export function ensureMemoryOrders(day: string): void {
  if (nativeDbAvailable() || orders) return;
  orders = true;
  ensureMemoryCatalog();
  for (const inbound of seedInboundOrders('0.1.0+1', 1_700_000_000, day)) {
    memorySave('orders', inbound.id, inbound.doc as never);
  }
}

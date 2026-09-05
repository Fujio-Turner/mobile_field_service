import { listChildrenMemory, queryChildRowsIfNative } from './childStore';

const WOOUT_SQL = `
SELECT COUNT(*) AS n
FROM field.workordersout
WHERE syncState = 'ready_to_push'
`;

const ORDERS_SQL = `
SELECT COUNT(*) AS n
FROM field.orders
WHERE role != 'inbound' AND syncState = 'ready_to_push'
`;

const WOIN_SQL = `
SELECT COUNT(*) AS n
FROM field.workordersin
WHERE origin = 'field' AND readyToPush = true
`;

function nFrom(rows: Record<string, unknown>[] | null): number | null {
  if (!rows) return null;
  return Number(rows[0]?.n ?? 0);
}

export function pendingPushCountMemory(): number {
  const woout = listChildrenMemory('workordersout', (_id, doc) => String(doc.syncState) === 'ready_to_push').length;
  const orders = listChildrenMemory(
    'orders',
    (_id, doc) => String(doc.role) !== 'inbound' && String(doc.syncState) === 'ready_to_push',
  ).length;
  const woin = listChildrenMemory(
    'workordersin',
    (_id, doc) => String(doc.origin) === 'field' && doc.readyToPush === true,
  ).length;
  return woout + orders + woin;
}

/** Fallback COUNT when pending-ids API is missing. */
export async function pendingPushCountLocal(): Promise<number> {
  const wo = nFrom(await queryChildRowsIfNative(WOOUT_SQL));
  if (wo == null) return pendingPushCountMemory();
  const ord = nFrom(await queryChildRowsIfNative(ORDERS_SQL)) ?? 0;
  const inn = nFrom(await queryChildRowsIfNative(WOIN_SQL)) ?? 0;
  return wo + ord + inn;
}

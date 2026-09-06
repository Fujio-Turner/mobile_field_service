import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { attachLiveQuery, type LiveQueryHandle } from '../db/liveQuery';
import { applyParams, normalizeResults } from '../db/query';
import { deviceLocalDay } from '../ids';
import { listTodayOrders, TODAY_ORDERS_SQL } from './orders';

export type TodayOrderRow = { id: string; number: string; role: string; status: string };

export function parseTodayOrderRows(rows: Record<string, unknown>[]): TodayOrderRow[] {
  return rows
    .map((r) => ({
      id: String(r.id ?? ''),
      number: String(r.number ?? ''),
      role: String(r.role ?? ''),
      status: String(r.status ?? ''),
    }))
    .filter((r) => r.id);
}

/**
 * Live SQL++ for the Today orders card (`TODAY_ORDERS_SQL`).
 * Falls back to a one-shot when CBL live listeners are missing (tests / Expo Go).
 */
export async function watchTodayOrders(
  input: { employeeId: string; day?: string },
  onRows: (rows: TodayOrderRow[], meta: { error?: string }) => void,
): Promise<LiveQueryHandle> {
  const day = input.day ?? deviceLocalDay();
  const db = getOpenedDatabase();
  if (!nativeDbAvailable() || !db) {
    const first = await listTodayOrders(input.employeeId, day);
    onRows(
      first.map((row) => ({
        id: row.id,
        number: String(row.doc.number ?? ''),
        role: String(row.doc.role ?? ''),
        status: String(row.doc.status ?? ''),
      })),
      {},
    );
    return { stop: async () => undefined };
  }

  const query = db.createQuery(TODAY_ORDERS_SQL);
  await applyParams(query, { employeeId: input.employeeId, day });

  const live = await attachLiveQuery(query, (rows, error) => {
    if (error) {
      onRows([], { error });
      return;
    }
    onRows(parseTodayOrderRows(rows), {});
  });

  if (!live) {
    try {
      onRows(parseTodayOrderRows(normalizeResults(await query.execute())), {});
    } catch (e) {
      onRows([], { error: e instanceof Error ? e.message : 'Query failed' });
    }
  }

  return live ?? { stop: async () => undefined };
}

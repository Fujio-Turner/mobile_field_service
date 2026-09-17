import { getOpenedDatabase } from '../db/database';
import { runQuery } from '../db/query';
import { log } from '../log/logger';
import { loadChild } from '../ops/childStore';
import { FILTER_SOURCE } from './filters';

export type PushInspectRow = {
  id: string;
  syncState?: string;
  status?: string;
  origin?: string;
  type?: string;
  filterOk: boolean;
};

export type PushInspect = {
  sqlPending: number;
  nativePending: number | null;
  woout: PushInspectRow[];
  filterSrc: string;
};

export function evalPushFilterSrc(src: string, document: Record<string, unknown>): boolean {
  try {
    const fn = new Function(`return (${src});`)();
    return Boolean(fn(document, []));
  } catch {
    return false;
  }
}

const WOOUT_DUMP_SQL = `
SELECT META().id AS id, syncState, status, type, origin
FROM field.workordersout
`;

export async function inspectWorkordersoutPush(
  nativePending: number | null,
): Promise<PushInspect> {
  const src = FILTER_SOURCE.workordersout;
  const db = getOpenedDatabase();
  let rows: Record<string, unknown>[] = [];
  if (db) {
    try {
      rows = await runQuery(db, WOOUT_DUMP_SQL, {});
    } catch {
      rows = [];
    }
  }
  const woout: PushInspectRow[] = [];
  for (const r of rows) {
    const id = String(r.id ?? '');
    if (!id) continue;
    const raw = (await loadChild('workordersout', id)) ?? r;
    const syncState = raw.syncState != null ? String(raw.syncState) : undefined;
    const row: PushInspectRow = {
      id,
      syncState,
      status: raw.status != null ? String(raw.status) : undefined,
      origin: raw.origin != null ? String(raw.origin) : undefined,
      type: raw.type != null ? String(raw.type) : undefined,
      filterOk: evalPushFilterSrc(src, raw),
    };
    woout.push(row);
    log.info('mfs.repl.push_inspect', {
      op: 'InspectPush',
      docId: id,
      collection: 'workordersout',
      syncState: row.syncState,
      status: row.status,
      filterOk: row.filterOk,
    });
  }
  const sqlPending = woout.filter((w) => w.syncState === 'ready_to_push').length;
  const inspect: PushInspect = {
    sqlPending,
    nativePending,
    woout,
    filterSrc: src,
  };
  log.info('mfs.repl.push_inspect_sum', {
    op: 'InspectPush',
    sqlPending,
    nativePending: nativePending ?? -1,
    n: woout.length,
    filterSrc: src.slice(0, 120),
  });
  return inspect;
}

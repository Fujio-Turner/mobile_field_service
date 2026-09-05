import { getOpenedDatabase } from '../db/database';
import { runQuery } from '../db/query';
import { memoryOutboundRefs } from './memoryToday';
import { outboundForSourcesSql } from './todaySql';
import type { OutboundRef } from './todayTypes';

export function preferOutboundRef(prev: OutboundRef | undefined, next: OutboundRef): OutboundRef {
  if (!prev) return next;
  if (prev.role === 'primary' && next.role !== 'primary') return prev;
  if (next.role === 'primary' && prev.role !== 'primary') return next;
  const pa = prev.auditCrDt ?? Number.POSITIVE_INFINITY;
  const na = next.auditCrDt ?? Number.POSITIVE_INFINITY;
  if (na !== pa) return na < pa ? next : prev;
  return next.id < prev.id ? next : prev;
}

export function parseOutboundRefs(rows: Record<string, unknown>[]): Map<string, OutboundRef> {
  const map = new Map<string, OutboundRef>();
  for (const r of rows) {
    const sourceId = String(r.sourceId ?? '');
    const id = String(r.id ?? '');
    if (!sourceId || !id) continue;
    const next: OutboundRef = {
      id,
      sourceId,
      status: String(r.status ?? ''),
      role: String(r.role ?? 'primary'),
      auditCrDt: r.auditCrDt != null ? Number(r.auditCrDt) : undefined,
    };
    map.set(sourceId, preferOutboundRef(map.get(sourceId), next));
  }
  return map;
}

export async function findOutboundForSources(
  employeeId: string,
  sourceIds: string[],
): Promise<Map<string, OutboundRef>> {
  if (sourceIds.length === 0) return new Map();
  const db = getOpenedDatabase();
  if (!db) return memoryOutboundRefs(employeeId, sourceIds);
  const bounded = sourceIds.slice(0, 20);
  const params: Record<string, string | number> = { employeeId };
  bounded.forEach((id, i) => {
    params[`s${i}`] = id;
  });
  const rows = await runQuery(db, outboundForSourcesSql(bounded.length), params);
  return parseOutboundRefs(rows);
}

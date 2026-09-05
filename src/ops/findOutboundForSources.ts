import { getOpenedDatabase } from '../db/database';
import { runQuery } from '../db/query';
import { memoryOutboundRefs } from './memoryToday';
import { outboundForSourcesSql } from './todaySql';
import type { OutboundRef } from './todayTypes';

export function parseOutboundRefs(rows: Record<string, unknown>[]): Map<string, OutboundRef> {
  const map = new Map<string, OutboundRef>();
  for (const r of rows) {
    const sourceId = String(r.sourceId ?? '');
    const id = String(r.id ?? '');
    if (!sourceId || !id) continue;
    const prev = map.get(sourceId);
    if (prev && prev.role === 'primary' && r.role !== 'primary') continue;
    map.set(sourceId, {
      id,
      sourceId,
      status: String(r.status ?? ''),
      role: String(r.role ?? 'primary'),
    });
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

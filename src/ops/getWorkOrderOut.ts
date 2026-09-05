import { FIELD_SCOPE } from '../db/collections';
import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memoryGet } from '../db/memoryStore';
import { documentToObject } from './workOrderIn';

export type WorkOrderOut = {
  id: string;
  type: 'workorderout';
  number: string;
  priority: string;
  status: string;
  syncState: string;
  role: string;
  owner: string;
  summary: string;
  sourceId: string;
  assignedTo: { employeeId: string; email?: string; username?: string; displayName?: string };
  siteName: string;
  historyOps: string[];
};

export function parseWorkOrderOut(id: string, raw: Record<string, unknown> | null): WorkOrderOut | null {
  if (!raw) return null;
  if (raw.type != null && raw.type !== 'workorderout') return null;
  const source = (raw.source ?? {}) as { id?: string };
  const assigned = (raw.assignedTo ?? {}) as Record<string, unknown>;
  const site = (raw.site ?? {}) as { name?: string };
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    id,
    type: 'workorderout',
    number: String(raw.number ?? ''),
    priority: String(raw.priority ?? 'normal'),
    status: String(raw.status ?? ''),
    syncState: String(raw.syncState ?? ''),
    role: String(raw.role ?? 'primary'),
    owner: String(raw.owner ?? 'technician'),
    summary: String(raw.summary ?? ''),
    sourceId: String(source.id ?? ''),
    assignedTo: {
      employeeId: String(assigned.employeeId ?? ''),
      email: assigned.email != null ? String(assigned.email) : undefined,
      username: assigned.username != null ? String(assigned.username) : undefined,
      displayName: assigned.displayName != null ? String(assigned.displayName) : undefined,
    },
    siteName: String(site.name ?? ''),
    historyOps: history.map((h) => String((h as { op?: string }).op ?? '')),
  };
}

export async function getWorkOrderOut(id: string): Promise<WorkOrderOut | null> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const db = getOpenedDatabase();
    const col = (await db!.collection('workordersout', FIELD_SCOPE)) as {
      document: (docId: string) => Promise<unknown>;
    } | null;
    if (!col) return null;
    return parseWorkOrderOut(id, documentToObject(await col.document(id)));
  }
  return parseWorkOrderOut(id, memoryGet('workordersout', id));
}

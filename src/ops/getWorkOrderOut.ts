import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memoryGet } from '../db/memoryStore';
import { isFrozen } from './outStatus';
import type { PhotoMeta } from './photoKeys';
import { documentToObject } from './workOrderIn';

export type WorkOrderOutOp = { id?: string; name?: string; status?: string; required?: boolean };
export type WorkOrderOutCheck = { id?: string; label?: string; done?: boolean; required?: boolean };

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
  operations: WorkOrderOutOp[];
  checklist: WorkOrderOutCheck[];
  blockedReason?: string;
  blockedNote?: string;
  cancelledReason?: string;
  amendsId?: string;
  editable: boolean;
  photos: PhotoMeta[];
  materials: Array<{ productId: string; sku?: string; description?: string; qtyUsed: number; uom?: string }>;
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
    operations: (Array.isArray(raw.operations) ? raw.operations : []).map((op) => {
      const r = op as Record<string, unknown>;
      return {
        id: r.id != null ? String(r.id) : undefined,
        name: r.name != null ? String(r.name) : undefined,
        status: r.status != null ? String(r.status) : 'pending',
        required: Boolean(r.required),
      };
    }),
    checklist: (Array.isArray(raw.checklist) ? raw.checklist : []).map((c) => {
      const r = c as Record<string, unknown>;
      return {
        id: r.id != null ? String(r.id) : undefined,
        label: r.label != null ? String(r.label) : undefined,
        done: Boolean(r.done),
        required: Boolean(r.required),
      };
    }),
    blockedReason: raw.blockedReason != null ? String(raw.blockedReason) : undefined,
    blockedNote: raw.blockedNote != null ? String(raw.blockedNote) : undefined,
    cancelledReason: raw.cancelledReason != null ? String(raw.cancelledReason) : undefined,
    amendsId: raw.amends != null ? String((raw.amends as { id?: string }).id ?? '') : undefined,
    editable: !isFrozen(raw),
    photos: Array.isArray(raw.photos) ? (raw.photos as PhotoMeta[]) : [],
    materials: (Array.isArray(raw.materials) ? raw.materials : []).map((m) => {
      const r = m as Record<string, unknown>;
      return {
        productId: String(r.productId ?? ''),
        sku: r.sku != null ? String(r.sku) : undefined,
        description: r.description != null ? String(r.description) : undefined,
        qtyUsed: Number(r.qtyUsed ?? 0),
        uom: r.uom != null ? String(r.uom) : undefined,
      };
    }),
  };
}

export async function getWorkOrderOut(id: string): Promise<WorkOrderOut | null> {
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf('workordersout')) as {
      document: (docId: string) => Promise<unknown>;
    } | null;
    if (!col) return null;
    return parseWorkOrderOut(id, documentToObject(await col.document(id)));
  }
  return parseWorkOrderOut(id, memoryGet('workordersout', id));
}

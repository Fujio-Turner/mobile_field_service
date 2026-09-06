import { loadChild } from './childStore';
import { loadOutboundRaw } from './outboundStore';

export const COMPARE_PATHS = [
  'summary',
  'priority',
  'kind',
  'scheduled.day',
  'scheduled.startDt',
  'site.name',
  'assignedTo.employeeId',
  'orderId',
  'assetIds',
  'taskIds',
  'operations',
  'checklist',
  'materials',
] as const;

/** Kit paths that may be copied inbound → outbound. Not assignedTo (reassign is a separate rule). */
export const APPLY_PATHS = COMPARE_PATHS.filter((p) => p !== 'assignedTo.employeeId');

export function previewValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  if (typeof v === 'object') return '…';
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

export type KitFieldDiff = {
  key: string;
  path: string;
  local: string;
  remote: string;
  snapshot: string;
  dirty: boolean;
  inboundChanged: boolean;
};

export function kitFieldDiffs(input: {
  local: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  remote: Record<string, unknown> | null;
}): KitFieldDiff[] {
  if (!input.remote) return [];
  const rows: KitFieldDiff[] = [];
  for (const path of APPLY_PATHS) {
    const snapshot = atPath(input.snapshot, path);
    const local = atPath(input.local, path);
    const remote = atPath(input.remote, path);
    const inboundChanged = stable(snapshot) !== stable(remote);
    if (!inboundChanged) continue;
    rows.push({
      key: path.split('.')[0],
      path,
      local: previewValue(local),
      remote: previewValue(remote),
      snapshot: previewValue(snapshot),
      dirty: stable(local) !== stable(snapshot),
      inboundChanged: true,
    });
  }
  const byKey = new Map<string, KitFieldDiff>();
  for (const row of rows) {
    const prev = byKey.get(row.key);
    if (!prev) byKey.set(row.key, row);
    else byKey.set(row.key, { ...prev, dirty: prev.dirty || row.dirty });
  }
  return [...byKey.values()];
}

export function outboundIsUntouched(doc: Record<string, unknown>): boolean {
  const hist = Array.isArray(doc.history) ? doc.history : [];
  if (hist.length === 0) return true;
  return hist.every((h) => String((h as { op?: string }).op ?? '') === 'StartWork');
}

export function inboundIsGone(live: Record<string, unknown> | null): boolean {
  if (!live) return true;
  const status = String(live.status ?? '');
  return status === 'cancelled' || status === 'superseded';
}

function atPath(doc: Record<string, unknown> | undefined, path: string): unknown {
  if (!doc) return undefined;
  const parts = path.split('.');
  let cur: unknown = doc;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function stable(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return JSON.stringify(
      v.map((item) => {
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          return {
            id: rec.id ?? rec.sku ?? rec.productId,
            name: rec.name ?? rec.label,
            required: rec.required,
            qty: rec.qtyPlanned ?? rec.qty,
          };
        }
        return item;
      }),
    );
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Field names on live inbound that differ from `source.snapshot`. Never auto-merge. */
export function dispatchChangedFields(
  snapshot: Record<string, unknown> | undefined,
  live: Record<string, unknown> | null,
): string[] {
  if (!snapshot || !live) return [];
  const changed: string[] = [];
  for (const path of COMPARE_PATHS) {
    if (stable(atPath(snapshot, path)) !== stable(atPath(live, path))) {
      changed.push(path.split('.')[0]);
    }
  }
  return [...new Set(changed)];
}

export async function inboundUpdateVsCopy(
  wooutId: string,
): Promise<{ fields: string[]; inboundMissing: boolean; inboundId: string | null }> {
  const out = await loadOutboundRaw(wooutId);
  if (!out) return { fields: [], inboundMissing: true, inboundId: null };
  const source = (out.source as { id?: string; snapshot?: Record<string, unknown> } | undefined) ?? {};
  const inboundId = source.id ? String(source.id) : null;
  if (!inboundId) return { fields: [], inboundMissing: true, inboundId: null };
  const live = await loadChild('workordersin', inboundId);
  if (!live) return { fields: [], inboundMissing: true, inboundId };
  return {
    fields: dispatchChangedFields(source.snapshot, live),
    inboundMissing: false,
    inboundId,
  };
}

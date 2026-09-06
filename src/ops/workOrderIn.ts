export type AssignedTo = {
  employeeId: string;
  email?: string;
  username?: string;
  displayName?: string;
  userId?: string;
};

export type WorkOrderIn = {
  id: string;
  type: 'workorderin';
  origin: 'dispatch' | 'field' | string;
  number: string;
  priority: string;
  status: string;
  kind?: string;
  summary: string;
  description?: string;
  assignedTo: AssignedTo;
  customerId?: string;
  site: {
    name: string;
    address?: {
      line1?: string;
      city?: string;
      region?: string;
      postal?: string;
      country?: string;
    };
    geo?: { lat: number; lon: number; accuracyM?: number };
  };
  scheduled: { startDt: number; endDt?: number; day?: string };
  operations: Array<{
    id?: string;
    name?: string;
    code?: string;
    status?: string;
    required?: boolean;
  }>;
  materials: Array<{ sku?: string; name?: string; qtyPlanned?: number; productId?: string }>;
  assetIds: string[];
  orderId?: string;
  move?: {
    from?: { name?: string; geo?: { lat: number; lon: number } };
    to?: { name?: string; geo?: { lat: number; lon: number } };
  };
  checklist: Array<{ id?: string; label?: string; done?: boolean; required?: boolean }>;
};

export function documentToObject(doc: unknown): Record<string, unknown> | null {
  if (!doc || typeof doc !== 'object') return null;
  const rec = doc as Record<string, unknown>;
  if (typeof rec.getData === 'function') {
    const data = (rec.getData as () => unknown)();
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data) as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  }
  if (typeof rec.toDictionary === 'function') {
    const data = (rec.toDictionary as () => unknown)();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  }
  if (typeof rec.toJSON === 'function') {
    const data = (rec.toJSON as () => unknown)();
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    if (data && typeof data === 'object') return data as Record<string, unknown>;
  }
  return rec;
}

function asList(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
}

function parseMovePoint(raw: unknown): { name?: string; geo?: { lat: number; lon: number } } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as Record<string, unknown>;
  const geo = rec.geo as { lat?: unknown; lon?: unknown } | undefined;
  return {
    name: rec.name != null ? String(rec.name) : undefined,
    geo:
      geo?.lat != null && geo?.lon != null ? { lat: Number(geo.lat), lon: Number(geo.lon) } : undefined,
  };
}

export function parseWorkOrderIn(id: string, raw: Record<string, unknown> | null): WorkOrderIn | null {
  if (!raw) return null;
  if (raw.type != null && raw.type !== 'workorderin') return null;
  const assigned = (raw.assignedTo ?? {}) as Record<string, unknown>;
  const site = (raw.site ?? {}) as Record<string, unknown>;
  const address = (site.address ?? {}) as Record<string, unknown>;
  const geo = (site.geo ?? {}) as Record<string, unknown>;
  const scheduled = (raw.scheduled ?? {}) as Record<string, unknown>;
  const employeeId = String(assigned.employeeId ?? '');
  if (!employeeId || !raw.number) return null;
  return {
    id,
    type: 'workorderin',
    origin: String(raw.origin ?? 'dispatch'),
    number: String(raw.number),
    priority: String(raw.priority ?? 'normal'),
    status: String(raw.status ?? ''),
    kind: raw.kind != null ? String(raw.kind) : undefined,
    summary: String(raw.summary ?? ''),
    description: raw.description != null ? String(raw.description) : undefined,
    assignedTo: {
      employeeId,
      email: assigned.email != null ? String(assigned.email) : undefined,
      username: assigned.username != null ? String(assigned.username) : undefined,
      displayName: assigned.displayName != null ? String(assigned.displayName) : undefined,
      userId: assigned.userId != null ? String(assigned.userId) : undefined,
    },
    customerId: raw.customerId != null ? String(raw.customerId) : undefined,
    site: {
      name: String(site.name ?? ''),
      address: {
        line1: address.line1 != null ? String(address.line1) : undefined,
        city: address.city != null ? String(address.city) : undefined,
        region: address.region != null ? String(address.region) : undefined,
        postal: address.postal != null ? String(address.postal) : undefined,
        country: address.country != null ? String(address.country) : undefined,
      },
      geo:
        geo.lat != null && geo.lon != null
          ? { lat: Number(geo.lat), lon: Number(geo.lon), accuracyM: geo.accuracyM != null ? Number(geo.accuracyM) : undefined }
          : undefined,
    },
    scheduled: {
      startDt: Number(scheduled.startDt ?? 0),
      endDt: scheduled.endDt != null ? Number(scheduled.endDt) : undefined,
      day: scheduled.day != null ? String(scheduled.day) : undefined,
    },
    operations: asList(raw.operations).map((op) => ({
      id: op.id != null ? String(op.id) : undefined,
      name: op.name != null ? String(op.name) : undefined,
      code: op.code != null ? String(op.code) : undefined,
      status: op.status != null ? String(op.status) : undefined,
      required: Boolean(op.required),
    })),
    materials: asList(raw.materials).map((m) => ({
      sku: m.sku != null ? String(m.sku) : undefined,
      name: m.name != null ? String(m.name) : undefined,
      productId: m.productId != null ? String(m.productId) : undefined,
      qtyPlanned: m.qtyPlanned != null ? Number(m.qtyPlanned) : undefined,
    })),
    assetIds: Array.isArray(raw.assetIds) ? raw.assetIds.map((a) => String(a)) : [],
    orderId: raw.orderId != null ? String(raw.orderId) : undefined,
    move: raw.move
      ? {
          from: parseMovePoint((raw.move as { from?: unknown }).from),
          to: parseMovePoint((raw.move as { to?: unknown }).to),
        }
      : undefined,
    checklist: asList(raw.checklist).map((c) => ({
      id: c.id != null ? String(c.id) : undefined,
      label: c.label != null ? String(c.label) : undefined,
      done: Boolean(c.done),
      required: Boolean(c.required),
    })),
  };
}

export type KvCollection = {
  document: (id: string) => Promise<unknown>;
  save?: (doc: unknown) => Promise<void>;
};

/** KV get only. Never save. */
export async function getWorkOrderInFromCollection(
  col: KvCollection,
  id: string,
): Promise<WorkOrderIn | null> {
  const doc = await col.document(id);
  if (!doc) return null;
  return parseWorkOrderIn(id, documentToObject(doc));
}

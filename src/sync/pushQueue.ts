import { saveTmp, loadTmp } from '../ops/tmp';

export const PUSH_SUCCESS_TMP_ID = 'tmp:push-success';
export const PUSH_PENDING_TMP_ID = 'tmp:push-pending';
export const PUSH_QUEUE_CAP = 10;

export type PushQueueItem = {
  id: string;
  collection: string;
  dt?: number;
};

export function nextSuccessList(
  prev: PushQueueItem[],
  item: PushQueueItem,
  cap = PUSH_QUEUE_CAP,
): PushQueueItem[] {
  const without = prev.filter((p) => !(p.id === item.id && p.collection === item.collection));
  return [item, ...without].slice(0, cap);
}

export function nextPendingList(items: PushQueueItem[], cap = PUSH_QUEUE_CAP): PushQueueItem[] {
  return items.slice(0, cap);
}

/** RN may bridge NSArray/NSSet as a non-iterable object. Never for-of the raw result. */
export function asStringIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (typeof raw === 'string') return raw ? [raw] : [];
  if (typeof raw === 'object') {
    const o = raw as { forEach?: (cb: (v: unknown) => void) => void; pendingDocumentIds?: unknown };
    if (o.pendingDocumentIds != null && o.pendingDocumentIds !== raw) {
      return asStringIds(o.pendingDocumentIds);
    }
    if (typeof o.forEach === 'function') {
      const out: string[] = [];
      o.forEach((v) => {
        const s = String(v ?? '');
        if (s) out.push(s);
      });
      return out;
    }
    return Object.values(o)
      .map((v) => String(v ?? ''))
      .filter((s) => s && s !== '[object Object]');
  }
  return [];
}

function parseItems(doc: Record<string, unknown> | null): PushQueueItem[] {
  if (!doc || !Array.isArray(doc.items)) return [];
  return doc.items
    .map((row) => {
      const r = row as { id?: unknown; collection?: unknown; dt?: unknown };
      const id = String(r.id ?? '');
      const collection = String(r.collection ?? '');
      if (!id || !collection) return null;
      return { id, collection, dt: r.dt != null ? Number(r.dt) : undefined };
    })
    .filter((x): x is PushQueueItem => x != null);
}

export async function loadPushSuccess(): Promise<PushQueueItem[]> {
  return parseItems(await loadTmp(PUSH_SUCCESS_TMP_ID));
}

export async function loadPushPending(): Promise<PushQueueItem[]> {
  return parseItems(await loadTmp(PUSH_PENDING_TMP_ID));
}

export async function recordPushSuccess(item: PushQueueItem): Promise<PushQueueItem[]> {
  const next = nextSuccessList(await loadPushSuccess(), item);
  await saveTmp(PUSH_SUCCESS_TMP_ID, {
    type: 'tmp',
    kind: 'push_success',
    items: next,
  });
  return next;
}

export async function recordPushPending(items: PushQueueItem[]): Promise<PushQueueItem[]> {
  const next = nextPendingList(items);
  await saveTmp(PUSH_PENDING_TMP_ID, {
    type: 'tmp',
    kind: 'push_pending',
    items: next,
  });
  return next;
}

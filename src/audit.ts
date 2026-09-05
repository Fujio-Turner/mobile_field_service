export const HISTORY_CAP = 100;
export const SKIP_HISTORY_OPS = new Set(['SetSyncState']);

export type AuditActorStamp = {
  dt: number;
  ver: string;
  by: string;
};

export type Audit = {
  cr: AuditActorStamp;
  up: AuditActorStamp;
};

export type HistoryChange = {
  path: string;
  from?: unknown;
  to?: unknown;
};

export type HistoryGeo = {
  lat?: number;
  lon?: number;
  accuracyM?: number;
};

export type HistoryEntry = HistoryGeo & {
  dt: number;
  by: string;
  ver: string;
  op: string;
  changes?: HistoryChange[];
};

export type AuditedDoc = {
  audit: Audit;
  history?: HistoryEntry[];
  historyTruncated?: boolean;
  lastAction?: unknown;
};

export function nowSec(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000);
}

export function stampAuditCreate<T extends Record<string, unknown>>(
  doc: T,
  input: { by: string; ver: string; dt?: number },
): T & { audit: Audit } {
  const stamp: AuditActorStamp = {
    dt: input.dt ?? nowSec(),
    ver: input.ver,
    by: input.by,
  };
  const next = { ...doc, audit: { cr: stamp, up: { ...stamp } } };
  delete (next as { lastAction?: unknown }).lastAction;
  return next;
}

export function stampAuditUpdate<T extends { audit: Audit }>(
  doc: T,
  input: { by: string; ver: string; dt?: number },
): T {
  return {
    ...doc,
    audit: {
      cr: doc.audit.cr,
      up: { dt: input.dt ?? nowSec(), ver: input.ver, by: input.by },
    },
  };
}

export function stampHistory<T extends { audit: Audit }>(
  doc: T & Partial<Pick<AuditedDoc, 'history' | 'historyTruncated' | 'lastAction'>>,
  input: {
    op: string;
    by: string;
    ver: string;
    dt?: number;
    changes?: HistoryChange[];
    geo?: HistoryGeo;
  },
): T & { history: HistoryEntry[]; historyTruncated?: boolean } {
  if (SKIP_HISTORY_OPS.has(input.op)) {
    const next = { ...doc, history: doc.history ?? [] };
    delete (next as { lastAction?: unknown }).lastAction;
    return next;
  }
  const entry: HistoryEntry = {
    dt: input.dt ?? nowSec(),
    by: input.by,
    ver: input.ver,
    op: input.op,
  };
  if (input.geo?.lat != null) entry.lat = input.geo.lat;
  if (input.geo?.lon != null) entry.lon = input.geo.lon;
  if (input.geo?.accuracyM != null) entry.accuracyM = input.geo.accuracyM;
  if (input.changes && input.changes.length > 0) entry.changes = input.changes;

  const prev = doc.history ?? [];
  const history = [...prev, entry];
  let historyTruncated = doc.historyTruncated === true;
  while (history.length > HISTORY_CAP) {
    history.shift();
    historyTruncated = true;
  }
  const next = { ...doc, history } as T & {
    history: HistoryEntry[];
    historyTruncated?: boolean;
  };
  if (historyTruncated) next.historyTruncated = true;
  delete (next as { lastAction?: unknown }).lastAction;
  return next;
}

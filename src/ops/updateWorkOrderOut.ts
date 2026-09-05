import { nowSec, stampAuditUpdate, stampHistory } from '../audit';
import { appVersion } from '../version';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { isFrozen } from './outStatus';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';

export type OutPatch = {
  summary?: string;
  operations?: unknown[];
  checklist?: unknown[];
  siteGeo?: { lat: number; lon: number; accuracyM?: number };
};

export function applyOutPatch(
  doc: Record<string, unknown>,
  patch: OutPatch,
  session: StartSession,
  dt = nowSec(),
  ver = appVersion(),
): Record<string, unknown> {
  if (isFrozen(doc)) throw new OutError('frozen');
  const changes: Array<{ path: string; from?: unknown; to?: unknown }> = [];
  let next = { ...doc };
  if (patch.summary != null && patch.summary !== doc.summary) {
    changes.push({ path: 'summary', from: doc.summary, to: patch.summary });
    next = { ...next, summary: patch.summary };
  }
  if (patch.operations) {
    changes.push({ path: 'operations', from: '(list)', to: '(list)' });
    next = { ...next, operations: patch.operations };
  }
  if (patch.checklist) {
    changes.push({ path: 'checklist', from: '(list)', to: '(list)' });
    next = { ...next, checklist: patch.checklist };
  }
  if (patch.siteGeo) {
    const site = { ...((doc.site as Record<string, unknown>) ?? {}), geo: patch.siteGeo };
    changes.push({ path: 'site.geo', to: `${patch.siteGeo.lat},${patch.siteGeo.lon}` });
    next = { ...next, site };
  }
  next = stampAuditUpdate(next as never, {
    by: session.username,
    ver,
    dt,
  });
  return stampHistory(next as never, {
    op: 'UpdateWorkOrderOutFields',
    by: session.username,
    ver,
    dt,
    changes,
  });
}

export async function updateWorkOrderOutFields(
  id: string,
  patch: OutPatch,
  session: StartSession,
): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  await saveOutboundRaw(id, applyOutPatch(doc, patch, session));
}

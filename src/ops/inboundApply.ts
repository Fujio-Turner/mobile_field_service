import { nowSec, stampAuditUpdate, stampHistory } from '../audit';
import type { JobRules } from '../dev/jobRules';
import { log } from '../log/logger';
import { inboundSnapshot, type StartSession } from './copyInbound';
import {
  inboundIsGone,
  kitFieldDiffs,
  outboundIsUntouched,
  type KitFieldDiff,
} from './inboundDiff';
import { loadChild } from './childStore';
import { OutError } from './outError';
import { isFrozen } from './outStatus';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
import { appVersion } from '../version';

export type InboundAction = 'none' | 'apply' | 'drop' | 'prompt';

export function decideInboundAction(input: {
  rules: JobRules;
  untouched: boolean;
  gone: boolean;
  diffs: KitFieldDiff[];
}): InboundAction {
  if (input.gone && input.untouched) return 'drop';
  if (input.gone) return 'none';
  if (input.diffs.length === 0) return 'none';
  if (input.untouched) return 'apply';
  if (input.rules.inbound === 'remote_wins') return 'apply';
  if (input.rules.inbound === 'local_wins') return 'none';
  return 'prompt';
}

function copyPath(
  from: Record<string, unknown>,
  onto: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { ...onto, [path]: from[path] };
  }
  const head = parts[0];
  const rest = parts.slice(1).join('.');
  const fromHead = (from[head] as Record<string, unknown> | undefined) ?? {};
  const ontoHead = { ...((onto[head] as Record<string, unknown> | undefined) ?? {}) };
  if (head === 'site' && rest === 'name') {
    return { ...onto, site: { ...ontoHead, name: fromHead.name, address: fromHead.address } };
  }
  const nested = copyPath(fromHead, ontoHead, rest);
  return { ...onto, [head]: nested };
}

export function applyInboundKit(
  outbound: Record<string, unknown>,
  inbound: Record<string, unknown>,
  inboundId: string,
  keys: string[],
  session: StartSession,
): Record<string, unknown> {
  if (isFrozen(outbound)) throw new OutError('frozen');
  let next = { ...outbound };
  const skip = new Set(['taskIds', 'materials', 'assignedTo']);
  const unique = [...new Set(keys)].filter((k) => !skip.has(k));
  for (const key of unique) {
    if (key === 'assignedTo' || key === 'site') {
      next = copyPath(inbound, next, key === 'site' ? 'site.name' : key);
      continue;
    }
    if (key === 'scheduled') {
      next = { ...next, scheduled: inbound.scheduled };
      continue;
    }
    if (inbound[key] !== undefined) next = { ...next, [key]: inbound[key] };
  }
  const src = inboundSnapshot(inbound, inboundId) as { snapshot?: Record<string, unknown> };
  const prevSource = { ...((outbound.source as Record<string, unknown> | undefined) ?? {}) };
  next = {
    ...next,
    source: {
      ...prevSource,
      ...src,
      dropped: false,
    },
  };
  const ver = appVersion();
  const dt = nowSec();
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  return stampHistory(next as never, {
    op: 'ApplyInboundKit',
    by: session.username,
    ver,
    dt,
    changes: unique.map((path) => ({ path, to: '(inbound)' })),
  });
}

export function markOutboundDropped(
  outbound: Record<string, unknown>,
  session: StartSession,
): Record<string, unknown> {
  const prevSource = { ...((outbound.source as Record<string, unknown> | undefined) ?? {}) };
  let next: Record<string, unknown> = { ...outbound, source: { ...prevSource, dropped: true } };
  const ver = appVersion();
  const dt = nowSec();
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  return stampHistory(next as never, {
    op: 'DropUntouchedInbound',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'source.dropped', to: true }],
  });
}

export async function inspectInboundVsCopy(
  wooutId: string,
  outboundRaw?: Record<string, unknown> | null,
): Promise<{
  outbound: Record<string, unknown> | null;
  inbound: Record<string, unknown> | null;
  inboundId: string | null;
  untouched: boolean;
  gone: boolean;
  diffs: KitFieldDiff[];
}> {
  const outbound = outboundRaw !== undefined ? outboundRaw : await loadOutboundRaw(wooutId);
  if (!outbound) {
    return { outbound: null, inbound: null, inboundId: null, untouched: true, gone: true, diffs: [] };
  }
  const source = (outbound.source as { id?: string; snapshot?: Record<string, unknown> } | undefined) ?? {};
  const inboundId = source.id ? String(source.id) : null;
  const inbound = inboundId ? await loadChild('workordersin', inboundId) : null;
  const gone = inboundIsGone(inbound);
  const diffs = kitFieldDiffs({ local: outbound, snapshot: source.snapshot, remote: inbound });
  return {
    outbound,
    inbound,
    inboundId,
    untouched: outboundIsUntouched(outbound),
    gone,
    diffs,
  };
}

export async function applyInboundDecision(
  wooutId: string,
  session: StartSession,
  rules: JobRules,
  picks?: Record<string, 'local' | 'remote'>,
  inspectRaw?: Awaited<ReturnType<typeof inspectInboundVsCopy>>,
): Promise<{ action: InboundAction; applied: string[]; outbound?: Record<string, unknown> }> {
  const inspect = inspectRaw ?? (await inspectInboundVsCopy(wooutId));
  if (!inspect.outbound) throw new OutError('missing');
  const action = decideInboundAction({
    rules,
    untouched: inspect.untouched,
    gone: inspect.gone,
    diffs: inspect.diffs,
  });
  if (action === 'drop') {
    const dropped = markOutboundDropped(inspect.outbound, session);
    await saveOutboundRaw(wooutId, dropped);
    log.info('mfs.wo.inbound_drop', {
      op: 'DropUntouchedInbound',
      collection: 'workordersout',
      docId: wooutId,
    });
    return { action, applied: ['source.dropped'], outbound: dropped };
  }
  if (action === 'none' || action === 'prompt') {
    if (action === 'prompt' && picks && inspect.inbound && inspect.inboundId) {
      const keys = inspect.diffs.filter((d) => (picks[d.key] ?? (d.dirty ? 'local' : 'remote')) === 'remote').map((d) => d.key);
      if (keys.length === 0) return { action: 'none', applied: [] };
      const picked = applyInboundKit(inspect.outbound, inspect.inbound, inspect.inboundId, keys, session);
      await saveOutboundRaw(wooutId, picked);
      log.info('mfs.wo.inbound_apply', {
        op: 'ApplyInboundKit',
        collection: 'workordersout',
        docId: wooutId,
        fields: keys.join(','),
        policy: 'prompt',
      });
      return { action: 'apply', applied: keys, outbound: picked };
    }
    return { action, applied: [] };
  }
  if (!inspect.inbound || !inspect.inboundId) return { action: 'none', applied: [] };
  const keys = inspect.diffs.map((d) => d.key);
  const outbound = applyInboundKit(inspect.outbound, inspect.inbound, inspect.inboundId, keys, session);
  await saveOutboundRaw(wooutId, outbound);
  log.info('mfs.wo.inbound_apply', {
    op: 'ApplyInboundKit',
    collection: 'workordersout',
    docId: wooutId,
    fields: keys.join(','),
    policy: inspect.untouched ? 'untouched' : rules.inbound,
  });
  return { action: 'apply', applied: keys, outbound };
}

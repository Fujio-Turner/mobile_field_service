import { nowSec } from '../audit';
import { FIELD_SCOPE } from '../db/collections';
import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { runQuery } from '../db/query';
import { memoryAll, memoryDelete, memoryGet, memorySave } from '../db/memoryStore';
import { purgeJsonDoc, saveJsonDoc } from '../db/saveJson';
import { seedInboundJobs, seedTaskTemplates } from '../db/seedData';
import { newDocId } from '../ids';
import { bumpCopyOnWrite } from '../metrics/copyOnWrite';
import { appVersion } from '../version';
import { cloneTaskIds, shouldCloneTask, buildTaskInstance } from './cloneTasks';
import {
  assertInboundStartable,
  buildWorkOrderOut,
  pickOldestPrimary,
  type StartSession,
} from './copyInbound';
import { documentToObject } from './workOrderIn';

export class StartWorkError extends Error {
  constructor(public code: 'missing' | 'inbound_not_startable' | 'inbound_not_assigned') {
    super(code);
    this.name = 'StartWorkError';
  }
}

export type StartWorkResult = { wooutId: string; created: boolean };

function auditCrDt(doc: Record<string, unknown>): number {
  const audit = doc.audit as { cr?: { dt?: number } } | undefined;
  return Number(audit?.cr?.dt ?? 0);
}

function inboundRawFromSeed(woinId: string): Record<string, unknown> | null {
  const hit = seedInboundJobs(appVersion(), nowSec()).find((j) => j.id === woinId);
  return hit ? (hit.doc as unknown as Record<string, unknown>) : null;
}

function loadTaskMemory(id: string): Record<string, unknown> | null {
  const existing = memoryGet('tasks', id);
  if (existing) return existing;
  const hit = seedTaskTemplates(appVersion(), 0).find((row) => row.id === id);
  return hit ? (hit.doc as unknown as Record<string, unknown>) : null;
}

export function findPrimaryOutIds(
  docs: Array<{ id: string; doc: Record<string, unknown> }>,
  employeeId: string,
  sourceId: string,
): Array<{ id: string; auditCrDt: number }> {
  return docs
    .filter((row) => {
      const src = row.doc.source as { id?: string } | undefined;
      const assigned = row.doc.assignedTo as { employeeId?: string } | undefined;
      return row.doc.role === 'primary' && src?.id === sourceId && assigned?.employeeId === employeeId;
    })
    .map((row) => ({ id: row.id, auditCrDt: auditCrDt(row.doc) }));
}

export async function startWork(woinId: string, session: StartSession): Promise<StartWorkResult> {
  if (nativeDbAvailable() && getOpenedDatabase()) return startWorkCbl(woinId, session);
  return startWorkMemory(woinId, session);
}

async function startWorkMemory(woinId: string, session: StartSession): Promise<StartWorkResult> {
  const inbound = memoryGet('workordersin', woinId) ?? inboundRawFromSeed(woinId);
  if (!inbound) throw new StartWorkError('missing');
  const gate = assertInboundStartable(inbound, session.employeeId);
  if (gate !== 'ok') throw new StartWorkError(gate);

  const existing = findPrimaryOutIds(memoryAll('workordersout'), session.employeeId, woinId);
  const winner = pickOldestPrimary(existing);
  if (winner) {
    bumpCopyOnWrite('idempotent_hit');
    return { wooutId: winner, created: false };
  }

  return persistCopy({ inbound, woinId, session, saveOut: memorySave, saveTask: memorySave, deleteOut: memoryDelete, deleteTask: memoryDelete, listPrimary: () => findPrimaryOutIds(memoryAll('workordersout'), session.employeeId, woinId), loadTask: loadTaskMemory });
}

async function startWorkCbl(woinId: string, session: StartSession): Promise<StartWorkResult> {
  const db = getOpenedDatabase();
  if (!db) throw new StartWorkError('missing');
  const inCol = (await db.collection('workordersin', FIELD_SCOPE)) as {
    document: (id: string) => Promise<unknown>;
  } | null;
  const outCol = (await db.collection('workordersout', FIELD_SCOPE)) as {
    save: (doc: unknown) => Promise<void>;
    purge?: (id: string) => Promise<void>;
  } | null;
  const taskCol = (await db.collection('tasks', FIELD_SCOPE)) as {
    document: (id: string) => Promise<unknown>;
    save: (doc: unknown) => Promise<void>;
    purge?: (id: string) => Promise<void>;
  } | null;
  if (!inCol || !outCol) throw new StartWorkError('missing');

  const inbound = documentToObject(await inCol.document(woinId));
  if (!inbound) throw new StartWorkError('missing');
  const gate = assertInboundStartable(inbound, session.employeeId);
  if (gate !== 'ok') throw new StartWorkError(gate);

  const fromCbl = await listPrimaryOutCbl(session.employeeId, woinId);
  const winner = pickOldestPrimary(fromCbl);
  if (winner) {
    bumpCopyOnWrite('idempotent_hit');
    return { wooutId: winner, created: false };
  }

  return persistCopy({
    inbound,
    woinId,
    session,
    loadTask: () => null,
    loadTaskAsync: taskCol
      ? async (id) => documentToObject(await taskCol.document(id))
      : undefined,
    saveOut: async (_c, id, body) => saveJsonDoc(outCol, id, body),
    saveTask: async (_c, id, body) => {
      if (taskCol) await saveJsonDoc(taskCol, id, body);
    },
    deleteOut: async (_c, id) => purgeJsonDoc(outCol, id),
    deleteTask: async (_c, id) => {
      if (taskCol) await purgeJsonDoc(taskCol, id);
    },
    listPrimary: () => listPrimaryOutCbl(session.employeeId, woinId),
  });
}

type PersistFns = {
  inbound: Record<string, unknown>;
  woinId: string;
  session: StartSession;
  loadTask: (id: string) => Record<string, unknown> | null;
  loadTaskAsync?: (id: string) => Promise<Record<string, unknown> | null>;
  saveOut: (collection: string, id: string, body: Record<string, unknown>) => void | Promise<void>;
  saveTask: (collection: string, id: string, body: Record<string, unknown>) => void | Promise<void>;
  deleteOut: (collection: string, id: string) => void | Promise<void>;
  deleteTask: (collection: string, id: string) => void | Promise<void>;
  listPrimary: () => Array<{ id: string; auditCrDt: number }> | Promise<Array<{ id: string; auditCrDt: number }>>;
};

async function persistCopy(fns: PersistFns): Promise<StartWorkResult> {
  const ver = appVersion();
  const dt = nowSec();
  const outId = newDocId('woout');
  let cloned = cloneTaskIds(fns.inbound.taskIds, fns.loadTask, { outId, session: fns.session, ver, dt });
  if (fns.loadTaskAsync && Array.isArray(fns.inbound.taskIds)) {
    for (const templateId of fns.inbound.taskIds.map(String)) {
      const raw = await fns.loadTaskAsync(templateId);
      if (!shouldCloneTask(raw)) continue;
      const instanceId = newDocId('tsk');
      cloned.instances.push({
        id: instanceId,
        doc: buildTaskInstance({
          template: raw as Record<string, unknown>,
          templateId,
          outId,
          instanceId,
          session: fns.session,
          ver,
          dt,
        }),
      });
      cloned.instanceIds.push(instanceId);
    }
  }
  const body = {
    ...buildWorkOrderOut({
      inboundRaw: fns.inbound,
      inboundId: fns.woinId,
      outId,
      session: fns.session,
      ver,
      dt,
    }),
    taskIds: cloned.instanceIds,
  };
  await fns.saveOut('workordersout', outId, body);
  for (const inst of cloned.instances) await fns.saveTask('tasks', inst.id, inst.doc);

  const after = await fns.listPrimary();
  const keep = pickOldestPrimary(after) ?? outId;
  if (keep !== outId) {
    await fns.deleteOut('workordersout', outId);
    for (const inst of cloned.instances) await fns.deleteTask('tasks', inst.id);
    bumpCopyOnWrite('idempotent_hit');
    return { wooutId: keep, created: false };
  }
  bumpCopyOnWrite('created');
  return { wooutId: outId, created: true };
}

async function listPrimaryOutCbl(
  employeeId: string,
  sourceId: string,
): Promise<Array<{ id: string; auditCrDt: number }>> {
  const db = getOpenedDatabase();
  if (!db) return [];
  const sql = `
SELECT META().id AS id, audit.cr.dt AS auditCrDt
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND source.id = $sourceId
  AND role = 'primary'
`;
  try {
    const rows = await runQuery(db, sql, { employeeId, sourceId });
    return rows.map((r) => ({ id: String(r.id ?? ''), auditCrDt: Number(r.auditCrDt ?? 0) }));
  } catch {
    return [];
  }
}

import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedInboundJobs } from '../../src/db/seedData';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import { buildAmendment, createAmendment } from '../../src/ops/createAmendment';
import { OutError } from '../../src/ops/outError';
import { canTransition, completeBlockedReason, isFrozen } from '../../src/ops/outStatus';
import { applySyncState, shouldWriteSyncState } from '../../src/ops/setSyncState';
import { startWork } from '../../src/ops/startWork';
import { submitWork } from '../../src/ops/submitWork';
import { completeTask, listTasksForWork } from '../../src/ops/tasks';
import { cancelWork, completeWork, startOrResumeWork } from '../../src/ops/transitionStatus';
import { applyOutPatch } from '../../src/ops/updateWorkOrderOut';

const session = {
  employeeId: 'E-4412',
  email: 'jon.hale@example.com',
  username: 'tech.jon',
};

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
});

async function started() {
  const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
  const { wooutId } = await startWork(id, session);
  return wooutId;
}

function markRequiredDone(raw: Record<string, unknown>): Record<string, unknown> {
  const operations = (raw.operations as { required?: boolean; status?: string }[] | undefined)?.map((o) => ({
    ...o,
    status: o.required ? 'done' : o.status,
  }));
  const checklist = (raw.checklist as { required?: boolean; done?: boolean }[] | undefined)?.map((c) => ({
    ...c,
    done: c.required ? true : c.done,
  }));
  return applyOutPatch(raw, { operations, checklist }, session, 20, '1');
}

async function finishRequired(wooutId: string): Promise<void> {
  await startOrResumeWork(wooutId, session);
  memorySave('workordersout', wooutId, markRequiredDone(memoryGet('workordersout', wooutId)!));
  for (const t of await listTasksForWork(wooutId)) {
    if (t.required && t.status !== 'done') await completeTask(t.id, session);
  }
}

describe('status machine', () => {
  it('allows assigned → in_progress → complete, not assigned → complete', () => {
    expect(canTransition('assigned', 'StartOrResumeWork')).toBe(true);
    expect(canTransition('assigned', 'CompleteWork')).toBe(false);
    expect(canTransition('in_progress', 'CompleteWork')).toBe(true);
    expect(canTransition('complete', 'StartOrResumeWork')).toBe(false);
  });
});

describe('complete gates', () => {
  it('blocks when required op is skipped', () => {
    expect(
      completeBlockedReason({
        operations: [{ required: true, status: 'skipped', name: 'Site check' }],
        checklist: [],
      }),
    ).toMatch(/Site check/);
  });
});

describe('setSyncState', () => {
  it('does not append history', () => {
    const doc = {
      status: 'complete',
      owner: 'backend',
      syncState: 'local_draft',
      audit: { cr: { dt: 1, ver: '1', by: 'a' }, up: { dt: 1, ver: '1', by: 'a' } },
      history: [{ op: 'CompleteWork', dt: 1, by: 'a', ver: '1' }],
    };
    const next = applySyncState(doc, 'ready_to_push', session, undefined, 2, '1');
    expect(next.syncState).toBe('ready_to_push');
    expect((next.history as unknown[]).length).toBe(1);
    expect((next.history as { op: string }[])[0].op).toBe('CompleteWork');
  });

  it('skips a no-op SetSyncState write', () => {
    const doc = {
      syncState: 'pushed',
      audit: { cr: { dt: 1, ver: '1', by: 'a' }, up: { dt: 1, ver: '1', by: 'a' } },
    };
    expect(shouldWriteSyncState(doc, 'pushed')).toBe(false);
    expect(shouldWriteSyncState(doc, 'push_error', '500')).toBe(true);
  });
});

describe('freeze submit amend', () => {
  it('complete freezes, submit sets ready_to_push, amendment is a new id', async () => {
    const id = await started();
    await finishRequired(id);
    await completeWork(id, session);
    const frozen = memoryGet('workordersout', id)!;
    expect(isFrozen(frozen)).toBe(true);
    expect(frozen.owner).toBe('backend');
    expect(() => applyOutPatch(frozen, { summary: 'nope' }, session, 30, '1')).toThrow(OutError);
    await submitWork(id, session);
    expect(memoryGet('workordersout', id)?.syncState).toBe('ready_to_push');
    const { wooutId } = await createAmendment(id, session);
    expect(wooutId).not.toBe(id);
    expect(memoryGet('workordersout', wooutId)?.role).toBe('amendment');
    expect((memoryGet('workordersout', wooutId)?.amends as { id: string }).id).toBe(id);
  });

  it('cancel requires a reason', async () => {
    const id = await started();
    await expect(cancelWork(id, session, '  ')).rejects.toBeInstanceOf(OutError);
    await cancelWork(id, session, 'Cannot access site');
    expect(memoryGet('workordersout', id)?.status).toBe('cancelled');
    expect(isFrozen(memoryGet('workordersout', id)!)).toBe(true);
  });

  it('submit rejected while in_progress', async () => {
    const id = await started();
    await startOrResumeWork(id, session);
    await expect(submitWork(id, session)).rejects.toBeInstanceOf(OutError);
  });
});

describe('buildAmendment', () => {
  it('rejects unfrozen originals', () => {
    expect(() =>
      buildAmendment({ status: 'in_progress', owner: 'technician', number: 'WO-1' }, 'woout:a', 'woout:b', session),
    ).toThrow(OutError);
  });
});

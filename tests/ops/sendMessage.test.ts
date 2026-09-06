import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import {
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_DISPATCH_USER_ID,
  SEED_TASK_TEMPLATE_ID,
  SEED_USER_ID,
  seedDispatchUserDoc,
  seedInboundJobs,
  seedUserDoc,
} from '../../src/db/seedData';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import {
  ChatError,
  dmThreadId,
  otherDmEmployeeId,
  sendMessage,
  threadLabel,
  woinIdFromThread,
  woThreadId,
} from '../../src/ops/messages';
import { startWork } from '../../src/ops/startWork';
import { completeTask, listTasksForWork } from '../../src/ops/tasks';
import { completeWork, startOrResumeWork } from '../../src/ops/transitionStatus';
import { applyOutPatch } from '../../src/ops/updateWorkOrderOut';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  memorySave('tasks', SEED_TASK_TEMPLATE_ID, {
    type: 'task_template',
    title: 'Lockout / tagout',
    required: true,
  });
  memorySave('users', SEED_USER_ID, seedUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_DISPATCH_USER_ID, seedDispatchUserDoc('0.1.0+1', 1_700_000_000) as never);
});

describe('thread ids', () => {
  it('sorts DM employee ids', () => {
    expect(dmThreadId('E-9', 'E-1')).toBe('thr:dm:E-1:E-9');
    expect(dmThreadId('E-1', 'E-9')).toBe('thr:dm:E-1:E-9');
    expect(woThreadId('woin:abc')).toBe('thr:wo:woin:abc');
    expect(woinIdFromThread('thr:wo:woin:abc')).toBe('woin:abc');
    expect(otherDmEmployeeId('thr:dm:E-1:E-9', 'E-1')).toBe('E-9');
    expect(threadLabel('thr:dm:E-1:E-9')).toMatch(/^DM /);
  });
});

describe('sendMessage tags', () => {
  it('attaches WO- number and @employee on a DM', async () => {
    const job = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05').find(
      (j) => String((j.doc as { number?: string }).number) === 'WO-10482',
    )!;
    memorySave('workordersin', job.id, job.doc as never);
    const msgId = await sendMessage(session, {
      body: `Hey @${SEED_DISPATCH_EMPLOYEE_ID} WO-10482 needs more repair tomorrow`,
      kind: 'direct',
    });
    const saved = memoryGet('messages', msgId)!;
    expect(saved.workOrderInId).toBe(job.id);
    expect(saved.workOrderNumber).toBe('WO-10482');
    expect(saved.toEmployeeIds).toEqual([SEED_DISPATCH_EMPLOYEE_ID]);
    expect(saved.kind).toBe('direct');
  });
});

describe('sendMessage', () => {
  it('sets readyToPush immediately and stays writable after WO complete', async () => {
    const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    const { wooutId } = await startWork(id, session);
    const msgId = await sendMessage(session, {
      body: 'Need a lift',
      kind: 'job',
      workOrderInId: id,
      workOrderOutId: wooutId,
    });
    const saved = memoryGet('messages', msgId)!;
    expect(saved.readyToPush).toBe(true);
    expect((saved.from as { employeeId: string }).employeeId).toBe('E-4412');
    expect((saved.history as { op: string }[])[0].op).toBe('SendMessage');
    expect(saved.toEmployeeIds).toEqual([SEED_DISPATCH_EMPLOYEE_ID]);
    await startOrResumeWork(wooutId, session);
    const raw = memoryGet('workordersout', wooutId)!;
    memorySave(
      'workordersout',
      wooutId,
      applyOutPatch(
        raw,
        {
          operations: (raw.operations as { required?: boolean; status?: string }[]).map((o) => ({
            ...o,
            status: o.required ? 'done' : o.status,
          })),
          checklist: (raw.checklist as { required?: boolean; done?: boolean }[]).map((c) => ({
            ...c,
            done: c.required ? true : c.done,
          })),
        },
        session,
        20,
        '1',
      ),
    );
    for (const t of await listTasksForWork(wooutId)) {
      if (t.required) await completeTask(t.id, session);
    }
    await completeWork(wooutId, session);
    const again = await sendMessage(session, {
      body: 'Still here after complete',
      kind: 'job',
      workOrderInId: id,
      workOrderOutId: wooutId,
    });
    expect(memoryGet('messages', again)?.readyToPush).toBe(true);
  });

  it('rejects empty body and unknown employees', async () => {
    await expect(sendMessage(session, { body: '  ', kind: 'direct', toEmployeeId: SEED_DISPATCH_EMPLOYEE_ID })).rejects.toBeInstanceOf(
      ChatError,
    );
    await expect(sendMessage(session, { body: 'hi', kind: 'direct', toEmployeeId: 'E-NOPE' })).rejects.toMatchObject({
      code: 'unknown_employee',
    });
    const id = await sendMessage(session, {
      body: 'Need parts',
      kind: 'direct',
      toEmployeeId: SEED_DISPATCH_EMPLOYEE_ID,
    });
    expect(memoryGet('messages', id)?.threadId).toBe(dmThreadId(session.employeeId, SEED_DISPATCH_EMPLOYEE_ID));
  });
});

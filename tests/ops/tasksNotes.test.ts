import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedInboundJobs } from '../../src/db/seedData';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import { createNote, deleteNote, listNotes, updateNote } from '../../src/ops/notes';
import { OutError } from '../../src/ops/outError';
import { childReadyToPush, completeBlockedReason } from '../../src/ops/outStatus';
import { startWork } from '../../src/ops/startWork';
import { submitWork } from '../../src/ops/submitWork';
import {
  completeTask,
  cycleTaskStatus,
  listTasksForWork,
  upsertTask,
} from '../../src/ops/tasks';
import { completeWork, startOrResumeWork } from '../../src/ops/transitionStatus';
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

function markOpsChecklist(raw: Record<string, unknown>): Record<string, unknown> {
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

describe('completeBlockedReason tasks', () => {
  it('blocks required tasks that are not done, including skipped', () => {
    expect(
      completeBlockedReason({ operations: [], checklist: [] }, [
        { type: 'task', required: true, status: 'open', title: 'Lockout / tagout' },
      ]),
    ).toMatch(/Lockout/);
    expect(
      completeBlockedReason({ operations: [], checklist: [] }, [
        { type: 'task', required: true, status: 'skipped', title: 'Lockout / tagout' },
      ]),
    ).toMatch(/Lockout/);
    expect(
      completeBlockedReason({ operations: [], checklist: [] }, [
        { type: 'task_template', required: true, status: 'open', title: 'Template' },
        { type: 'task', required: true, status: 'done', title: 'Lockout / tagout' },
      ]),
    ).toBeNull();
  });
});

describe('childReadyToPush', () => {
  it('is true only when parent is editable and already submitted', () => {
    expect(
      childReadyToPush({ status: 'in_progress', owner: 'technician', syncState: 'ready_to_push' }),
    ).toBe(true);
    expect(
      childReadyToPush({ status: 'complete', owner: 'backend', syncState: 'ready_to_push' }),
    ).toBe(false);
    expect(
      childReadyToPush({ status: 'in_progress', owner: 'technician', syncState: 'local_draft' }),
    ).toBe(false);
  });
});

describe('tasks', () => {
  it('clones the seed required template on StartWork', async () => {
    const id = await started();
    const tasks = await listTasksForWork(id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toMatch(/Lockout/);
    expect(tasks[0].required).toBe(true);
    expect(tasks[0].status).toBe('open');
    expect(tasks[0].type).toBe('task');
  });

  it('blocks CompleteWork while a required task is open', async () => {
    const id = await started();
    await startOrResumeWork(id, session);
    memorySave('workordersout', id, markOpsChecklist(memoryGet('workordersout', id)!));
    await expect(completeWork(id, session)).rejects.toMatchObject({ code: 'incomplete' });
    const tasks = await listTasksForWork(id);
    await completeTask(tasks[0].id, session);
    await completeWork(id, session);
    expect(memoryGet('workordersout', id)?.status).toBe('complete');
  });

  it('cycles open → done → skipped', () => {
    expect(cycleTaskStatus('open')).toBe('done');
    expect(cycleTaskStatus('done')).toBe('skipped');
    expect(cycleTaskStatus('skipped')).toBe('open');
  });

  it('refuses to complete a template', async () => {
    memorySave('tasks', 'tsk:tmpl', { type: 'task_template', title: 'Lockout', required: true });
    await expect(completeTask('tsk:tmpl', session)).rejects.toMatchObject({ code: 'frozen' });
  });

  it('409s upsert on a frozen parent', async () => {
    const id = await started();
    await startOrResumeWork(id, session);
    memorySave('workordersout', id, markOpsChecklist(memoryGet('workordersout', id)!));
    for (const t of await listTasksForWork(id)) await completeTask(t.id, session);
    await completeWork(id, session);
    await expect(upsertTask(session, { wooutId: id, title: 'After freeze' })).rejects.toMatchObject({
      code: 'frozen',
    });
  });
});

describe('notes', () => {
  it('409s create/update/delete when the parent is frozen', async () => {
    const id = await started();
    await startOrResumeWork(id, session);
    memorySave('workordersout', id, markOpsChecklist(memoryGet('workordersout', id)!));
    for (const t of await listTasksForWork(id)) await completeTask(t.id, session);
    const noteId = await createNote(session, { body: 'Gate code 4412', workOrderOutId: id });
    expect(memoryGet('notes', noteId)?.readyToPush).toBe(false);
    expect((memoryGet('notes', noteId)?.history as { op: string }[])[0].op).toBe('CreateNote');
    await completeWork(id, session);
    await expect(createNote(session, { body: 'too late', workOrderOutId: id })).rejects.toMatchObject({
      code: 'frozen',
    });
    await expect(updateNote(noteId, session, 'nope')).rejects.toMatchObject({ code: 'frozen' });
    await expect(deleteNote(noteId, session)).rejects.toMatchObject({ code: 'frozen' });
  });

  it('copies readyToPush when the parent is editable and already submitted', async () => {
    memorySave('workordersout', 'woout:open', {
      status: 'in_progress',
      owner: 'technician',
      syncState: 'ready_to_push',
    });
    const noteId = await createNote(session, { body: 'post-submit child', workOrderOutId: 'woout:open' });
    expect(memoryGet('notes', noteId)?.readyToPush).toBe(true);
    const taskId = await upsertTask(session, { wooutId: 'woout:open', title: 'Follow-up check' });
    expect(memoryGet('tasks', taskId)?.readyToPush).toBe(true);
  });

  it('marks job children readyToPush on SubmitWork', async () => {
    const id = await started();
    await startOrResumeWork(id, session);
    memorySave('workordersout', id, markOpsChecklist(memoryGet('workordersout', id)!));
    for (const t of await listTasksForWork(id)) await completeTask(t.id, session);
    const noteId = await createNote(session, { body: 'Access', workOrderOutId: id });
    const taskId = (await listTasksForWork(id))[0].id;
    await completeWork(id, session);
    await submitWork(id, session);
    expect(memoryGet('notes', noteId)?.readyToPush).toBe(true);
    expect(memoryGet('tasks', taskId)?.readyToPush).toBe(true);
  });

  it('general notes are readyToPush and searchable', async () => {
    const id = await createNote(session, { body: 'Dog in yard after 16:00', kind: 'general', title: 'Access' });
    expect(memoryGet('notes', id)?.readyToPush).toBe(true);
    const hits = await listNotes({ q: 'dog' });
    expect(hits.map((n) => n.id)).toContain(id);
  });
});

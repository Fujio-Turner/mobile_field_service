import { nowSec, stampAuditCreate, stampAuditUpdate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import { deleteChild, listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import { assignedToFromSession, placeStamp, type StartSession } from './copyInbound';
import { OutError } from './outError';
import { childReadyToPush, isFrozen, type TaskLike } from './outStatus';
import { loadOutboundRaw } from './outboundStore';

const TASKS_FOR_WORK_SQL = `
SELECT META().id AS id, title, status, required, type, workOrderOutId, sort
FROM field.tasks
WHERE type = 'task' AND workOrderOutId = $wooutId
`;

export const TASK_STATUSES = ['open', 'done', 'skipped'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskItem = TaskLike & {
  id: string;
  title: string;
  status: TaskStatus;
  required: boolean;
  workOrderOutId: string;
  type: string;
};

export function cycleTaskStatus(current: string): TaskStatus {
  const i = TASK_STATUSES.indexOf(current as TaskStatus);
  return TASK_STATUSES[(i + 1) % TASK_STATUSES.length];
}

export function parseTask(id: string, raw: Record<string, unknown>): TaskItem | null {
  const type = String(raw.type ?? 'task');
  if (type === 'task_template') return null;
  return {
    id,
    type,
    title: String(raw.title ?? 'Task'),
    status: (TASK_STATUSES as readonly string[]).includes(String(raw.status))
      ? (raw.status as TaskStatus)
      : 'open',
    required: Boolean(raw.required),
    workOrderOutId: String(raw.workOrderOutId ?? ''),
  };
}

function sortTasks(items: TaskItem[]): TaskItem[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
}

export async function listTasksForWork(wooutId: string): Promise<TaskItem[]> {
  const nativeRows = await queryChildRowsIfNative(TASKS_FOR_WORK_SQL, { wooutId });
  if (nativeRows) {
    return sortTasks(
      nativeRows.map((row) => parseTask(String(row.id ?? ''), row)).filter((t): t is TaskItem => t != null),
    );
  }
  return sortTasks(
    listChildrenMemory('tasks', (_id, doc) => {
      return String(doc.type ?? 'task') === 'task' && String(doc.workOrderOutId ?? '') === wooutId;
    })
      .map((row) => parseTask(row.id, row.doc))
      .filter((t): t is TaskItem => t != null),
  );
}

async function assertParentWritable(wooutId: string): Promise<Record<string, unknown>> {
  const parent = await loadOutboundRaw(wooutId);
  if (!parent) throw new OutError('missing');
  if (isFrozen(parent)) throw new OutError('frozen');
  return parent;
}

export async function upsertTask(
  session: StartSession,
  input: { id?: string; wooutId: string; title: string; required?: boolean; status?: TaskStatus },
): Promise<string> {
  const parent = await assertParentWritable(input.wooutId);
  const title = input.title.trim();
  if (!title) throw new OutError('reason_required', 'Task title required');
  const ver = appVersion();
  const dt = nowSec();
  const existingId = input.id;
  if (existingId) {
    const raw = await loadChild('tasks', existingId);
    if (!raw) throw new OutError('missing');
    if (String(raw.type) === 'task_template') throw new OutError('frozen', 'Cannot complete a template');
    let next: Record<string, unknown> = {
      ...raw,
      title,
      required: input.required ?? raw.required,
      status: input.status ?? raw.status,
      readyToPush: childReadyToPush(parent) || raw.readyToPush === true,
    };
    next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
    next = stampHistory(next as never, {
      op: 'UpsertTask',
      by: session.username,
      ver,
      dt,
      changes: [{ path: 'status', from: raw.status, to: next.status }],
    });
    await saveChild('tasks', existingId, next);
    return existingId;
  }
  const id = newDocId('tsk');
  let body: Record<string, unknown> = {
    type: 'task',
    title,
    status: input.status ?? 'open',
    required: Boolean(input.required),
    workOrderOutId: input.wooutId,
    assignedTo: assignedToFromSession(session),
    employeeId: session.employeeId,
    email: session.email,
    customerId: parent.customerId != null ? String(parent.customerId) : undefined,
    ...placeStamp(session),
    readyToPush: childReadyToPush(parent),
  };
  body = stampAuditCreate(body, { by: session.username, ver, dt });
  body = stampHistory(body as never, {
    op: 'UpsertTask',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'title', to: title }],
  });
  await saveChild('tasks', id, body);
  return id;
}

export async function completeTask(id: string, session: StartSession): Promise<void> {
  const raw = await loadChild('tasks', id);
  if (!raw) throw new OutError('missing');
  if (String(raw.type) === 'task_template') throw new OutError('frozen', 'Cannot complete a template');
  await upsertTask(session, {
    id,
    wooutId: String(raw.workOrderOutId ?? ''),
    title: String(raw.title ?? 'Task'),
    required: Boolean(raw.required),
    status: 'done',
  });
}

export async function deleteTask(id: string, session: StartSession): Promise<void> {
  const raw = await loadChild('tasks', id);
  if (!raw) return;
  if (String(raw.type) === 'task_template') throw new OutError('frozen', 'Cannot complete a template');
  await assertParentWritable(String(raw.workOrderOutId ?? ''));
  void session;
  await deleteChild('tasks', id);
}

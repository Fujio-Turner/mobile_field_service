import { stampAuditCreate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import type { StartSession } from './copyInbound';

export function buildTaskInstance(input: {
  template: Record<string, unknown>;
  templateId: string;
  outId: string;
  instanceId: string;
  session: StartSession;
  ver: string;
  dt: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: 'task',
    title: String(input.template.title ?? 'Task'),
    status: 'open',
    required: Boolean(input.template.required),
    sort: input.template.sort,
    templateId: input.templateId,
    workOrderOutId: input.outId,
    readyToPush: false,
  };
  const created = stampAuditCreate(body, {
    by: input.session.username,
    ver: input.ver,
    dt: input.dt,
  });
  return stampHistory(created, {
    op: 'StartWork',
    by: input.session.username,
    ver: input.ver,
    dt: input.dt,
    changes: [{ path: 'workOrderOutId', to: input.outId }],
  });
}

export function shouldCloneTask(template: Record<string, unknown> | null): boolean {
  if (!template) return false;
  const type = String(template.type ?? '');
  if (type === 'task_template') return true;
  if (template.workOrderOutId == null || template.workOrderOutId === '') return true;
  return false;
}

export function cloneTaskIds(
  taskIds: unknown,
  load: (id: string) => Record<string, unknown> | null,
  input: { outId: string; session: StartSession; ver: string; dt: number; newId?: () => string },
): { instanceIds: string[]; instances: Array<{ id: string; doc: Record<string, unknown> }> } {
  const ids = Array.isArray(taskIds) ? taskIds.map(String) : [];
  const instances: Array<{ id: string; doc: Record<string, unknown> }> = [];
  const instanceIds: string[] = [];
  for (const templateId of ids) {
    const template = load(templateId);
    if (!shouldCloneTask(template)) continue;
    const instanceId = input.newId ? input.newId() : newDocId('tsk');
    instances.push({
      id: instanceId,
      doc: buildTaskInstance({
        template: template as Record<string, unknown>,
        templateId,
        outId: input.outId,
        instanceId,
        session: input.session,
        ver: input.ver,
        dt: input.dt,
      }),
    });
    instanceIds.push(instanceId);
  }
  return { instanceIds, instances };
}

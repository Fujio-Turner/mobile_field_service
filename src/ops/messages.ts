import { nowSec, stampAuditCreate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import { listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import type { StartSession } from './copyInbound';

export class ChatError extends Error {
  constructor(public code: 'empty' | 'unknown_employee') {
    super(code);
    this.name = 'ChatError';
  }
}

export type MessageItem = {
  id: string;
  threadId: string;
  kind: 'job' | 'direct';
  body: string;
  fromEmployeeId: string;
  workOrderInId?: string;
  workOrderOutId?: string;
  readyToPush: boolean;
  createdAt: number;
};

/** thr:dm:{empA}:{empB} with sorted employee ids. */
export function dmThreadId(empA: string, empB: string): string {
  const [a, b] = [empA, empB].sort();
  return `thr:dm:${a}:${b}`;
}

export function woThreadId(woinId: string): string {
  return `thr:wo:${woinId}`;
}

export function woinIdFromThread(threadId: string): string | undefined {
  if (!threadId.startsWith('thr:wo:')) return undefined;
  const id = threadId.slice('thr:wo:'.length);
  return id || undefined;
}

export function otherDmEmployeeId(threadId: string, me: string): string | undefined {
  if (!threadId.startsWith('thr:dm:')) return undefined;
  const rest = threadId.slice('thr:dm:'.length);
  const parts = rest.split(':').filter(Boolean);
  return parts.find((p) => p !== me);
}

const MSGS_THREAD_SQL = `
SELECT META().id AS id, threadId, kind, body, workOrderInId, workOrderOutId, readyToPush, audit.cr.dt AS createdAt, \`from\`.employeeId AS fromEmployeeId
FROM field.messages
WHERE type = 'message' AND threadId = $threadId
ORDER BY audit.cr.dt ASC
`;

const MSGS_ALL_SQL = `
SELECT META().id AS id, threadId, kind, body, workOrderInId, workOrderOutId, readyToPush, audit.cr.dt AS createdAt, \`from\`.employeeId AS fromEmployeeId
FROM field.messages
WHERE type = 'message'
`;

const USER_BY_EMP_SQL = `
SELECT META().id AS id, employeeId, role
FROM field.users
WHERE employeeId = $employeeId
LIMIT 1
`;

const DISPATCH_USERS_SQL = `
SELECT META().id AS id, employeeId, role
FROM field.users
WHERE role = 'dispatch' OR role = 'dispatcher'
`;

export function threadLabel(threadId: string): string {
  if (threadId.startsWith('thr:wo:')) return `Job ${threadId.slice('thr:wo:'.length)}`;
  if (threadId.startsWith('thr:dm:')) return `DM ${threadId.slice('thr:dm:'.length)}`;
  return threadId;
}

export function parseMessage(id: string, raw: Record<string, unknown>): MessageItem {
  const from = (raw.from as { employeeId?: string } | undefined) ?? {};
  const audit = raw.audit as { cr?: { dt?: number } } | undefined;
  return {
    id,
    threadId: String(raw.threadId ?? ''),
    kind: raw.kind === 'direct' ? 'direct' : 'job',
    body: String(raw.body ?? ''),
    fromEmployeeId: String(from.employeeId ?? ''),
    workOrderInId: raw.workOrderInId != null ? String(raw.workOrderInId) : undefined,
    workOrderOutId: raw.workOrderOutId != null ? String(raw.workOrderOutId) : undefined,
    readyToPush: raw.readyToPush !== false,
    createdAt: Number(audit?.cr?.dt ?? 0),
  };
}

export async function listMessages(threadId: string): Promise<MessageItem[]> {
  const native = await queryChildRowsIfNative(MSGS_THREAD_SQL, { threadId });
  if (native) {
    return native.map((row) =>
      parseMessage(String(row.id ?? ''), {
        type: 'message',
        threadId: row.threadId,
        kind: row.kind,
        body: row.body,
        workOrderInId: row.workOrderInId,
        workOrderOutId: row.workOrderOutId,
        readyToPush: row.readyToPush,
        from: { employeeId: row.fromEmployeeId },
        audit: { cr: { dt: row.createdAt } },
      }),
    );
  }
  return listChildrenMemory('messages', (_id, doc) => String(doc.threadId ?? '') === threadId)
    .map((r) => parseMessage(r.id, r.doc))
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function loadAllMessages(): Promise<MessageItem[]> {
  const native = await queryChildRowsIfNative(MSGS_ALL_SQL);
  if (native) {
    return native.map((row) =>
      parseMessage(String(row.id ?? ''), {
        type: 'message',
        threadId: row.threadId,
        kind: row.kind,
        body: row.body,
        workOrderInId: row.workOrderInId,
        workOrderOutId: row.workOrderOutId,
        readyToPush: row.readyToPush,
        from: { employeeId: row.fromEmployeeId },
        audit: { cr: { dt: row.createdAt } },
      }),
    );
  }
  return listChildrenMemory('messages', (_id, doc) => String(doc.type ?? 'message') === 'message').map((r) =>
    parseMessage(r.id, r.doc),
  );
}

export async function listThreadSummaries(): Promise<Array<{ threadId: string; preview: string; lastAt: number; kind: string }>> {
  const all = await loadAllMessages();
  const map = new Map<string, { threadId: string; preview: string; lastAt: number; kind: string }>();
  for (const m of all) {
    const prev = map.get(m.threadId);
    if (!prev || m.createdAt >= prev.lastAt) {
      map.set(m.threadId, {
        threadId: m.threadId,
        preview: m.body.slice(0, 80),
        lastAt: m.createdAt,
        kind: m.kind,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.lastAt - a.lastAt);
}

export async function employeeExists(employeeId: string): Promise<boolean> {
  const id = employeeId.trim();
  if (!id) return false;
  const native = await queryChildRowsIfNative(USER_BY_EMP_SQL, { employeeId: id });
  if (native) return native.length > 0;
  return listChildrenMemory('users', (_id, doc) => String(doc.employeeId ?? '') === id).length > 0;
}

export async function dispatchEmployeeIds(): Promise<string[]> {
  const native = await queryChildRowsIfNative(DISPATCH_USERS_SQL);
  if (native) {
    return native.map((r) => String(r.employeeId ?? '')).filter(Boolean);
  }
  return listChildrenMemory('users', (_id, doc) => {
    const role = String(doc.role ?? '');
    return role === 'dispatch' || role === 'dispatcher';
  }).map((r) => String(r.doc.employeeId ?? '')).filter(Boolean);
}

/**
 * Employees only. readyToPush true immediately. Completing a WO does not freeze chat.
 */
export async function sendMessage(
  session: StartSession,
  input: {
    body: string;
    kind: 'job' | 'direct';
    threadId?: string;
    toEmployeeId?: string;
    workOrderInId?: string;
    workOrderOutId?: string;
  },
): Promise<string> {
  const body = input.body.trim();
  if (!body) throw new ChatError('empty');
  let threadId = input.threadId;
  let toEmployeeIds: string[] | undefined;
  let workOrderInId = input.workOrderInId;
  if (input.kind === 'direct') {
    const to = input.toEmployeeId?.trim() || (threadId ? otherDmEmployeeId(threadId, session.employeeId) : undefined);
    if (!to || to === session.employeeId) throw new ChatError('unknown_employee');
    if (!(await employeeExists(to))) throw new ChatError('unknown_employee');
    threadId = threadId ?? dmThreadId(session.employeeId, to);
    toEmployeeIds = [to];
  } else {
    workOrderInId = workOrderInId ?? (threadId ? woinIdFromThread(threadId) : undefined);
    if (!threadId) {
      if (!workOrderInId) throw new ChatError('empty');
      threadId = woThreadId(workOrderInId);
    }
    const dispatch = await dispatchEmployeeIds();
    toEmployeeIds = dispatch.filter((emp) => emp !== session.employeeId);
  }
  const ver = appVersion();
  const dt = nowSec();
  const id = newDocId('msg');
  let doc: Record<string, unknown> = {
    type: 'message',
    threadId,
    kind: input.kind,
    from: {
      employeeId: session.employeeId,
      email: session.email,
      username: session.username,
      displayName: session.displayName ?? session.username,
    },
    body,
    workOrderInId,
    workOrderOutId: input.workOrderOutId,
    toEmployeeIds,
    readyToPush: true,
  };
  doc = stampAuditCreate(doc, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'SendMessage',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'body', to: body.slice(0, 80) }],
  });
  await saveChild('messages', id, doc);
  return id;
}

export async function getMessage(id: string): Promise<MessageItem | null> {
  const raw = await loadChild('messages', id);
  if (!raw) return null;
  return parseMessage(id, raw);
}

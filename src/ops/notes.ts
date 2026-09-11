import { nowSec, stampAuditCreate, stampAuditUpdate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import { deleteChild, listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import { assignedToFromSession, placeStamp, type StartSession } from './copyInbound';
import { OutError } from './outError';
import { childReadyToPush, isFrozen } from './outStatus';
import { loadOutboundRaw } from './outboundStore';

const NOTES_FOR_WO_SQL = `
SELECT META().id AS id, kind, title, body, workOrderOutId
FROM field.notes
WHERE type = 'note' AND workOrderOutId = $wooutId
ORDER BY audit.cr.dt DESC
`;

const NOTES_ALL_SQL = `
SELECT META().id AS id, kind, title, body, workOrderOutId
FROM field.notes
WHERE type = 'note'
ORDER BY audit.cr.dt DESC
`;

const NOTES_FTS_SQL = `
SELECT META().id AS id, kind, title, body, workOrderOutId
FROM field.notes
WHERE MATCH(idx_nte_fts, $q)
ORDER BY RANK(idx_nte_fts)
LIMIT 50
`;

export type NoteItem = {
  id: string;
  kind: 'job' | 'general';
  title?: string;
  body: string;
  workOrderOutId?: string;
};

export function parseNote(id: string, raw: Record<string, unknown>): NoteItem {
  return {
    id,
    kind: raw.kind === 'general' ? 'general' : 'job',
    title: raw.title != null ? String(raw.title) : undefined,
    body: String(raw.body ?? ''),
    workOrderOutId: raw.workOrderOutId != null ? String(raw.workOrderOutId) : undefined,
  };
}

function noteMatchesFilter(
  item: NoteItem,
  filter: { workOrderOutId?: string; kind?: 'job' | 'general'; q?: string },
): boolean {
  if (filter.workOrderOutId && item.workOrderOutId !== filter.workOrderOutId) return false;
  if (filter.kind && item.kind !== filter.kind) return false;
  const q = filter.q?.trim().toLowerCase();
  if (q) {
    const hay = `${item.title ?? ''} ${item.body}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export async function listNotes(filter: {
  workOrderOutId?: string;
  kind?: 'job' | 'general';
  q?: string;
} = {}): Promise<NoteItem[]> {
  const q = filter.q?.trim();
  let rows: Array<{ id: string; doc: Record<string, unknown> }>;
  if (q) {
    const nativeRows = await queryChildRowsIfNative(NOTES_FTS_SQL, { q });
    if (nativeRows) {
      rows = nativeRows.map((row) => ({ id: String(row.id ?? ''), doc: row }));
    } else {
      rows = listChildrenMemory('notes', (_id, doc) => String(doc.type ?? 'note') === 'note');
    }
  } else if (filter.workOrderOutId) {
    const nativeRows = await queryChildRowsIfNative(NOTES_FOR_WO_SQL, { wooutId: filter.workOrderOutId });
    if (nativeRows) {
      rows = nativeRows.map((row) => ({ id: String(row.id ?? ''), doc: row }));
    } else {
      rows = listChildrenMemory('notes', (_id, doc) => String(doc.type ?? 'note') === 'note');
    }
  } else {
    const nativeRows = await queryChildRowsIfNative(NOTES_ALL_SQL);
    if (nativeRows) {
      rows = nativeRows.map((row) => ({ id: String(row.id ?? ''), doc: row }));
    } else {
      rows = listChildrenMemory('notes', (_id, doc) => String(doc.type ?? 'note') === 'note');
    }
  }
  return rows
    .filter((row) => String(row.doc.type ?? 'note') === 'note')
    .map((row) => parseNote(row.id, row.doc))
    .filter((item) => noteMatchesFilter(item, filter));
}

async function assertNoteParent(workOrderOutId?: string): Promise<Record<string, unknown> | null> {
  if (!workOrderOutId) return null;
  const parent = await loadOutboundRaw(workOrderOutId);
  if (!parent) throw new OutError('missing');
  if (isFrozen(parent)) throw new OutError('frozen');
  return parent;
}

export async function createNote(
  session: StartSession,
  input: { body: string; kind?: 'job' | 'general'; workOrderOutId?: string; title?: string },
): Promise<string> {
  const body = input.body.trim();
  if (!body) throw new OutError('reason_required', 'Note body required');
  const parent = await assertNoteParent(input.workOrderOutId);
  const ver = appVersion();
  const dt = nowSec();
  const id = newDocId('nte');
  const parentCustomer = parent?.customerId != null ? String(parent.customerId) : undefined;
  let doc: Record<string, unknown> = {
    type: 'note',
    kind: input.kind ?? (input.workOrderOutId ? 'job' : 'general'),
    body,
    title: input.title,
    workOrderOutId: input.workOrderOutId,
    customerId: parentCustomer,
    assignedTo: assignedToFromSession(session),
    employeeId: session.employeeId,
    email: session.email,
    ...placeStamp(session),
    readyToPush: parent ? childReadyToPush(parent) : true,
  };
  doc = stampAuditCreate(doc, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'CreateNote',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'body', to: body.slice(0, 80) }],
  });
  await saveChild('notes', id, doc);
  return id;
}

export async function updateNote(id: string, session: StartSession, body: string): Promise<void> {
  const raw = await loadChild('notes', id);
  if (!raw) throw new OutError('missing');
  const parent = await assertNoteParent(raw.workOrderOutId != null ? String(raw.workOrderOutId) : undefined);
  const text = body.trim();
  if (!text) throw new OutError('reason_required', 'Note body required');
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...raw, body: text };
  if (parent) next.readyToPush = childReadyToPush(parent) || raw.readyToPush === true;
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'UpdateNote',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'body', to: text.slice(0, 80) }],
  });
  await saveChild('notes', id, next);
}

export async function deleteNote(id: string, session: StartSession): Promise<void> {
  const raw = await loadChild('notes', id);
  if (!raw) return;
  await assertNoteParent(raw.workOrderOutId != null ? String(raw.workOrderOutId) : undefined);
  void session;
  await deleteChild('notes', id);
}

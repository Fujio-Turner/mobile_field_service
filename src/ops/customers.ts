import { nowSec, stampAuditCreate, stampHistory } from '../audit';
import { newDocId } from '../ids';
import { appVersion } from '../version';
import { listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import { assignedToFromSession, type StartSession } from './copyInbound';
import { OutError } from './outError';

export type CustomerItem = {
  id: string;
  name: string;
  origin: 'dispatch' | 'field';
  accountNumber?: string;
  readyToPush?: boolean;
};

export function parseCustomer(id: string, raw: Record<string, unknown>): CustomerItem {
  return {
    id,
    name: String(raw.name ?? ''),
    origin: raw.origin === 'field' ? 'field' : 'dispatch',
    accountNumber: raw.accountNumber != null ? String(raw.accountNumber) : undefined,
    readyToPush: raw.readyToPush === true,
  };
}

export async function getCustomer(id: string): Promise<CustomerItem | null> {
  const raw = await loadChild('customers', id);
  if (!raw) return null;
  return parseCustomer(id, raw);
}

export async function listCustomers(): Promise<CustomerItem[]> {
  const native = await queryChildRowsIfNative(
    `SELECT META().id AS id, name, origin, accountNumber, readyToPush FROM field.customers WHERE type = 'customer'`,
  );
  const rows = native
    ? native.map((row) => ({ id: String(row.id ?? ''), doc: { type: 'customer', ...row } }))
    : listChildrenMemory('customers', (_id, doc) => String(doc.type ?? 'customer') === 'customer');
  return rows.map((r) => parseCustomer(r.id, r.doc)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Never patch origin:dispatch — always a new id for walk-ups. */
export async function createCustomer(
  session: StartSession,
  input: { name: string; accountNumber?: string },
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new OutError('reason_required', 'customer name required');
  const ver = appVersion();
  const dt = nowSec();
  const id = newDocId('cus');
  let doc: Record<string, unknown> = {
    type: 'customer',
    origin: 'field',
    name,
    accountNumber: input.accountNumber,
    readyToPush: true,
    assignedTo: assignedToFromSession(session),
    employeeId: session.employeeId,
    email: session.email,
  };
  doc = stampAuditCreate(doc, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'CreateCustomer',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'name', to: name }],
  });
  await saveChild('customers', id, doc);
  return id;
}

import { listChildrenMemory, queryChildRowsIfNative } from './childStore';

export type ChatEmployee = {
  employeeId: string;
  username: string;
  displayName: string;
};

export type ParsedChatRefs = {
  mentionTokens: string[];
  workNumbers: string[];
  orderNumbers: string[];
};

const WO_RE = /\bWO-\d+\b/gi;
const ORD_RE = /\bORD-[A-Z0-9-]+\b/gi;
const MENTION_RE = /@([A-Za-z0-9._-]+)/g;

export function parseChatRefs(body: string): ParsedChatRefs {
  const mentionTokens = [...body.matchAll(MENTION_RE)].map((m) => m[1]);
  const workNumbers = [...body.matchAll(WO_RE)].map((m) => m[0].toUpperCase());
  const orderNumbers = [...body.matchAll(ORD_RE)].map((m) => m[0].toUpperCase());
  return {
    mentionTokens: [...new Set(mentionTokens)],
    workNumbers: [...new Set(workNumbers)],
    orderNumbers: [...new Set(orderNumbers)],
  };
}

export function matchEmployee(token: string, people: ChatEmployee[]): ChatEmployee | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  const exactId = people.find((p) => p.employeeId.toLowerCase() === t);
  if (exactId) return exactId;
  const exactUser = people.find((p) => p.username.toLowerCase() === t);
  if (exactUser) return exactUser;
  const exactName = people.filter((p) => p.displayName.toLowerCase() === t);
  if (exactName.length === 1) return exactName[0];
  const first = people.filter((p) => p.displayName.toLowerCase().split(/\s+/)[0] === t);
  if (first.length === 1) return first[0];
  return null;
}

const USERS_SQL = `
SELECT META().id AS id, employeeId, username, displayName
FROM field.users
WHERE type = 'user'
LIMIT 50
`;

export async function listChatEmployees(): Promise<ChatEmployee[]> {
  const native = await queryChildRowsIfNative(USERS_SQL);
  const rows = native
    ? native.map((row) => ({
        employeeId: String(row.employeeId ?? ''),
        username: String(row.username ?? ''),
        displayName: String(row.displayName ?? row.username ?? ''),
      }))
    : listChildrenMemory('users', (_id, doc) => String(doc.type ?? 'user') === 'user').map((r) => ({
        employeeId: String(r.doc.employeeId ?? ''),
        username: String(r.doc.username ?? ''),
        displayName: String(r.doc.displayName ?? r.doc.username ?? ''),
      }));
  return rows.filter((p) => p.employeeId);
}

const WOIN_BY_NUMBER_SQL = `
SELECT META().id AS id, number
FROM field.workordersin
WHERE number = $number
LIMIT 1
`;

const WOOUT_BY_NUMBER_SQL = `
SELECT META().id AS id, number, source.id AS sourceId
FROM field.workordersout
WHERE number = $number
LIMIT 5
`;

const ORD_BY_NUMBER_SQL = `
SELECT META().id AS id, number, role
FROM field.orders
WHERE number = $number
LIMIT 5
`;

export async function findWorkByNumber(
  number: string,
  employeeId?: string,
): Promise<{ woinId?: string; wooutId?: string; number: string } | null> {
  const n = number.trim().toUpperCase();
  if (!n) return null;
  const inNative = await queryChildRowsIfNative(WOIN_BY_NUMBER_SQL, { number: n });
  let woinId = inNative?.[0] ? String(inNative[0].id ?? '') : undefined;
  if (!woinId) {
    const hit = listChildrenMemory('workordersin', (_id, doc) => String(doc.number ?? '').toUpperCase() === n)[0];
    woinId = hit?.id;
  }
  const outNative = await queryChildRowsIfNative(WOOUT_BY_NUMBER_SQL, { number: n });
  let wooutId: string | undefined;
  if (outNative && outNative.length) {
    const mine =
      (woinId ? outNative.find((row) => String(row.sourceId ?? '') === woinId) : undefined) ?? outNative[0];
    wooutId = String(mine.id ?? '') || undefined;
  } else {
    const outs = listChildrenMemory('workordersout', (_id, doc) => String(doc.number ?? '').toUpperCase() === n);
    const mine = employeeId
      ? outs.find((row) => (row.doc.assignedTo as { employeeId?: string })?.employeeId === employeeId)
      : outs[0];
    wooutId = (mine ?? outs[0])?.id;
    if (!woinId) {
      const src = (mine ?? outs[0])?.doc.source as { id?: string } | undefined;
      woinId = src?.id;
    }
  }
  if (!woinId && !wooutId) return null;
  return { woinId, wooutId, number: n };
}

export async function findOrderByNumber(number: string): Promise<{ orderId: string; number: string } | null> {
  const n = number.trim().toUpperCase();
  if (!n) return null;
  const native = await queryChildRowsIfNative(ORD_BY_NUMBER_SQL, { number: n });
  if (native && native[0]?.id) {
    const inbound = native.find((row) => String(row.role) === 'inbound') ?? native[0];
    return { orderId: String(inbound.id), number: n };
  }
  const rows = listChildrenMemory('orders', (_id, doc) => String(doc.number ?? '').toUpperCase() === n);
  const hit = rows.find((r) => String(r.doc.role) === 'inbound') ?? rows[0];
  return hit ? { orderId: hit.id, number: n } : null;
}

export type ResolvedChatRefs = {
  toEmployeeIds: string[];
  workOrderInId?: string;
  workOrderOutId?: string;
  workOrderNumber?: string;
  orderId?: string;
  orderNumber?: string;
};

export async function resolveChatRefs(body: string, employeeId?: string): Promise<ResolvedChatRefs> {
  const parsed = parseChatRefs(body);
  const toEmployeeIds: string[] = [];
  if (parsed.mentionTokens.length > 0) {
    const people = await listChatEmployees();
    for (const token of parsed.mentionTokens) {
      const hit = matchEmployee(token, people);
      if (hit && hit.employeeId !== employeeId) toEmployeeIds.push(hit.employeeId);
    }
  }
  const resolved: ResolvedChatRefs = { toEmployeeIds: [...new Set(toEmployeeIds)] };
  const wo = parsed.workNumbers[0];
  if (wo) {
    const found = await findWorkByNumber(wo, employeeId);
    if (found) {
      resolved.workOrderInId = found.woinId;
      resolved.workOrderOutId = found.wooutId;
      resolved.workOrderNumber = found.number;
    }
  }
  const ord = parsed.orderNumbers[0];
  if (ord) {
    const found = await findOrderByNumber(ord);
    if (found) {
      resolved.orderId = found.orderId;
      resolved.orderNumber = found.number;
    }
  }
  return resolved;
}

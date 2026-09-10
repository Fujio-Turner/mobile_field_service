/**
 * Channel names derived from document fields (never a hardcoded "public" / "!").
 * Keep in sync with mobile_field_service_deployment/schema/access_control/*.js
 *
 * Identity (users, workorders*, orders, notes — at least one required):
 *   emp:{employeeId}  email:{lowercase}  cus:{customerId}
 * Natural dividers on other collections come from schema fields (type, districtId, …).
 */

export const IDENTITY_COLLECTIONS = [
  'users',
  'workordersin',
  'workordersout',
  'orders',
  'notes',
] as const;

function push(out: string[], ch: string): void {
  if (!ch || out.includes(ch)) return;
  out.push(ch);
}

function add(out: string[], prefix: string, raw: unknown): void {
  if (raw == null) return;
  let s = String(raw).trim();
  if (!s) return;
  if (prefix === 'email:') s = s.toLowerCase();
  push(out, prefix + s);
}

function addCustomer(out: string[], raw: unknown): void {
  if (raw == null) return;
  const s = String(raw).trim();
  if (!s) return;
  push(out, s.startsWith('cus:') ? s : `cus:${s}`);
}

function assigned(doc: Record<string, unknown>): Record<string, unknown> {
  const v = doc.assignedTo;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function fromParty(doc: Record<string, unknown>): Record<string, unknown> {
  const v = doc.from;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function collectIdentityChannels(doc: Record<string, unknown>): string[] {
  const out: string[] = [];
  const asg = assigned(doc);
  const from = fromParty(doc);
  add(out, 'emp:', asg.employeeId ?? doc.employeeId ?? from.employeeId);
  add(out, 'email:', asg.email ?? doc.email ?? from.email);
  addCustomer(out, doc.customerId);
  if (Array.isArray(doc.toEmployeeIds)) {
    for (const id of doc.toEmployeeIds) add(out, 'emp:', id);
  }
  if (doc.workOrderInId) add(out, 'wo:', doc.workOrderInId);
  return out;
}

export function collectNaturalChannels(doc: Record<string, unknown>, collection: string): string[] {
  const out: string[] = [];
  switch (collection) {
    case 'assets':
      add(out, 'type:', doc.type);
      add(out, 'ownership:', doc.ownership);
      add(out, 'assetType:', doc.assetType);
      add(out, 'code:', doc.code);
      addCustomer(out, doc.customerId);
      break;
    case 'products':
      add(out, 'type:', doc.type);
      add(out, 'cat:', doc.category);
      add(out, 'sku:', doc.sku);
      break;
    case 'rates':
      add(out, 'type:', doc.type);
      add(out, 'district:', doc.districtId);
      add(out, 'crew:', doc.crewId);
      add(out, 'kind:', doc.kind);
      add(out, 'code:', doc.code);
      break;
    case 'taxes': {
      add(out, 'type:', doc.type);
      add(out, 'code:', doc.code);
      const jur = doc.jurisdiction;
      if (jur && typeof jur === 'object' && !Array.isArray(jur)) {
        add(out, 'geo:', (jur as Record<string, unknown>).country);
      }
      break;
    }
    case 'inventory':
      add(out, 'type:', doc.type);
      add(out, 'loc:', doc.locationId);
      if (doc.productId) {
        const pid = String(doc.productId).trim();
        if (pid) push(out, pid.startsWith('prd:') ? pid : `prd:${pid}`);
      }
      if (doc.workOrderOutId) add(out, 'woout:', doc.workOrderOutId);
      break;
    case 'customers':
      add(out, 'type:', doc.type);
      add(out, 'district:', doc.districtId);
      if (doc._id) addCustomer(out, doc._id);
      break;
    case 'tasks':
      add(out, 'type:', doc.type);
      if (doc.workOrderOutId) add(out, 'woout:', doc.workOrderOutId);
      add(out, 'district:', doc.districtId);
      break;
    case 'users':
      add(out, 'type:', doc.type);
      add(out, 'role:', doc.role);
      add(out, 'crew:', doc.crewId);
      add(out, 'district:', doc.districtId);
      break;
    case 'messages':
      if (doc.workOrderOutId) add(out, 'woout:', doc.workOrderOutId);
      if (doc.orderId) add(out, 'ord:', doc.orderId);
      break;
    case 'workordersin':
    case 'workordersout':
    case 'orders':
    case 'notes':
    case 'tracking':
      break;
    default:
      add(out, 'type:', doc.type);
      add(out, 'district:', doc.districtId);
      add(out, 'crew:', doc.crewId);
  }
  return out;
}

export function collectDocChannels(doc: Record<string, unknown>, collection: string): string[] {
  const out: string[] = [];
  for (const ch of collectIdentityChannels(doc)) push(out, ch);
  for (const ch of collectNaturalChannels(doc, collection)) push(out, ch);
  return out;
}

function hasIdentity(channels: readonly string[]): boolean {
  return channels.some((c) => c.startsWith('emp:') || c.startsWith('email:') || c.startsWith('cus:'));
}

export function assertDocChannels(doc: Record<string, unknown>, collection: string): string[] {
  const channels = collectDocChannels(doc, collection);
  const identity = (IDENTITY_COLLECTIONS as readonly string[]).includes(collection);
  if (identity && !hasIdentity(channels)) {
    throw new Error(`${collection}: need at least one of employeeId, email, customerId`);
  }
  if (channels.length === 0) {
    throw new Error(`${collection}: no channel fields on document`);
  }
  return channels;
}

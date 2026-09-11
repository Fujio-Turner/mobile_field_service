/**
 * Channel names from document fields — never `type:` (the collection already is that type)
 * and never a hardcoded `!` / `public`.
 *
 * Keep in sync with mobile_field_service_deployment/schema/access_control/*.js
 *
 * Identity (users, workorders*, orders, notes — at least one required):
 *   emp:{employeeId}  email:{lowercase}  cus:{customerId}  route:{routeId}
 *
 * Place: route / region / store. Taxes: state / county / city.
 * Users profile lists routeIds[], customerIds[], assetTypes[] for shared-device filters.
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
  if (prefix === 'route:' && s.startsWith('route:')) s = s.slice('route:'.length);
  if (prefix === 'store:' && s.startsWith('store:')) s = s.slice('store:'.length);
  push(out, prefix + s);
}

function addCustomer(out: string[], raw: unknown): void {
  if (raw == null) return;
  const s = String(raw).trim();
  if (!s) return;
  push(out, s.startsWith('cus:') ? s : `cus:${s}`);
}

function addRoutes(out: string[], doc: Record<string, unknown>): void {
  add(out, 'route:', doc.routeId);
  if (Array.isArray(doc.routeIds)) {
    for (const id of doc.routeIds) add(out, 'route:', id);
  }
}

function assigned(doc: Record<string, unknown>): Record<string, unknown> {
  const v = doc.assignedTo;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function fromParty(doc: Record<string, unknown>): Record<string, unknown> {
  const v = doc.from;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function collectIdentityChannels(doc: Record<string, unknown>): string[] {
  const out: string[] = [];
  const asg = assigned(doc);
  const from = fromParty(doc);
  add(out, 'emp:', asg.employeeId ?? doc.employeeId ?? from.employeeId);
  add(out, 'email:', asg.email ?? doc.email ?? from.email);
  addCustomer(out, doc.customerId);
  addRoutes(out, doc);
  if (Array.isArray(doc.toEmployeeIds)) {
    for (const id of doc.toEmployeeIds) add(out, 'emp:', id);
  }
  if (doc.workOrderInId) add(out, 'wo:', doc.workOrderInId);
  return out;
}

export function collectNaturalChannels(doc: Record<string, unknown>, collection: string): string[] {
  const out: string[] = [];
  const jur = obj(doc.jurisdiction);
  switch (collection) {
    case 'products':
      add(out, 'class:', doc.class ?? doc.salesClass);
      add(out, 'store:', doc.storeId);
      add(out, 'region:', doc.region);
      break;
    case 'rates':
      add(out, 'store:', doc.storeId);
      addCustomer(out, doc.customerId);
      add(out, 'region:', doc.region);
      add(out, 'district:', doc.districtId);
      break;
    case 'taxes':
      add(out, 'state:', jur.region ?? doc.state);
      add(out, 'county:', jur.county ?? doc.county);
      add(out, 'city:', jur.city ?? doc.city);
      break;
    case 'assets':
      add(out, 'region:', doc.region);
      add(out, 'store:', doc.storeId);
      add(out, 'loc:', doc.locationId);
      add(out, 'assetType:', doc.assetType);
      addCustomer(out, doc.customerId);
      addRoutes(out, doc);
      break;
    case 'customers':
      addRoutes(out, doc);
      add(out, 'region:', doc.region);
      add(out, 'emp:', assigned(doc).employeeId ?? doc.employeeId);
      if (doc._id) addCustomer(out, doc._id);
      break;
    case 'inventory':
      add(out, 'loc:', doc.locationId);
      add(out, 'store:', doc.storeId);
      add(out, 'region:', doc.region);
      add(out, 'emp:', assigned(doc).employeeId ?? doc.employeeId);
      add(out, 'email:', assigned(doc).email ?? doc.email);
      if (doc.workOrderOutId) add(out, 'woout:', doc.workOrderOutId);
      break;
    case 'tasks':
      addRoutes(out, doc);
      add(out, 'emp:', assigned(doc).employeeId ?? doc.employeeId);
      add(out, 'email:', assigned(doc).email ?? doc.email);
      if (doc.workOrderOutId) add(out, 'woout:', doc.workOrderOutId);
      break;
    case 'users':
      addRoutes(out, doc);
      add(out, 'region:', doc.region);
      add(out, 'store:', doc.storeId);
      if (Array.isArray(doc.customerIds)) {
        for (const id of doc.customerIds) addCustomer(out, id);
      }
      if (Array.isArray(doc.assetTypes)) {
        for (const t of doc.assetTypes) add(out, 'assetType:', t);
      }
      break;
    case 'messages':
      addRoutes(out, doc);
      if (doc.workOrderOutId) add(out, 'woout:', doc.workOrderOutId);
      if (doc.orderId) add(out, 'ord:', doc.orderId);
      break;
    case 'workordersin':
    case 'workordersout':
    case 'orders':
    case 'notes':
    case 'tracking':
      addRoutes(out, doc);
      add(out, 'region:', doc.region);
      add(out, 'store:', doc.storeId);
      break;
    default:
      addRoutes(out, doc);
      add(out, 'region:', doc.region);
      add(out, 'store:', doc.storeId);
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
  return channels.some(
    (c) =>
      c.startsWith('emp:') || c.startsWith('email:') || c.startsWith('cus:') || c.startsWith('route:'),
  );
}

export function assertDocChannels(doc: Record<string, unknown>, collection: string): string[] {
  const channels = collectDocChannels(doc, collection);
  const identity = (IDENTITY_COLLECTIONS as readonly string[]).includes(collection);
  if (identity && !hasIdentity(channels)) {
    throw new Error(`${collection}: need at least one of employeeId, email, customerId, routeId`);
  }
  if (channels.length === 0) {
    throw new Error(`${collection}: no channel fields on document`);
  }
  return channels;
}

/** Channels this person may pull — used later as query filters on a shared device. */
export function channelsFromUserProfile(user: Record<string, unknown>): string[] {
  return collectDocChannels(user, 'users');
}

import { nowSec, stampAuditCreate, stampHistory } from '../audit';
import { bboxAround, haversineM, inBBox, type BBox } from '../geo/haversine';
import { newDocId } from '../ids';
import { timeQuery } from '../metrics';
import { appVersion } from '../version';
import { listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';
import { assignedToFromSession, placeStamp, type StartSession } from './copyInbound';
import { OutError } from './outError';

export const CUSTOMERS_BBOX_LIMIT = 500;

export type CustomerAddress = {
  line1?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
};

export type CustomerSite = {
  name?: string;
  address?: CustomerAddress;
  geo?: { lat: number; lon: number };
};

export type CustomerItem = {
  id: string;
  name: string;
  origin: 'dispatch' | 'field';
  accountNumber?: string;
  readyToPush?: boolean;
  geo?: { lat: number; lon: number };
  sites: CustomerSite[];
};

export type CreateCustomerInput = {
  name: string;
  accountNumber?: string;
  siteName?: string;
  address?: CustomerAddress;
  geo?: { lat: number; lon: number };
};

const CUSTOMERS_FTS_SQL = `
SELECT META().id AS id, name, origin, accountNumber, readyToPush, geo.lat AS lat, geo.lon AS lon
FROM field.customers
WHERE MATCH(idx_cus_fts, $q)
ORDER BY RANK(idx_cus_fts)
LIMIT 50
`;

export const CUSTOMERS_BBOX_SQL = `
SELECT META().id AS id, name, origin, accountNumber, readyToPush, geo.lat AS lat, geo.lon AS lon
FROM field.customers
WHERE type = 'customer'
  AND geo.lat BETWEEN $minLat AND $maxLat
  AND geo.lon BETWEEN $minLon AND $maxLon
LIMIT ${CUSTOMERS_BBOX_LIMIT}
`;

export function parseGeo(raw: unknown): { lat: number; lon: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const geo = raw as { lat?: unknown; lon?: unknown };
  const lat = Number(geo.lat);
  const lon = Number(geo.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  return { lat, lon };
}

function parseAddress(raw: unknown): CustomerAddress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Record<string, unknown>;
  const next: CustomerAddress = {};
  if (a.line1 != null) next.line1 = String(a.line1);
  if (a.city != null) next.city = String(a.city);
  if (a.region != null) next.region = String(a.region);
  if (a.postal != null) next.postal = String(a.postal);
  if (a.country != null) next.country = String(a.country);
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseSites(raw: unknown): CustomerSite[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const s = (row ?? {}) as Record<string, unknown>;
    return {
      name: s.name != null ? String(s.name) : undefined,
      address: parseAddress(s.address),
      geo: parseGeo(s.geo),
    };
  });
}

export function primaryCustomerGeo(raw: Record<string, unknown>): { lat: number; lon: number } | undefined {
  return parseGeo(raw.geo) ?? parseSites(raw.sites).find((s) => s.geo)?.geo;
}

export function parseCustomer(id: string, raw: Record<string, unknown>): CustomerItem {
  const sites = parseSites(raw.sites);
  return {
    id,
    name: String(raw.name ?? ''),
    origin: raw.origin === 'field' ? 'field' : 'dispatch',
    accountNumber: raw.accountNumber != null ? String(raw.accountNumber) : undefined,
    readyToPush: raw.readyToPush === true,
    geo: primaryCustomerGeo(raw),
    sites,
  };
}

export async function getCustomer(id: string): Promise<CustomerItem | null> {
  const raw = await loadChild('customers', id);
  if (!raw) return null;
  return parseCustomer(id, raw);
}

function rowsFromNative(native: Array<Record<string, unknown>>): CustomerItem[] {
  return native
    .map((row) =>
      parseCustomer(String(row.id ?? ''), {
        type: 'customer',
        name: row.name,
        origin: row.origin,
        accountNumber: row.accountNumber,
        readyToPush: row.readyToPush,
        geo: row.lat != null && row.lon != null ? { lat: row.lat, lon: row.lon } : undefined,
      }),
    )
    .filter((c) => c.id);
}

export async function listCustomers(): Promise<CustomerItem[]> {
  const native = await queryChildRowsIfNative(
    `SELECT META().id AS id, name, origin, accountNumber, readyToPush, geo.lat AS lat, geo.lon AS lon FROM field.customers WHERE type = 'customer'`,
  );
  const rows = native
    ? native.map((row) => ({
        id: String(row.id ?? ''),
        doc: {
          type: 'customer',
          name: row.name,
          origin: row.origin,
          accountNumber: row.accountNumber,
          readyToPush: row.readyToPush,
          geo: row.lat != null && row.lon != null ? { lat: row.lat, lon: row.lon } : undefined,
        },
      }))
    : listChildrenMemory('customers', (_id, doc) => String(doc.type ?? 'customer') === 'customer');
  return rows.map((r) => parseCustomer(r.id, r.doc)).sort((a, b) => a.name.localeCompare(b.name));
}

function customerHay(c: CustomerItem): string {
  return `${c.name} ${c.accountNumber ?? ''}`.toLowerCase();
}

/** Typeahead over `idx_cus_fts` / name+account. Do not dump the full catalog as buttons. */
export async function searchCustomers(q: string): Promise<CustomerItem[]> {
  const query = q.trim();
  if (!query) return [];
  const native = await queryChildRowsIfNative(CUSTOMERS_FTS_SQL, { q: query });
  if (native) return rowsFromNative(native);
  const needle = query.toLowerCase();
  return (await listCustomers()).filter((c) => customerHay(c).includes(needle)).slice(0, 50);
}

export async function queryCustomersInBBox(
  box: BBox,
  center?: { lat: number; lon: number },
): Promise<CustomerItem[]> {
  return timeQuery('cus_bbox', async () => {
    const native = await queryChildRowsIfNative(CUSTOMERS_BBOX_SQL, {
      minLat: box.minLat,
      maxLat: box.maxLat,
      minLon: box.minLon,
      maxLon: box.maxLon,
    });
    let items = native
      ? rowsFromNative(native).filter((c) => c.geo)
      : (await listCustomers()).filter((c) => c.geo && inBBox(c.geo, box));
    if (center) {
      items = [...items].sort((a, b) => {
        const da = a.geo ? haversineM(center, a.geo) : Number.POSITIVE_INFINITY;
        const db = b.geo ? haversineM(center, b.geo) : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }
    return items.slice(0, CUSTOMERS_BBOX_LIMIT);
  });
}

export async function queryCustomersNear(
  center: { lat: number; lon: number },
  radiusM = 2000,
): Promise<CustomerItem[]> {
  return queryCustomersInBBox(bboxAround(center, radiusM), center);
}

function siteFromInput(input: CreateCustomerInput): CustomerSite | undefined {
  const geo = input.geo;
  const address = input.address;
  const name = input.siteName?.trim();
  if (!geo && !address && !name) return undefined;
  return { name: name || undefined, address, geo };
}

/** Never patch origin:dispatch — always a new id for walk-ups. */
export async function createCustomer(session: StartSession, input: CreateCustomerInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new OutError('reason_required', 'customer name required');
  const ver = appVersion();
  const dt = nowSec();
  const id = newDocId('cus');
  const site = siteFromInput(input);
  const geo = input.geo ?? site?.geo;
  const changes: Array<{ path: string; to: unknown }> = [{ path: 'name', to: name }];
  if (geo) changes.push({ path: 'geo', to: geo });
  let doc: Record<string, unknown> = {
    type: 'customer',
    origin: 'field',
    name,
    accountNumber: input.accountNumber,
    readyToPush: true,
    assignedTo: assignedToFromSession(session),
    employeeId: session.employeeId,
    email: session.email,
    ...placeStamp(session),
  };
  if (geo) doc.geo = geo;
  if (site) doc.sites = [site];
  doc = stampAuditCreate(doc, { by: session.username, ver, dt });
  doc = stampHistory(doc as never, {
    op: 'CreateCustomer',
    by: session.username,
    ver,
    dt,
    changes,
  });
  await saveChild('customers', id, doc);
  return id;
}

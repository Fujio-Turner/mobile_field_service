import { timeQuery } from '../metrics';
import { listChildrenMemory, loadChild, queryChildRowsIfNative } from './childStore';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { isFrozen } from './outStatus';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
import { nowSec, stampAuditUpdate, stampHistory } from '../audit';
import { appVersion } from '../version';
import { bboxAround, haversineM, inBBox, type BBox } from '../geo/haversine';

export const ASSETS_BBOX_LIMIT = 500;
export const NEAR_JOB_RADIUS_M = 250;

const ASSETS_BBOX_SQL = `
SELECT META().id AS id, name, code, assetType, status, ownership, geo.lat AS lat, geo.lon AS lon
FROM field.assets
WHERE type = 'asset'
  AND geo.lat BETWEEN $minLat AND $maxLat
  AND geo.lon BETWEEN $minLon AND $maxLon
LIMIT $limit
`;

const OPEN_JOBS_SQL = `
SELECT META().id AS id, number, status, site.name AS siteName, site.geo.lat AS lat, site.geo.lon AS lon
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND status IN ['assigned', 'in_progress', 'blocked']
`;

export type AssetItem = {
  id: string;
  name: string;
  code?: string;
  assetType: string;
  status?: string;
  ownership?: string;
  geo: { lat: number; lon: number };
  distanceM?: number;
};

export function parseAsset(id: string, raw: Record<string, unknown>): AssetItem | null {
  if (String(raw.type ?? 'asset') !== 'asset') return null;
  const geo = raw.geo as { lat?: number; lon?: number } | undefined;
  if (geo?.lat == null || geo?.lon == null) return null;
  return {
    id,
    name: String(raw.name ?? 'Asset'),
    code: raw.code != null ? String(raw.code) : undefined,
    assetType: String(raw.assetType ?? 'unknown'),
    status: raw.status != null ? String(raw.status) : undefined,
    ownership: raw.ownership != null ? String(raw.ownership) : undefined,
    geo: { lat: Number(geo.lat), lon: Number(geo.lon) },
  };
}

export function sortAssetsByDistance(items: AssetItem[], from?: { lat: number; lon: number }): AssetItem[] {
  if (!from) return [...items].sort((a, b) => a.name.localeCompare(b.name));
  return items
    .map((a) => ({ ...a, distanceM: haversineM(from, a.geo) }))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}

export async function queryAssetsInBBox(
  box: BBox,
  center?: { lat: number; lon: number },
  filter?: { assetType?: string },
): Promise<AssetItem[]> {
  return timeQuery('bbox', () => runAssetsBBox(box, center, filter));
}

async function runAssetsBBox(
  box: BBox,
  center?: { lat: number; lon: number },
  filter?: { assetType?: string },
): Promise<AssetItem[]> {
  const native = await queryChildRowsIfNative(ASSETS_BBOX_SQL, {
    minLat: box.minLat,
    maxLat: box.maxLat,
    minLon: box.minLon,
    maxLon: box.maxLon,
    limit: ASSETS_BBOX_LIMIT,
  });
  let items: AssetItem[];
  if (native) {
    items = native
      .map((row) =>
        parseAsset(String(row.id ?? ''), {
          type: 'asset',
          name: row.name,
          code: row.code,
          assetType: row.assetType,
          status: row.status,
          ownership: row.ownership,
          geo: { lat: row.lat, lon: row.lon },
        }),
      )
      .filter((a): a is AssetItem => a != null);
  } else {
    items = listChildrenMemory('assets', (_id, doc) => String(doc.type ?? 'asset') === 'asset')
      .map((row) => parseAsset(row.id, row.doc))
      .filter((a): a is AssetItem => a != null)
      .filter((a) => inBBox(a.geo, box));
  }
  if (filter?.assetType) {
    items = items.filter((a) => a.assetType === filter.assetType);
  }
  return sortAssetsByDistance(items, center).slice(0, ASSETS_BBOX_LIMIT);
}

export async function queryAssetsNear(
  center: { lat: number; lon: number },
  radiusM = 250,
): Promise<AssetItem[]> {
  return queryAssetsInBBox(bboxAround(center, radiusM), center);
}

export async function getAsset(id: string): Promise<AssetItem | null> {
  const raw = await loadChild('assets', id);
  if (!raw) return null;
  return parseAsset(id, raw);
}

export type OpenJobRef = {
  id: string;
  number: string;
  status: string;
  siteName: string;
  geo?: { lat: number; lon: number };
};

function parseOpenJob(id: string, raw: Record<string, unknown>): OpenJobRef | null {
  const status = String(raw.status ?? '');
  if (!['assigned', 'in_progress', 'blocked'].includes(status)) return null;
  const site = (raw.site ?? {}) as { name?: string; geo?: { lat?: number; lon?: number } };
  const geo =
    site.geo?.lat != null && site.geo?.lon != null
      ? { lat: Number(site.geo.lat), lon: Number(site.geo.lon) }
      : undefined;
  return {
    id,
    number: String(raw.number ?? ''),
    status,
    siteName: String(site.name ?? ''),
    geo,
  };
}

export async function listOpenJobs(employeeId: string): Promise<OpenJobRef[]> {
  const native = await queryChildRowsIfNative(OPEN_JOBS_SQL, { employeeId });
  if (native) {
    return native.map((row) => {
      const lat = row.lat != null ? Number(row.lat) : NaN;
      const lon = row.lon != null ? Number(row.lon) : NaN;
      return {
        id: String(row.id ?? ''),
        number: String(row.number ?? ''),
        status: String(row.status ?? ''),
        siteName: String(row.siteName ?? ''),
        geo: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined,
      };
    });
  }
  return listChildrenMemory('workordersout', (_id, doc) => {
    const assigned = doc.assignedTo as { employeeId?: string } | undefined;
    return assigned?.employeeId === employeeId;
  })
    .map((row) => parseOpenJob(row.id, row.doc))
    .filter((j): j is OpenJobRef => j != null);
}

export async function linkAssetToWork(
  wooutId: string,
  assetId: string,
  session: StartSession,
): Promise<void> {
  const parent = await loadOutboundRaw(wooutId);
  if (!parent) throw new OutError('missing');
  if (isFrozen(parent)) throw new OutError('frozen');
  const asset = await getAsset(assetId);
  if (!asset) throw new OutError('missing');
  const prev = Array.isArray(parent.assetIds) ? parent.assetIds.map(String) : [];
  if (prev.includes(assetId)) return;
  const assetIds = [...prev, assetId];
  const ver = appVersion();
  const dt = nowSec();
  let next: Record<string, unknown> = { ...parent, assetIds };
  next = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  next = stampHistory(next as never, {
    op: 'LinkAssetToWork',
    by: session.username,
    ver,
    dt,
    changes: [{ path: 'assetIds', from: prev, to: assetIds }],
  });
  await saveOutboundRaw(wooutId, next);
}

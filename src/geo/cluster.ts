import { haversineM, type BBox } from './haversine';

export type GeoPoint = { id: string; geo: { lat: number; lon: number } };

export type AssetCluster<T extends GeoPoint = GeoPoint> = {
  key: string;
  count: number;
  geo: { lat: number; lon: number };
  assets: T[];
};

/** Grid size in meters for a bbox: city zoom clusters, street zoom does not. */
export function clusterCellM(box: BBox): number {
  const d = haversineM(
    { lat: box.minLat, lon: box.minLon },
    { lat: box.maxLat, lon: box.maxLon },
  );
  if (d > 2500) return 400;
  if (d > 900) return 150;
  return 0;
}

export function clusterAssets<T extends GeoPoint>(items: T[], cellM: number): AssetCluster<T>[] {
  if (!(cellM > 0)) {
    return items.map((a) => ({ key: a.id, count: 1, geo: a.geo, assets: [a] }));
  }
  const groups = new Map<string, T[]>();
  const latCell = cellM / 111_320;
  for (const a of items) {
    const lonCell = cellM / (111_320 * Math.cos((a.geo.lat * Math.PI) / 180) || 1e-6);
    const key = `${Math.round(a.geo.lat / latCell)}:${Math.round(a.geo.lon / lonCell)}`;
    const g = groups.get(key) ?? [];
    g.push(a);
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, assets]) => ({
    key,
    count: assets.length,
    geo: {
      lat: assets.reduce((s, a) => s + a.geo.lat, 0) / assets.length,
      lon: assets.reduce((s, a) => s + a.geo.lon, 0) / assets.length,
    },
    assets,
  }));
}

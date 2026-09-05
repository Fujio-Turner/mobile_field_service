/** Earth-radius haversine distance in meters. */
export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

/** Approximate bounding box around a point (meters). */
export function bboxAround(center: { lat: number; lon: number }, radiusM: number): BBox {
  const latDelta = radiusM / 111_320;
  const lonDelta = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180) || 1e-6);
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  };
}

export function inBBox(geo: { lat: number; lon: number }, box: BBox): boolean {
  return geo.lat >= box.minLat && geo.lat <= box.maxLat && geo.lon >= box.minLon && geo.lon <= box.maxLon;
}

/** MapLibre visibleBounds: [northEast, southWest] as [lon, lat]. */
export function visibleBoundsToBBox(ne: number[], sw: number[]): BBox {
  const neLon = Number(ne[0]);
  const neLat = Number(ne[1]);
  const swLon = Number(sw[0]);
  const swLat = Number(sw[1]);
  return {
    minLat: Math.min(neLat, swLat),
    maxLat: Math.max(neLat, swLat),
    minLon: Math.min(neLon, swLon),
    maxLon: Math.max(neLon, swLon),
  };
}

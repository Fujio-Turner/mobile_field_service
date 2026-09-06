/** OpenFreeMap Liberty — needs network (or MapLibre’s last style cache). Pins still come from CBL. */
export const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';

export function mapStyleUrl(): string {
  const override = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim();
  return override || OPENFREEMAP_LIBERTY;
}

export async function styleReachable(url = mapStyleUrl(), timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

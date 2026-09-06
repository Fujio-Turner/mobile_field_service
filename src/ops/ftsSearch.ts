import { bboxAround } from '../geo/haversine';
import { timeQuery } from '../metrics';
import { parseAsset, queryAssetsInBBox, type AssetItem } from './assets';
import { queryChildRowsIfNative } from './childStore';
import { listNotes } from './notes';
import { searchProducts } from './products';

const ASSETS_FTS_SQL = `
SELECT META().id AS id, name, code, assetType, geo.lat AS lat, geo.lon AS lon
FROM field.assets
WHERE MATCH(idx_ast_fts, $q)
ORDER BY RANK(idx_ast_fts)
LIMIT 50
`;

export type FtsHit = {
  kind: 'note' | 'product' | 'asset';
  id: string;
  title: string;
  sub?: string;
};

export async function searchAssetsFts(q: string): Promise<AssetItem[]> {
  const query = q.trim();
  if (!query) return [];
  const native = await queryChildRowsIfNative(ASSETS_FTS_SQL, { q: query });
  if (native) {
    return native
      .map((row) =>
        parseAsset(String(row.id ?? ''), {
          type: 'asset',
          name: row.name,
          code: row.code,
          assetType: row.assetType,
          geo: { lat: row.lat, lon: row.lon },
        }),
      )
      .filter((a): a is AssetItem => a != null);
  }
  const needle = query.toLowerCase();
  const box = bboxAround({ lat: 41.7658, lon: -72.6734 }, 50_000);
  const near = await queryAssetsInBBox(box, { lat: 41.7658, lon: -72.6734 });
  return near.filter((a) => `${a.name} ${a.code ?? ''} ${a.assetType}`.toLowerCase().includes(needle));
}

export async function ftsSearch(q: string): Promise<FtsHit[]> {
  const needle = q.trim();
  if (!needle) return [];
  return timeQuery('fts', async () => {
    const [products, notes, assets] = await Promise.all([
      searchProducts(needle),
      listNotes({ q: needle }),
      searchAssetsFts(needle),
    ]);
    const out: FtsHit[] = [];
    for (const p of products) {
      out.push({ kind: 'product', id: p.id, title: p.name, sub: p.sku });
    }
    for (const n of notes) {
      out.push({ kind: 'note', id: n.id, title: n.title ?? n.body.slice(0, 40), sub: n.kind });
    }
    for (const a of assets) {
      out.push({ kind: 'asset', id: a.id, title: a.name, sub: a.code });
    }
    return out;
  });
}

/** Used only to prove memory search does not require native MATCH. */
export function memoryAssetNameHay(doc: Record<string, unknown>): string {
  return `${doc.name ?? ''} ${doc.code ?? ''} ${doc.assetType ?? ''}`;
}

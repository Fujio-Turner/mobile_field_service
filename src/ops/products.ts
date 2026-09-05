import { listChildrenMemory, queryChildRowsIfNative } from './childStore';

const PRODUCTS_FTS_SQL = `
SELECT META().id AS id, sku, name, uom, description, category, active, defaultRateId
FROM field.products
WHERE MATCH(idx_prd_fts, $q)
LIMIT 50
`;

const PRODUCTS_ALL_SQL = `
SELECT META().id AS id, sku, name, uom, description, category, active, defaultRateId
FROM field.products
WHERE type = 'product'
LIMIT 50
`;

export type ProductItem = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  description?: string;
  category?: string;
  active: boolean;
  defaultRateId?: string;
};

export function parseProduct(id: string, raw: Record<string, unknown>): ProductItem | null {
  if (String(raw.type ?? 'product') !== 'product') return null;
  return {
    id,
    sku: String(raw.sku ?? ''),
    name: String(raw.name ?? ''),
    uom: String(raw.uom ?? 'ea'),
    description: raw.description != null ? String(raw.description) : undefined,
    category: raw.category != null ? String(raw.category) : undefined,
    active: raw.active !== false,
    defaultRateId: raw.defaultRateId != null ? String(raw.defaultRateId) : undefined,
  };
}

export async function searchProducts(q?: string): Promise<ProductItem[]> {
  const query = q?.trim();
  let rows: Array<{ id: string; doc: Record<string, unknown> }>;
  if (query) {
    const native = await queryChildRowsIfNative(PRODUCTS_FTS_SQL, { q: query });
    if (native) {
      rows = native.map((row) => ({ id: String(row.id ?? ''), doc: { type: 'product', ...row } }));
    } else {
      const needle = query.toLowerCase();
      rows = listChildrenMemory('products', (_id, doc) => {
        if (String(doc.type ?? 'product') !== 'product') return false;
        const hay = `${doc.name ?? ''} ${doc.sku ?? ''} ${doc.description ?? ''}`.toLowerCase();
        return hay.includes(needle);
      });
    }
  } else {
    const native = await queryChildRowsIfNative(PRODUCTS_ALL_SQL);
    if (native) {
      rows = native.map((row) => ({ id: String(row.id ?? ''), doc: { type: 'product', ...row } }));
    } else {
      rows = listChildrenMemory('products', (_id, doc) => String(doc.type ?? 'product') === 'product');
    }
  }
  return rows
    .map((r) => parseProduct(r.id, r.doc))
    .filter((p): p is ProductItem => p != null && p.active)
    .slice(0, 50);
}

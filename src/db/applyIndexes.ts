import { FTS_INDEXES, VALUE_INDEXES, type FtsIndexSpec, type ValueIndexSpec } from './indexes';
import { FIELD_SCOPE } from './collections';

type CblDb = {
  collection: (name: string, scope: string) => Promise<unknown>;
};

type IndexCol = {
  createIndex: (name: string, index: unknown) => Promise<void>;
  indexes?: () => Promise<unknown>;
};

function groupByCollection(): Map<string, { values: ValueIndexSpec[]; fts: FtsIndexSpec[] }> {
  const byCol = new Map<string, { values: ValueIndexSpec[]; fts: FtsIndexSpec[] }>();
  for (const spec of VALUE_INDEXES) {
    const rec = byCol.get(spec.collection) ?? { values: [], fts: [] };
    rec.values.push(spec);
    byCol.set(spec.collection, rec);
  }
  for (const spec of FTS_INDEXES) {
    const rec = byCol.get(spec.collection) ?? { values: [], fts: [] };
    rec.fts.push(spec);
    byCol.set(spec.collection, rec);
  }
  return byCol;
}

async function existingIndexNames(col: IndexCol): Promise<Set<string>> {
  if (typeof col.indexes !== 'function') return new Set();
  try {
    const raw = await col.indexes();
    const list = Array.isArray(raw) ? raw : [];
    return new Set(list.map((n) => String(n)));
  } catch {
    return new Set();
  }
}

export async function applyIndexes(database: CblDb): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { IndexBuilder, ValueIndexItem, FullTextIndexItem } = require('cbl-reactnative') as {
    IndexBuilder: {
      valueIndex: (...items: unknown[]) => unknown;
      fullTextIndex: (...items: unknown[]) => { setIgnoreAccents: (v: boolean) => unknown };
    };
    ValueIndexItem: { property: (p: string) => unknown };
    FullTextIndexItem: { property: (p: string) => unknown };
  };

  await Promise.all(
    [...groupByCollection().entries()].map(async ([name, rec]) => {
      const col = (await database.collection(name, FIELD_SCOPE)) as IndexCol | null;
      if (!col) return;
      const has = await existingIndexNames(col);
      for (const spec of rec.values) {
        if (has.has(spec.name)) continue;
        const idx = IndexBuilder.valueIndex(...spec.properties.map((p) => ValueIndexItem.property(p)));
        try {
          await col.createIndex(spec.name, idx);
        } catch {
          // idempotent by name
        }
      }
      for (const spec of rec.fts) {
        if (has.has(spec.name)) continue;
        const idx = IndexBuilder.fullTextIndex(
          ...spec.properties.map((p) => FullTextIndexItem.property(p)),
        ).setIgnoreAccents(true);
        try {
          await col.createIndex(spec.name, idx);
        } catch {
          // idempotent by name
        }
      }
    }),
  );
}

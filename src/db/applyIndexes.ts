import { FTS_INDEXES, VALUE_INDEXES } from './indexes';
import { FIELD_SCOPE } from './collections';

type CblDb = {
  collection: (name: string, scope: string) => Promise<unknown>;
};

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

  for (const spec of VALUE_INDEXES) {
    const col = (await database.collection(spec.collection, FIELD_SCOPE)) as {
      createIndex: (name: string, index: unknown) => Promise<void>;
    } | null;
    if (!col) continue;
    const idx = IndexBuilder.valueIndex(...spec.properties.map((p) => ValueIndexItem.property(p)));
    try {
      await col.createIndex(spec.name, idx);
    } catch {
      // idempotent by name
    }
  }
  for (const spec of FTS_INDEXES) {
    const col = (await database.collection(spec.collection, FIELD_SCOPE)) as {
      createIndex: (name: string, index: unknown) => Promise<void>;
    } | null;
    if (!col) continue;
    const idx = IndexBuilder.fullTextIndex(
      ...spec.properties.map((p) => FullTextIndexItem.property(p)),
    ).setIgnoreAccents(true);
    try {
      await col.createIndex(spec.name, idx);
    } catch {
      // idempotent by name
    }
  }
}

import type { CblDatabase, QueryLike } from './database';

export async function runQuery(
  db: CblDatabase,
  sql: string,
  params: Record<string, string | number> = {},
): Promise<Record<string, unknown>[]> {
  const query = db.createQuery(sql);
  await applyParams(query, params);
  if (process.env.EXPO_PUBLIC_QUERY_EXPLAIN === '1' && typeof query.explain === 'function') {
    try {
      await query.explain();
    } catch {
      // explain is opt-in; never required
    }
  }
  const raw = await query.execute();
  return normalizeResults(raw);
}

export async function applyParams(query: QueryLike, params: Record<string, string | number>): Promise<void> {
  if (Object.keys(params).length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Parameters } = require('cbl-reactnative') as {
      Parameters: new () => {
        setValue: (k: string, v: unknown) => void;
        setString?: (k: string, v: string) => void;
      };
    };
    const p = new Parameters();
    for (const [k, v] of Object.entries(params)) {
      p.setValue(k, v);
    }
    if (typeof query.setParameters === 'function') query.setParameters(p);
    else if (typeof query.addParameter === 'function') query.addParameter(p);
    else (query as { parameters?: unknown }).parameters = p;
  } catch {
    // native Parameters missing — queries that need params will fail execute
  }
}

export function normalizeResults(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((item) => {
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      if (typeof rec.getValue === 'function') {
        // CBL Result
        const out: Record<string, unknown> = {};
        const keys = (rec as { keys?: string[] }).keys ?? Object.keys(rec);
        for (const k of keys) {
          if (k === 'getValue' || k === 'keys') continue;
          try {
            out[k] = (rec.getValue as (key: string) => unknown)(k);
          } catch {
            out[k] = rec[k];
          }
        }
        return out;
      }
      return rec;
    }
    return { value: item };
  });
}

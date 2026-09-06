import { normalizeResults } from './query';
import type { QueryLike } from './database';

export type LiveQueryHandle = {
  stop: () => Promise<void>;
};

/**
 * Parse a CBL QueryChange (or a raw engine event) into rows.
 * Native may send `results` as an array, a JSON string, or `{ data: string }`.
 */
export function liveChangeResults(change: unknown): { error?: string; rows: Record<string, unknown>[] } {
  if (change == null) return { rows: [] };
  const c = change as {
    error?: unknown;
    results?: unknown;
    data?: unknown;
  };
  if (c.error) {
    const err = c.error;
    const message =
      typeof err === 'string'
        ? err
        : String((err as { message?: string }).message ?? 'Live query failed');
    return { error: message, rows: [] };
  }
  let raw: unknown = c.results ?? c.data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'data' in (raw as object)) {
    raw = (raw as { data: unknown }).data;
  }
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { error: 'Live query payload was not JSON', rows: [] };
    }
  }
  return { rows: normalizeResults(raw) };
}

async function detachListener(query: QueryLike, token: unknown): Promise<void> {
  if (token && typeof (token as { remove?: () => Promise<void> }).remove === 'function') {
    await (token as { remove: () => Promise<void> }).remove();
    return;
  }
  if (typeof query.removeChangeListener === 'function') {
    await query.removeChangeListener(token);
  }
}

/** CBL live query: addChangeListener re-runs the SQL++ when matching docs change. */
export async function attachLiveQuery(
  query: QueryLike,
  onChange: (rows: Record<string, unknown>[], error?: string) => void,
): Promise<LiveQueryHandle | null> {
  if (typeof query.addChangeListener !== 'function') return null;
  const token = await query.addChangeListener((change) => {
    const parsed = liveChangeResults(change);
    onChange(parsed.rows, parsed.error);
  });
  return {
    stop: async () => {
      await detachListener(query, token);
    },
  };
}

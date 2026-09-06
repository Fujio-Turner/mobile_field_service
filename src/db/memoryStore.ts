/** Device-local stand-in when CBL native is missing (Expo Go / tests). */
const store = new Map<string, Map<string, Record<string, unknown>>>();

function bucket(collection: string): Map<string, Record<string, unknown>> {
  let b = store.get(collection);
  if (!b) {
    b = new Map();
    store.set(collection, b);
  }
  return b;
}

export function memoryGet(collection: string, id: string): Record<string, unknown> | null {
  const doc = bucket(collection).get(id);
  return doc ? structuredClone(doc) : null;
}

export function memorySave(collection: string, id: string, body: Record<string, unknown>): void {
  bucket(collection).set(id, structuredClone(body));
}

export function memoryDelete(collection: string, id: string): void {
  bucket(collection).delete(id);
}

export function memoryAll(collection: string): Array<{ id: string; doc: Record<string, unknown> }> {
  return [...bucket(collection).entries()].map(([id, doc]) => ({ id, doc: structuredClone(doc) }));
}

export function memoryReset(): void {
  store.clear();
  // Lazy require so screens can seed without a cycle at module load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const demo = require('./ensureMemoryDemo') as { resetMemoryDemoFlags?: () => void };
  demo.resetMemoryDemoFlags?.();
}

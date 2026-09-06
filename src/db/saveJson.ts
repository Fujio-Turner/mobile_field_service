export async function saveJsonDoc(
  collection: { save: (doc: unknown) => Promise<void> },
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MutableDocument } = require('cbl-reactnative') as {
    MutableDocument: new (id: string, data?: Record<string, unknown>) => {
      setData?: (data: Record<string, unknown>) => void;
      setJSON?: (json: string) => void;
    };
  };
  const doc = typeof MutableDocument === 'function' ? new MutableDocument(id, body) : null;
  if (!doc) throw new Error('MutableDocument missing');
  if (typeof doc.setData === 'function') doc.setData(body);
  else if (typeof doc.setJSON === 'function') doc.setJSON(JSON.stringify(body));
  await collection.save(doc);
}

export async function purgeJsonDoc(
  collection: { purge?: (id: string) => Promise<void>; delete?: (id: string) => Promise<void> },
  id: string,
): Promise<void> {
  if (typeof collection.purge === 'function') await collection.purge(id);
  else if (typeof collection.delete === 'function') await collection.delete(id);
}

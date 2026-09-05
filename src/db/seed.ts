import { appVersion } from '../version';
import { nowSec } from '../audit';
import { FIELD_SCOPE } from './collections';
import {
  SEED_CUSTOMER_ID,
  SEED_USER_ID,
  seedCustomerDoc,
  seedInboundJobs,
  seedTaskTemplates,
  seedUserDoc,
} from './seedData';

type CollectionLike = {
  document: (id: string) => Promise<unknown>;
  save: (doc: unknown) => Promise<void>;
};

type DbLike = {
  collection: (name: string, scope: string) => Promise<unknown>;
};

async function saveIfMissing(
  col: CollectionLike,
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const existing = await col.document(id);
  if (existing) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MutableDocument } = require('cbl-reactnative') as {
    MutableDocument: new (id: string) => {
      setData?: (data: Record<string, unknown>) => void;
      setJSON?: (json: string) => void;
    };
  };
  const doc = new MutableDocument(id);
  if (typeof doc.setData === 'function') doc.setData(body);
  else if (typeof doc.setJSON === 'function') doc.setJSON(JSON.stringify(body));
  await col.save(doc);
}

export async function seedIfNeeded(database: DbLike): Promise<void> {
  const ver = appVersion();
  const dt = nowSec();
  const users = (await database.collection('users', FIELD_SCOPE)) as CollectionLike | null;
  const customers = (await database.collection('customers', FIELD_SCOPE)) as CollectionLike | null;
  const woin = (await database.collection('workordersin', FIELD_SCOPE)) as CollectionLike | null;
  const tasks = (await database.collection('tasks', FIELD_SCOPE)) as CollectionLike | null;
  if (!users || !customers || !woin) return;

  await saveIfMissing(users, SEED_USER_ID, seedUserDoc(ver, dt) as unknown as Record<string, unknown>);
  await saveIfMissing(
    customers,
    SEED_CUSTOMER_ID,
    seedCustomerDoc(ver, dt) as unknown as Record<string, unknown>,
  );
  if (tasks) {
    for (const row of seedTaskTemplates(ver, dt)) {
      await saveIfMissing(tasks, row.id, row.doc as unknown as Record<string, unknown>);
    }
  }
  for (const row of seedInboundJobs(ver, dt)) {
    await saveIfMissing(woin, row.id, row.doc as unknown as Record<string, unknown>);
  }
}

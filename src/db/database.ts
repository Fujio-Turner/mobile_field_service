import { dbNameForUser } from '../ids';
import { getOrCreateDbKey, sha256Hex } from '../session/dbKey';
import { applyIndexes } from './applyIndexes';
import { FIELD_COLLECTIONS, FIELD_SCOPE, LOCAL_SCOPE, TMP_COLLECTION } from './collections';
import { getCblEngine } from './engine';
import { isCblNativeAvailable } from './native';
import { seedIfNeeded } from './seed';

export type OpenedDatabase = {
  name: string;
  close: () => Promise<void>;
};

let opened: { db: { close: () => Promise<void>; createCollection: (n: string, s: string) => Promise<unknown>; collection: (n: string, s: string) => Promise<unknown> }; name: string } | null =
  null;

export async function openFieldDatabase(employeeId: string): Promise<OpenedDatabase> {
  getCblEngine();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database, DatabaseConfiguration, FileSystem } = require('cbl-reactnative') as {
    Database: new (name: string, config: unknown) => {
      open: () => Promise<void>;
      close: () => Promise<void>;
      createCollection: (n: string, s: string) => Promise<unknown>;
      collection: (n: string, s: string) => Promise<unknown>;
    };
    DatabaseConfiguration: new () => {
      setDirectory: (p: string) => void;
      setEncryptionKey: (k: string) => void;
    };
    FileSystem: new () => { getDefaultPath: () => Promise<string> };
  };

  const hex = await sha256Hex(employeeId);
  const name = dbNameForUser(employeeId, hex);
  if (opened && opened.name === name) {
    return { name, close: () => closeFieldDatabase() };
  }
  if (opened) await opened.db.close();

  const key = await getOrCreateDbKey(employeeId);
  const fileSystem = new FileSystem();
  const directoryPath = await fileSystem.getDefaultPath();
  const config = new DatabaseConfiguration();
  config.setDirectory(directoryPath);
  config.setEncryptionKey(key);

  const db = new Database(name, config);
  await db.open();
  for (const col of FIELD_COLLECTIONS) {
    await db.createCollection(col, FIELD_SCOPE);
  }
  await db.createCollection(TMP_COLLECTION, LOCAL_SCOPE);
  await applyIndexes(db);
  await seedIfNeeded(db);
  opened = { db, name };
  return { name, close: () => closeFieldDatabase() };
}

export async function closeFieldDatabase(): Promise<void> {
  if (!opened) return;
  try {
    await opened.db.close();
  } finally {
    opened = null;
  }
}

export function nativeDbAvailable(): boolean {
  return isCblNativeAvailable();
}

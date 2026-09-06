import { isDbEncryptionEnabled } from '../dev/dbEncryption';
import { dbNameForUser } from '../ids';
import { log } from '../log/logger';
import { getOrCreateDbKey, sha256Hex } from '../session/dbKey';
import { applyIndexes } from './applyIndexes';
import { FIELD_COLLECTIONS, FIELD_SCOPE, LOCAL_SCOPE, TMP_COLLECTION } from './collections';
import { getCblEngine } from './engine';
import { isCblNativeAvailable } from './native';
import { seedIfNeeded } from './seed';

export type QueryLike = {
  execute: () => Promise<unknown>;
  addChangeListener?: (cb: (change: unknown) => void) => Promise<unknown>;
  removeChangeListener?: (token: unknown) => Promise<void>;
  setParameters?: (p: unknown) => void;
  addParameter?: (p: unknown) => void;
  parameters?: unknown;
  explain?: () => Promise<string>;
};

export type CblDatabase = {
  close: () => Promise<void>;
  createCollection: (n: string, s: string) => Promise<unknown>;
  collection: (n: string, s: string) => Promise<unknown>;
  createQuery: (sql: string) => QueryLike;
  getPath?: () => Promise<string>;
};

export type OpenedDatabase = {
  name: string;
  directory: string;
  path: string | null;
  close: () => Promise<void>;
};

export type OpenedDatabaseMeta = {
  name: string;
  directory: string;
  path: string | null;
};

let opened: { db: CblDatabase; name: string; directory: string; path: string | null } | null = null;
const collectionCache = new Map<string, unknown>();

export function getOpenedDatabase(): CblDatabase | null {
  return opened?.db ?? null;
}

export function openedDatabaseMeta(): OpenedDatabaseMeta | null {
  if (!opened) return null;
  return { name: opened.name, directory: opened.directory, path: opened.path };
}

export function resetCollectionCache(): void {
  collectionCache.clear();
}

export async function collectionOf(name: string, scope = FIELD_SCOPE): Promise<unknown | null> {
  const db = getOpenedDatabase();
  if (!db) return null;
  const key = `${scope}.${name}`;
  if (collectionCache.has(key)) return collectionCache.get(key) ?? null;
  const col = await db.collection(name, scope);
  if (col) collectionCache.set(key, col);
  return col ?? null;
}

export async function openFieldDatabase(employeeId: string): Promise<OpenedDatabase> {
  getCblEngine();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database, DatabaseConfiguration, FileSystem } = require('cbl-reactnative') as {
    Database: new (name: string, config: unknown) => CblDatabase & { open: () => Promise<void> };
    DatabaseConfiguration: new () => {
      setDirectory: (p: string) => void;
      setEncryptionKey: (k: string) => void;
    };
    FileSystem: new () => { getDefaultPath: () => Promise<string> };
  };

  const hex = await sha256Hex(employeeId);
  const name = dbNameForUser(employeeId, hex);
  if (opened && opened.name === name) {
    return {
      name: opened.name,
      directory: opened.directory,
      path: opened.path,
      close: () => closeFieldDatabase(),
    };
  }
  if (opened) {
    await opened.db.close();
    opened = null;
    resetCollectionCache();
  }

  const fileSystem = new FileSystem();
  const directoryPath = await fileSystem.getDefaultPath();
  const encrypt = await isDbEncryptionEnabled();
  try {
    return await openAt(name, directoryPath, encrypt, employeeId, Database, DatabaseConfiguration);
  } catch (err) {
    log.warn('mfs.db.open_fail', { op: 'OpenFieldDatabase', encryption: encrypt, err });
    await closeFieldDatabase();
    await deleteLocalDatabase(name, directoryPath);
    return openAt(name, directoryPath, encrypt, employeeId, Database, DatabaseConfiguration);
  }
}

async function openAt(
  name: string,
  directoryPath: string,
  encrypt: boolean,
  employeeId: string,
  Database: new (name: string, config: unknown) => CblDatabase & { open: () => Promise<void> },
  DatabaseConfiguration: new () => {
    setDirectory: (p: string) => void;
    setEncryptionKey: (k: string) => void;
  },
): Promise<OpenedDatabase> {
  const config = new DatabaseConfiguration();
  config.setDirectory(directoryPath);
  if (encrypt) {
    config.setEncryptionKey(await getOrCreateDbKey(employeeId));
  }
  const db = new Database(name, config);
  await db.open();
  for (const col of FIELD_COLLECTIONS) {
    await db.createCollection(col, FIELD_SCOPE);
  }
  await db.createCollection(TMP_COLLECTION, LOCAL_SCOPE);
  await applyIndexes(db);
  await seedIfNeeded(db);
  let path: string | null = null;
  try {
    if (typeof db.getPath === 'function') path = await db.getPath();
  } catch {
    path = null;
  }
  if (!path) path = `${directoryPath.replace(/\/$/, '')}/${name}.cblite2`;
  opened = { db, name, directory: directoryPath, path };
  log.info('mfs.db.open', { op: 'OpenFieldDatabase', encryption: encrypt });
  return { name, directory: directoryPath, path, close: () => closeFieldDatabase() };
}

async function deleteLocalDatabase(name: string, directory: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('cbl-reactnative') as {
      Database: { deleteDatabase?: (n: string, dir: string) => Promise<void> };
    };
    if (typeof Database.deleteDatabase === 'function') {
      await Database.deleteDatabase(name, directory);
      log.info('mfs.db.wipe', { op: 'DeleteDatabase' });
    }
  } catch (err) {
    log.warn('mfs.db.wipe_fail', { op: 'DeleteDatabase', err });
  }
}

/** Close, optionally wipe the file, open again. Lab encryption toggle. */
export async function reopenFieldDatabase(
  employeeId: string,
  opts: { wipe?: boolean } = {},
): Promise<OpenedDatabase> {
  const hex = await sha256Hex(employeeId);
  const name = dbNameForUser(employeeId, hex);
  let directory = opened?.directory ?? null;
  await closeFieldDatabase();
  if (opts.wipe) {
    if (!directory) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { FileSystem } = require('cbl-reactnative') as {
        FileSystem: new () => { getDefaultPath: () => Promise<string> };
      };
      directory = await new FileSystem().getDefaultPath();
    }
    await deleteLocalDatabase(name, directory);
  }
  return openFieldDatabase(employeeId);
}

export async function closeFieldDatabase(): Promise<void> {
  if (!opened) return;
  try {
    await opened.db.close();
  } finally {
    opened = null;
    resetCollectionCache();
  }
}

export function nativeDbAvailable(): boolean {
  return isCblNativeAvailable();
}

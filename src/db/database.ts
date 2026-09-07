import { isDbEncryptionEnabled } from '../dev/dbEncryption';
import { dbNameForUser } from '../ids';
import { log } from '../log/logger';
import {
  getOrCreateDbKey,
  peekDbKey,
  readCblUniqueName,
  sha256Hex,
  writeCblUniqueName,
} from '../session/dbKey';
import { applyIndexes } from './applyIndexes';
import { FIELD_COLLECTIONS, FIELD_SCOPE, LOCAL_SCOPE, TMP_COLLECTION } from './collections';
import { getCblEngine } from './engine';
import { isCblNativeAvailable } from './native';
import { cblite2Folder, mismatchRecoveryModes } from './openRecovery';
import { seedIfNeeded } from './seed';

type DatabaseCtor = new (name: string, config: unknown) => CblDatabase & {
  open: () => Promise<unknown>;
  deleteDatabase?: () => Promise<void>;
};
type ConfigCtor = new () => {
  setDirectory: (p: string) => void;
  setEncryptionKey: (k: string) => void;
};

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
  deleteDatabase?: () => Promise<void>;
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

function asOpened(meta: { name: string; directory: string; path: string | null }): OpenedDatabase {
  return {
    name: meta.name,
    directory: meta.directory,
    path: meta.path,
    close: () => closeFieldDatabase(),
  };
}

export async function openFieldDatabase(employeeId: string): Promise<OpenedDatabase> {
  getCblEngine();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database, DatabaseConfiguration, FileSystem } = require('cbl-reactnative') as {
    Database: DatabaseCtor & { deleteDatabase?: (n: string, dir: string) => Promise<void> };
    DatabaseConfiguration: ConfigCtor;
    FileSystem: new () => { getDefaultPath: () => Promise<string> };
  };

  const hex = await sha256Hex(employeeId);
  const name = dbNameForUser(employeeId, hex);
  if (opened && opened.name === name) return asOpened(opened);
  if (opened) {
    await opened.db.close();
    opened = null;
    resetCollectionCache();
  }

  await closeLeftoverNative(employeeId);

  const directoryPath = await new FileSystem().getDefaultPath();
  const encrypt = await isDbEncryptionEnabled();
  try {
    return await openAt(name, directoryPath, encrypt, employeeId, Database, DatabaseConfiguration);
  } catch (err) {
    log.warn('mfs.db.open_fail', { op: 'OpenFieldDatabase', encryption: encrypt, err });
    await closeFieldDatabase();
    return recoverOpen(name, directoryPath, encrypt, employeeId, Database, DatabaseConfiguration);
  }
}

async function recoverOpen(
  name: string,
  directoryPath: string,
  encrypt: boolean,
  employeeId: string,
  Database: DatabaseCtor,
  DatabaseConfiguration: ConfigCtor,
): Promise<OpenedDatabase> {
  const hasKey = Boolean(await peekDbKey(employeeId));
  for (const other of mismatchRecoveryModes(encrypt, hasKey)) {
    try {
      await openAt(name, directoryPath, other, employeeId, Database, DatabaseConfiguration);
    } catch (err) {
      log.warn('mfs.db.open_fail', { op: 'RecoverMismatch', encryption: other, err });
      await closeFieldDatabase();
      continue;
    }
    const wiped = await wipeOpenedDatabase();
    if (!wiped) continue;
    try {
      const next = await openAt(name, directoryPath, encrypt, employeeId, Database, DatabaseConfiguration);
      log.info('mfs.db.recover', { op: 'OpenFieldDatabase', from_encryption: other, to_encryption: encrypt });
      return next;
    } catch (err) {
      log.warn('mfs.db.open_fail', { op: 'RecoverMismatch', encryption: encrypt, err });
      await closeFieldDatabase();
    }
  }
  await deleteLocalDatabase(name, directoryPath);
  return openAt(name, directoryPath, encrypt, employeeId, Database, DatabaseConfiguration);
}

async function openAt(
  name: string,
  directoryPath: string,
  encrypt: boolean,
  employeeId: string,
  Database: DatabaseCtor,
  DatabaseConfiguration: ConfigCtor,
): Promise<OpenedDatabase> {
  const config = new DatabaseConfiguration();
  config.setDirectory(directoryPath);
  if (encrypt) {
    config.setEncryptionKey(await getOrCreateDbKey(employeeId));
  }
  const db = new Database(name, config);
  const openedName = await db.open();
  const unique =
    typeof openedName === 'string'
      ? openedName
      : openedName && typeof openedName === 'object'
        ? String((openedName as { databaseUniqueName?: string }).databaseUniqueName ?? '')
        : '';
  if (unique) {
    try {
      await writeCblUniqueName(employeeId, unique);
    } catch {
      /* unique id is only for leftover-close; open still succeeds */
    }
  }
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
  if (!path) path = cblite2Folder(directoryPath, name);
  opened = { db, name, directory: directoryPath, path };
  log.info('mfs.db.open', { op: 'OpenFieldDatabase', encryption: encrypt });
  return asOpened(opened);
}

async function closeLeftoverNative(employeeId: string): Promise<void> {
  const unique = await readCblUniqueName(employeeId);
  if (!unique) return;
  try {
    const engine = getCblEngine() as unknown as { database_Close: (args: { name: string }) => Promise<void> };
    await engine.database_Close({ name: unique });
  } catch {
    /* already closed, or process restart cleared the native map */
  }
}

async function wipeOpenedDatabase(): Promise<boolean> {
  const current = opened;
  if (!current) return false;
  let ok = false;
  try {
    if (typeof current.db.deleteDatabase === 'function') {
      await current.db.deleteDatabase();
      log.info('mfs.db.wipe', { op: 'DeleteOpenDatabase' });
      ok = true;
    } else {
      await current.db.close();
      ok = await deleteLocalDatabase(current.name, current.directory);
    }
  } catch (err) {
    log.warn('mfs.db.wipe_fail', { op: 'DeleteOpenDatabase', err });
    try {
      await current.db.close();
    } catch {
      /* already closed */
    }
    ok = await deleteLocalDatabase(current.name, current.directory);
  } finally {
    opened = null;
    resetCollectionCache();
  }
  return ok;
}

async function deleteLocalDatabase(name: string, directory: string): Promise<boolean> {
  let ok = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('cbl-reactnative') as {
      Database: { deleteDatabase?: (n: string, dir: string) => Promise<void> };
    };
    if (typeof Database.deleteDatabase === 'function') {
      await Database.deleteDatabase(name, directory);
      log.info('mfs.db.wipe', { op: 'DeleteDatabase' });
      ok = true;
    }
  } catch (err) {
    log.warn('mfs.db.wipe_fail', { op: 'DeleteDatabase', err });
  }
  return ok;
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

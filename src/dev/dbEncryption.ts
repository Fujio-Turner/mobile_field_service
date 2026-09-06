import * as SecureStore from 'expo-secure-store';

/** Lab toggle. Default **off** — unencrypted CBL file. */
export const DB_ENCRYPTION_KEY = 'mfs.dev.dbEncryption';

export const DEFAULT_DB_ENCRYPTION = false;

export function parseDbEncryptionFlag(raw: string | null | undefined): boolean {
  return raw === '1' || raw === 'true';
}

export async function isDbEncryptionEnabled(): Promise<boolean> {
  try {
    return parseDbEncryptionFlag(await SecureStore.getItemAsync(DB_ENCRYPTION_KEY));
  } catch {
    return DEFAULT_DB_ENCRYPTION;
  }
}

export async function setDbEncryptionEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(DB_ENCRYPTION_KEY, on ? '1' : '0');
}

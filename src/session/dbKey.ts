import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { bytesToBase64, cblUniqueItem, dbKeyItem } from './dbKeyCodec';

export { bytesToBase64, cblUniqueItem, dbKeyItem };

/** 32 random bytes, base64. Stored in Keychain; passed to setEncryptionKey(string) when lab encryption is on. */
export async function getOrCreateDbKey(employeeId: string): Promise<string> {
  const item = dbKeyItem(employeeId);
  const existing = await SecureStore.getItemAsync(item);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = bytesToBase64(bytes);
  await SecureStore.setItemAsync(item, key);
  return key;
}

/** Existing key or null — does not mint. Used to open a leftover encrypted file when the lab toggle is off. */
export async function peekDbKey(employeeId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(dbKeyItem(employeeId));
  } catch {
    return null;
  }
}

export async function readCblUniqueName(employeeId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(cblUniqueItem(employeeId));
  } catch {
    return null;
  }
}

export async function writeCblUniqueName(employeeId: string, unique: string): Promise<void> {
  await SecureStore.setItemAsync(cblUniqueItem(employeeId), unique);
}

export async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { bytesToBase64, dbKeyItem } from './dbKeyCodec';

export { bytesToBase64, dbKeyItem };

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

export async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

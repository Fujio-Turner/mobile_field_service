import * as SecureStore from 'expo-secure-store';
import { AUTH_KEYS, type Session } from './types';

async function set(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function get(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

async function del(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function writeSession(session: Session, password?: string): Promise<void> {
  await set(AUTH_KEYS.strategy, session.strategy);
  await set(AUTH_KEYS.username, session.username);
  await set(AUTH_KEYS.email, session.email);
  await set(AUTH_KEYS.employeeId, session.employeeId);
  await set(AUTH_KEYS.sessionId, session.sessionId);
  await set(AUTH_KEYS.cookieName, session.cookieName);
  await set(AUTH_KEYS.sessionExpiresAt, String(session.sessionExpiresAt));
  if (session.strategy === 'basic' && password) {
    await set(AUTH_KEYS.password, password);
  }
}

export async function readSession(): Promise<Session | null> {
  const strategy = (await get(AUTH_KEYS.strategy)) as Session['strategy'] | null;
  const username = await get(AUTH_KEYS.username);
  const email = await get(AUTH_KEYS.email);
  const employeeId = await get(AUTH_KEYS.employeeId);
  const sessionId = await get(AUTH_KEYS.sessionId);
  const cookieName = await get(AUTH_KEYS.cookieName);
  const expiresRaw = await get(AUTH_KEYS.sessionExpiresAt);
  if (!strategy || !username || !email || !employeeId || !sessionId || !cookieName || !expiresRaw) {
    return null;
  }
  const sessionExpiresAt = Number(expiresRaw);
  if (!Number.isFinite(sessionExpiresAt)) return null;
  return { strategy, username, email, employeeId, sessionId, cookieName, sessionExpiresAt };
}

export async function readPassword(): Promise<string | null> {
  return get(AUTH_KEYS.password);
}

/** 401 after failed refresh: drop password so a stolen phone cannot mint sessions. */
export async function clearPassword(): Promise<void> {
  await del(AUTH_KEYS.password);
}

/** Logout: drop auth.* including password. Keep mfs.dbkey.* */
export async function clearAuthKeys(): Promise<void> {
  await Promise.all(Object.values(AUTH_KEYS).map((k) => del(k)));
}

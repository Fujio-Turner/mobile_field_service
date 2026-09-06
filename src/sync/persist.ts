import * as SecureStore from 'expo-secure-store';
import { parseChannelMap, type CollectionChannelMap } from './channels';

export const COLLECTION_CHANNELS_KEY = 'mfs.sync.collectionChannels';
export const LAST_PULL_KEY = 'mfs.sync.lastPullSuccessAt';
export const LAST_PUSH_KEY = 'mfs.sync.lastPushSuccessAt';

export async function loadCollectionChannels(): Promise<CollectionChannelMap | null> {
  try {
    const raw = await SecureStore.getItemAsync(COLLECTION_CHANNELS_KEY);
    return parseChannelMap(raw);
  } catch {
    return null;
  }
}

export async function saveCollectionChannels(map: CollectionChannelMap): Promise<void> {
  const payload: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(map)) {
    payload[key] = [...(value ?? [])];
  }
  try {
    await SecureStore.setItemAsync(COLLECTION_CHANNELS_KEY, JSON.stringify(payload));
  } catch {
    // debug overrides are best-effort
  }
}

export async function loadEpoch(key: string): Promise<number | undefined> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export async function saveEpoch(key: string, value: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, String(value));
  } catch {
    // debug timestamps are best-effort
  }
}

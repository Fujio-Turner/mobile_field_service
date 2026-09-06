import { FIELD_COLLECTIONS, isReplicatorCollection } from '../db/collections';

/** Per-collection pull channels. Empty / omitted = all SG-granted channels (no client filter). */
export type CollectionChannelMap = Partial<Record<string, readonly string[]>>;

export function normalizeChannels(raw: unknown): string[] {
  if (raw == null) return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,\n]+/)
        .map((s) => s.trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const s = String(item ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function formatChannels(channels: readonly string[]): string {
  return normalizeChannels(channels).join(', ');
}

/** Empty list means do not call setChannels — pull every channel the session can access. */
export function shouldSetChannels(channels: readonly string[]): boolean {
  return normalizeChannels(channels).length > 0;
}

/**
 * Stored map (including `{}`) wins over env. `null` stored = never set → env global, else none.
 */
export function resolveCollectionChannels(
  collectionName: string,
  stored: CollectionChannelMap | null,
  envGlobal: readonly string[] = [],
): string[] {
  if (!isReplicatorCollection(collectionName)) return [];
  if (stored) return normalizeChannels(stored[collectionName]);
  return normalizeChannels(envGlobal);
}

export function envGlobalChannels(): string[] {
  return normalizeChannels(process.env.EXPO_PUBLIC_SG_CHANNELS);
}

export function parseChannelMap(raw: unknown): CollectionChannelMap | null {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isReplicatorCollection(key)) continue;
    out[key] = normalizeChannels(value);
  }
  return out;
}

export function snapshotChannelMap(
  stored: CollectionChannelMap | null,
  envGlobal: readonly string[] = envGlobalChannels(),
  names: readonly string[] = FIELD_COLLECTIONS,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const name of names) {
    out[name] = resolveCollectionChannels(name, stored, envGlobal);
  }
  return out;
}

export function applyChannelsToAll(
  channels: readonly string[],
  names: readonly string[] = FIELD_COLLECTIONS,
): CollectionChannelMap {
  const list = normalizeChannels(channels);
  const out: Record<string, string[]> = {};
  for (const name of names) out[name] = [...list];
  return out;
}

export function emptyChannelMap(names: readonly string[] = FIELD_COLLECTIONS): CollectionChannelMap {
  const out: Record<string, string[]> = {};
  for (const name of names) out[name] = [];
  return out;
}

export function filteredCollectionCount(map: Record<string, string[]>): number {
  return Object.values(map).filter((ch) => ch.length > 0).length;
}

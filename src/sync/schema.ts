import { FIELD_COLLECTIONS } from '../db/collections';
import { replicatorCollectionNames } from './filters';

/** Build-time replication schema. Not a Profile setting. */
export type ReplSchema = 'simple' | 'oneshot';

export type OneshotReason = 'bootstrap' | 'interval' | 'foreground' | 'manual';

/** First oneshot in the `oneshot` schema — today's inbound work. */
export const ONESHOT_BOOTSTRAP_COLLECTIONS = ['workordersin', 'orders'] as const;

/** Pure parse so tests are not blocked by Expo inlining EXPO_PUBLIC_* . */
export function parseReplSchema(raw: string | undefined | null): ReplSchema {
  const v = (raw ?? 'simple').trim().toLowerCase();
  if (v === 'oneshot' || v === 'one-shot' || v === 'scheduled') return 'oneshot';
  return 'simple';
}

export function replSchema(): ReplSchema {
  return parseReplSchema(process.env.EXPO_PUBLIC_REPL_SCHEMA);
}

/** Seconds between follow-up oneshots. Default 300 (5 min). Floor 30. */
export function parseOneshotIntervalSec(raw: string | undefined | null): number {
  const n = Number(raw ?? 300);
  if (!Number.isFinite(n)) return 300;
  return Math.max(30, Math.floor(n));
}

export function oneshotIntervalSec(): number {
  return parseOneshotIntervalSec(process.env.EXPO_PUBLIC_REPL_ONESHOT_SEC);
}

export function allReplicatorCollections(): string[] {
  return replicatorCollectionNames(FIELD_COLLECTIONS);
}

export function oneshotBootstrapCollections(
  allow: readonly string[] = allReplicatorCollections(),
): string[] {
  const want = new Set<string>(ONESHOT_BOOTSTRAP_COLLECTIONS);
  return allow.filter((n) => want.has(n) && n !== 'tmp');
}

export function shouldRunOneshot(input: {
  busy: boolean;
  bootstrapDone: boolean;
  lastAt?: number;
  now: number;
  intervalSec: number;
  reason: OneshotReason;
}): boolean {
  if (input.busy) return false;
  if (input.reason === 'interval' && !input.bootstrapDone) return false;
  if (
    input.reason === 'interval' &&
    input.lastAt != null &&
    input.now - input.lastAt < input.intervalSec
  ) {
    return false;
  }
  // Collapse DatabaseProvider + AppState both firing on mount.
  if (input.reason === 'foreground' && input.lastAt != null && input.now - input.lastAt < 5) {
    return false;
  }
  return true;
}

export function oneshotCollectionsFor(bootstrapDone: boolean, allow?: readonly string[]): string[] {
  const all = allow ?? allReplicatorCollections();
  return bootstrapDone ? [...all] : oneshotBootstrapCollections(all);
}

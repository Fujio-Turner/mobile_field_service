import { FIELD_COLLECTIONS } from '../db/collections';
import { buildCollectionAllowList, replicatorLiveStatus } from '../sync/replicator';
import { pushFilterFor } from '../sync/filters';

export type SyncSnapshot = {
  activity: string;
  activityLevel: number;
  pending: number;
  started: boolean;
  skippedReason?: string;
  lastErrorCode?: number;
  lastPullSuccessAt?: number;
  lastPushSuccessAt?: number;
  progressCompleted?: number;
  progressTotal?: number;
  replicatorUrl: string;
  dbName: string | null;
  dbPath: string | null;
  dbDirectory: string | null;
  channels: Record<string, string[]>;
  channelFilterCollections: number;
  schema: 'simple' | 'oneshot';
  continuous: boolean;
  oneshotPhase: 'idle' | 'bootstrap' | 'full';
  oneshotBootstrapDone: boolean;
  oneshotIntervalSec: number;
  lastOneshotAt?: number;
  activeCollections: string[];
  lastErrorClass?: string;
  docsCompleted: number;
  docsFailed: number;
  docsPushOk: number;
  docsPullOk: number;
  docsConflict: number;
  lastDocId?: string;
  lastDocCollection?: string;
  conflictPolicies: Record<string, string>;
  collections: string[];
  filters: Record<string, string>;
  tmpExcluded: boolean;
};

export function syncSnapshot(): SyncSnapshot {
  const collections = buildCollectionAllowList();
  const filters: Record<string, string> = {};
  for (const name of collections) {
    filters[name] = pushFilterFor(name).name || 'anonymous';
  }
  const live = replicatorLiveStatus();
  return {
    ...live,
    collections,
    filters,
    tmpExcluded: !collections.includes('tmp') && !(FIELD_COLLECTIONS as readonly string[]).includes('tmp' as never),
  };
}

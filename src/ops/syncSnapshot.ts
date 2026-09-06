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

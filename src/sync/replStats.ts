import { classifyReplError, extractErrorCode, type ReplErrorClass } from './codes';
import { conflictPolicyFor } from './conflicts';

export type ReplDocStatEvent = {
  id: string;
  collection: string;
  isPush: boolean;
  error?: unknown;
};

export type ReplDocStats = {
  pushOk: number;
  pullOk: number;
  pushErr: number;
  pullErr: number;
  conflict: number;
  completed: number;
  failed: number;
  lastDocId?: string;
  lastDocCollection?: string;
  lastDocIsPush?: boolean;
  lastDocErrorClass?: ReplErrorClass;
  lastDocErrorCode?: number;
};

const empty = (): ReplDocStats => ({
  pushOk: 0,
  pullOk: 0,
  pushErr: 0,
  pullErr: 0,
  conflict: 0,
  completed: 0,
  failed: 0,
});

let stats: ReplDocStats = empty();

export function resetReplDocStats(): void {
  stats = empty();
}

export function replDocStats(): ReplDocStats {
  return { ...stats };
}

export function recordReplicatedDoc(ev: ReplDocStatEvent): ReplErrorClass | undefined {
  stats.lastDocId = ev.id;
  stats.lastDocCollection = ev.collection;
  stats.lastDocIsPush = ev.isPush;
  const code = extractErrorCode(ev.error);
  if (code == null && !ev.error) {
    if (ev.isPush) stats.pushOk += 1;
    else stats.pullOk += 1;
    stats.completed = stats.pushOk + stats.pullOk;
    stats.lastDocErrorClass = undefined;
    stats.lastDocErrorCode = undefined;
    return undefined;
  }
  const cls = classifyReplError(code);
  stats.lastDocErrorClass = cls;
  stats.lastDocErrorCode = code;
  if (ev.isPush) stats.pushErr += 1;
  else stats.pullErr += 1;
  stats.failed = stats.pushErr + stats.pullErr;
  if (cls === 'conflict') stats.conflict += 1;
  return cls;
}

export function conflictNote(collection: string): string {
  return conflictPolicyFor(collection).strategy;
}

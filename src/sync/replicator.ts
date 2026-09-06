import { FIELD_COLLECTIONS, FIELD_SCOPE } from '../db/collections';
import { getOpenedDatabase, nativeDbAvailable, openedDatabaseMeta } from '../db/database';
import { log } from '../log/logger';
import { recordMetric } from '../metrics';
import type { StartSession } from '../ops/copyInbound';
import { pendingPushCountLocal } from '../ops/pendingPush';
import type { Session } from '../session/types';
import { acceptSelfSigned, sgReplicatorUrl } from '../session/sgSession';
import {
  envGlobalChannels,
  filteredCollectionCount,
  resolveCollectionChannels,
  snapshotChannelMap,
  type CollectionChannelMap,
} from './channels';
import {
  activityName,
  classifyReplError,
  extractErrorCode,
  isAuthFailureCode,
  isTlsCode,
  isTransientCode,
  metricErrorCode,
  type ActivityName,
  type ReplErrorClass,
} from './codes';
import { conflictPolicyMatrix, conflictResolverFor } from './conflicts';
import { handleReplicatedDoc, parseReplicatedDocs } from './documentListener';
import { replDocStats, resetReplDocStats } from './replStats';
import { FIELD_PUSH_FILTERS, neverPushFilter, replicatorCollectionNames, type PushDoc } from './filters';
import { LAST_PULL_KEY, LAST_PUSH_KEY, loadCollectionChannels, loadEpoch, saveCollectionChannels, saveEpoch } from './persist';
import {
  oneshotCollectionsFor,
  oneshotIntervalSec,
  replSchema,
  shouldRunOneshot,
  type OneshotReason,
  type ReplSchema,
} from './schema';

type NativeReplicator = {
  start: (reset: boolean) => Promise<void>;
  stop?: () => Promise<void>;
  addChangeListener?: (cb: (s: unknown) => void) => Promise<unknown>;
  addDocumentChangeListener?: (cb: (d: unknown) => void) => Promise<unknown>;
  pendingDocumentIdsInCollection?: (col: unknown) => Promise<unknown>;
};

export type ReplicatorHooks = {
  refreshAuth: () => Promise<Session | null>;
  onAuthLost: () => void;
};

type LiveStatus = {
  activity: ActivityName;
  activityLevel: number;
  pending: number;
  lastErrorCode?: number;
  lastPullSuccessAt?: number;
  lastPushSuccessAt?: number;
  progressCompleted?: number;
  progressTotal?: number;
  started: boolean;
  skippedReason?: string;
  replicatorUrl: string;
  dbName: string | null;
  dbPath: string | null;
  dbDirectory: string | null;
  channels: Record<string, string[]>;
  channelFilterCollections: number;
  schema: ReplSchema;
  continuous: boolean;
  oneshotPhase: 'idle' | 'bootstrap' | 'full';
  oneshotBootstrapDone: boolean;
  oneshotIntervalSec: number;
  lastOneshotAt?: number;
  activeCollections: string[];
  lastErrorClass?: ReplErrorClass;
  docsCompleted: number;
  docsFailed: number;
  docsPushOk: number;
  docsPullOk: number;
  docsConflict: number;
  lastDocId?: string;
  lastDocCollection?: string;
  conflictPolicies: Record<string, string>;
};

let nativeRepl: NativeReplicator | null = null;
let started = false;
let skippedReason: string | undefined;
let activityLevel = 0;
let lastErrorCode: number | undefined;
let lastErrorClass: ReplErrorClass | undefined;
let lastPullSuccessAt: number | undefined;
let lastPushSuccessAt: number | undefined;
let progressCompleted: number | undefined;
let progressTotal: number | undefined;
let authRefreshTried = false;
let fatalTls = false;
let pendingOverride: number | null = null;
let hooks: ReplicatorHooks | null = null;
let liveSession: StartSession | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastStatusLog = '';
let liveChannels: Record<string, string[]> = snapshotChannelMap(null);
let timesHydrated = false;
let liveContinuous = true;
let liveActiveCollections: string[] = replicatorCollectionNames(FIELD_COLLECTIONS);
let oneshotPhase: 'idle' | 'bootstrap' | 'full' = 'idle';
let oneshotBootstrapDone = false;
let oneshotBusy = false;
let lastOneshotAt: number | undefined;

export function isReplicatorStarted(): boolean {
  return started;
}

export function lastReplicatorAuthFailure(): number | null {
  return lastErrorCode != null && isAuthFailureCode(lastErrorCode) ? lastErrorCode : null;
}

export function buildCollectionAllowList(): string[] {
  return replicatorCollectionNames(FIELD_COLLECTIONS);
}

export function buildPushFilterMatrix(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of buildCollectionAllowList()) {
    out[name] = (FIELD_PUSH_FILTERS[name] ?? neverPushFilter).name || 'fn';
  }
  return out;
}

function sessionAsStart(session: Session): StartSession {
  return {
    employeeId: session.employeeId,
    email: session.email,
    username: session.username,
  };
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function replicatorLiveStatus(): LiveStatus {
  const meta = openedDatabaseMeta();
  const docs = replDocStats();
  return {
    activity: activityName(activityLevel),
    activityLevel,
    pending: pendingOverride ?? 0,
    lastErrorCode,
    lastPullSuccessAt,
    lastPushSuccessAt,
    progressCompleted,
    progressTotal,
    started,
    skippedReason,
    replicatorUrl: sgReplicatorUrl() || '(not set)',
    dbName: meta?.name ?? null,
    dbPath: meta?.path ?? null,
    dbDirectory: meta?.directory ?? null,
    channels: { ...liveChannels },
    channelFilterCollections: filteredCollectionCount(liveChannels),
    schema: replSchema(),
    continuous: liveContinuous,
    oneshotPhase,
    oneshotBootstrapDone,
    oneshotIntervalSec: oneshotIntervalSec(),
    lastOneshotAt,
    activeCollections: [...liveActiveCollections],
    lastErrorClass,
    docsCompleted: docs.completed,
    docsFailed: docs.failed,
    docsPushOk: docs.pushOk,
    docsPullOk: docs.pullOk,
    docsConflict: docs.conflict,
    lastDocId: docs.lastDocId,
    lastDocCollection: docs.lastDocCollection,
    conflictPolicies: conflictPolicyMatrix(),
  };
}

export function replicatorChannelMap(): Record<string, string[]> {
  return { ...liveChannels };
}

export async function hydrateSyncTimes(): Promise<void> {
  if (timesHydrated) return;
  timesHydrated = true;
  if (lastPullSuccessAt == null) lastPullSuccessAt = await loadEpoch(LAST_PULL_KEY);
  if (lastPushSuccessAt == null) lastPushSuccessAt = await loadEpoch(LAST_PUSH_KEY);
}

async function pendingFromNative(repl: NativeReplicator): Promise<number | null> {
  if (typeof repl.pendingDocumentIdsInCollection !== 'function') return null;
  const db = getOpenedDatabase();
  if (!db) return null;
  try {
    let total = 0;
    for (const name of buildCollectionAllowList()) {
      if ((FIELD_PUSH_FILTERS[name] ?? neverPushFilter) === neverPushFilter) continue;
      const col = await db.collection(name, FIELD_SCOPE);
      const ids = await repl.pendingDocumentIdsInCollection(col);
      if (ids && typeof (ids as { size?: number }).size === 'number') total += (ids as { size: number }).size;
      else if (Array.isArray(ids)) total += ids.length;
    }
    return total;
  } catch {
    return null;
  }
}

export async function refreshPendingCount(): Promise<number> {
  if (nativeRepl) {
    const n = await pendingFromNative(nativeRepl);
    if (n != null) {
      pendingOverride = n;
      return n;
    }
  }
  const n = await pendingPushCountLocal();
  pendingOverride = n;
  return n;
}

type StatusBlob = {
  activity?: number;
  getActivityLevel?: () => number;
  error?: { code?: number; getCode?: () => number };
  getError?: () => { code?: number; getCode?: () => number } | null;
  progress?: { completed?: number; total?: number };
  getProgress?: () => { completed?: number; total?: number };
};

async function onStatus(raw: unknown): Promise<void> {
  const wrapped = raw as StatusBlob & { status?: StatusBlob };
  const st: StatusBlob = wrapped.status ?? wrapped;
  const level =
    typeof st.getActivityLevel === 'function'
      ? st.getActivityLevel()
      : Number(st.activity ?? activityLevel);
  const nextLevel = Number.isFinite(level) ? level : 0;
  if (nextLevel !== activityLevel) recordMetric('mfs_replicator_activity', nextLevel);
  activityLevel = nextLevel;

  const errObj = typeof st.getError === 'function' ? st.getError() : st.error;
  const code = extractErrorCode(errObj);
  const progress = typeof st.getProgress === 'function' ? st.getProgress() : st.progress;
  if (progress) {
    progressCompleted = progress.completed;
    progressTotal = progress.total;
  }

  if (activityLevel === 3 || activityLevel === 4) {
    lastErrorCode = undefined;
    lastErrorClass = undefined;
  }
  if (activityLevel === 3) {
    const t = nowSec();
    lastPullSuccessAt = t;
    lastPushSuccessAt = t;
    void saveEpoch(LAST_PULL_KEY, t);
    void saveEpoch(LAST_PUSH_KEY, t);
    if (!liveContinuous) queueOneshotFinish('idle');
  }
  if (!liveContinuous && activityLevel === 0 && !isAuthFailureCode(code) && !isTlsCode(code)) {
    queueOneshotFinish(code != null ? 'stopped_error' : 'stopped');
  }

  if (code != null) {
    lastErrorCode = code;
    lastErrorClass = classifyReplError(code);
    recordMetric('mfs_replicator_errors_total', 1, { code: metricErrorCode(code) });
    logReplicatorHttpError(code, activityLevel);
  }

  if (activityLevel === 0 && isAuthFailureCode(code)) {
    log.error('mfs.repl.auth_fail', { op: 'OnReplicatorAuthFailure', errCode: code, errClass: lastErrorClass });
    started = false;
    await nativeRepl?.stop?.();
    if (!authRefreshTried && hooks) {
      authRefreshTried = true;
      const next = await hooks.refreshAuth();
      if (next) {
        authRefreshTried = false;
        await startReplicator(next, hooks);
        return;
      }
    }
    hooks?.onAuthLost();
    return;
  }
  if (isTlsCode(code)) {
    fatalTls = true;
    return;
  }
  if (isTransientCode(code) || activityLevel === 1) {
    const key = `${activityLevel}:${code ?? ''}`;
    if (key !== lastStatusLog) lastStatusLog = key;
  }
}

function logReplicatorHttpError(code: number, activity: number): void {
  const cls = classifyReplError(code);
  const fields = { op: 'OnReplicatorStatus', errCode: code, errClass: cls, activity };
  switch (cls) {
    case 'auth':
      log.error('mfs.repl.http_auth', fields);
      break;
    case 'not_found':
      log.error('mfs.repl.http_not_found', fields);
      break;
    case 'conflict':
      log.warn('mfs.repl.http_conflict', fields);
      break;
    case 'forbidden':
      log.warn('mfs.repl.http_forbidden', fields);
      break;
    case 'payload':
      log.error('mfs.repl.http_payload', fields);
      break;
    case 'timeout':
      log.warn('mfs.repl.http_timeout', fields);
      break;
    case 'rate_limit':
      log.warn('mfs.repl.http_rate_limit', fields);
      break;
    case 'tls':
      log.error('mfs.repl.tls', fields);
      break;
    case 'client':
      log.warn('mfs.repl.http_client', fields);
      break;
    case 'transient':
      log.warn('mfs.repl.offline', fields);
      break;
    default:
      log.warn('mfs.repl.http_other', fields);
  }
}

function schedulePendingRefresh(): void {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void refreshPendingCount();
  }, 400);
}

let oneshotFinishQueued = false;

function queueOneshotFinish(how: 'idle' | 'stopped' | 'stopped_error'): void {
  if (oneshotFinishQueued || liveContinuous) return;
  oneshotFinishQueued = true;
  const phase = oneshotPhase;
  lastOneshotAt = nowSec();
  if (phase === 'bootstrap') oneshotBootstrapDone = true;
  oneshotBusy = false;
  oneshotPhase = 'idle';
  log.info('mfs.repl.oneshot_complete', { op: 'OneshotComplete', phase, how });
  setTimeout(() => {
    oneshotFinishQueued = false;
    void stopReplicator();
  }, 0);
}

type CollectionConfigLike = {
  setPushFilter?: (fn: (doc: PushDoc, flags?: unknown) => boolean) => void;
  setChannels?: (channels: string[]) => void;
  setConflictResolver?: (fn: (local: unknown, remote: unknown) => unknown) => void;
};

type ReplicatorConfigLike = {
  addCollection?: (col: unknown, config?: CollectionConfigLike) => void;
  setAuthenticator?: (a: unknown) => void;
  setContinuous?: (c: boolean) => void;
  setAcceptOnlySelfSignedCerts?: (v: boolean) => void;
  setAcceptOnlySelfSignedServerCertificate?: (v: boolean) => void;
  setReplicatorType?: (t: unknown) => void;
};

type CblReplApi = {
  URLEndpoint?: new (url: string) => unknown;
  SessionAuthenticator?: new (id: string, cookie?: string) => unknown;
  CollectionConfig?: new (channels: string[] | null, documentIds: string[] | null) => CollectionConfigLike;
  CollectionConfiguration?: new (col: unknown) => CollectionConfigLike;
  ReplicatorConfiguration?: (new (endpoint: unknown) => ReplicatorConfigLike) &
    (new (configs: unknown[], endpoint: unknown) => ReplicatorConfigLike);
  Replicator?: { create: (config: unknown) => Promise<NativeReplicator> };
  ReplicatorType?: { PUSH_AND_PULL?: unknown };
};

export function collectionConfigFor(
  cbl: Pick<CblReplApi, 'CollectionConfig' | 'CollectionConfiguration'>,
  col: unknown,
  filter: (doc: PushDoc, flags?: unknown) => boolean,
  channels: readonly string[],
  collectionName?: string,
): CollectionConfigLike | undefined {
  const list = [...channels];
  const attach = (cc: CollectionConfigLike) => {
    cc.setPushFilter?.(filter);
    if (list.length) cc.setChannels?.(list);
    if (collectionName) {
      const resolver = conflictResolverFor(collectionName);
      if (resolver) cc.setConflictResolver?.(resolver);
    }
    return cc;
  };
  if (cbl.CollectionConfig) {
    return attach(new cbl.CollectionConfig(list.length ? list : null, null));
  }
  if (cbl.CollectionConfiguration) {
    return attach(new cbl.CollectionConfiguration(col));
  }
  return undefined;
}

export type StartReplicatorOpts = {
  continuous?: boolean;
  collections?: readonly string[];
  phase?: 'bootstrap' | 'full';
};

let startLock = false;

export async function startReplicator(
  session: Session,
  nextHooks?: ReplicatorHooks,
  opts?: StartReplicatorOpts,
): Promise<{ ok: boolean; reason?: string }> {
  const schema = replSchema();
  const continuous = opts?.continuous ?? schema === 'simple';
  if (startLock) return { ok: true, reason: 'in_flight' };
  startLock = true;
  if (!continuous) oneshotBusy = true;

  try {
  if (nextHooks) hooks = nextHooks;
  liveSession = sessionAsStart(session);
  skippedReason = undefined;
  const names = replicatorCollectionNames(
    opts?.collections ?? (schema === 'oneshot' ? oneshotCollectionsFor(oneshotBootstrapDone) : buildCollectionAllowList()),
  );
  const phase: 'bootstrap' | 'full' =
    opts?.phase ?? (schema === 'oneshot' && !oneshotBootstrapDone ? 'bootstrap' : 'full');

  await hydrateSyncTimes();
  const stored = await loadCollectionChannels();
  liveChannels = snapshotChannelMap(stored, envGlobalChannels());

  if (session.strategy === 'demo') {
    skippedReason = 'demo';
    oneshotBusy = false;
    log.info('mfs.repl.skip', { op: 'StartReplicator', err: 'demo' });
    return { ok: false, reason: 'demo' };
  }
  const sgUrl = sgReplicatorUrl();
  if (!sgUrl || !session.sessionId) {
    skippedReason = 'missing_session';
    oneshotBusy = false;
    return { ok: false, reason: 'missing_session' };
  }
  if (!nativeDbAvailable() || !getOpenedDatabase()) {
    skippedReason = 'native_db_unavailable';
    oneshotBusy = false;
    log.warn('mfs.repl.skip', { op: 'StartReplicator', err: 'native_db_unavailable' });
    return { ok: false, reason: 'native_db_unavailable' };
  }

  await stopReplicator();
  fatalTls = false;
  oneshotFinishQueued = false;
  resetReplDocStats();
  lastErrorClass = undefined;
  liveContinuous = continuous;
  liveActiveCollections = names;
  oneshotPhase = continuous ? 'idle' : phase;
  if (!continuous) oneshotBusy = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cbl = require('cbl-reactnative') as CblReplApi;
    if (!cbl.URLEndpoint || !cbl.ReplicatorConfiguration || !cbl.Replicator || !cbl.SessionAuthenticator) {
      skippedReason = 'api_missing';
      oneshotBusy = false;
      return { ok: false, reason: 'api_missing' };
    }
    const db = getOpenedDatabase()!;
    const endpoint = new cbl.URLEndpoint(sgUrl);
    const config = new cbl.ReplicatorConfiguration(endpoint);
    let attached = 0;
    for (const name of names) {
      const col = await db.collection(name, FIELD_SCOPE);
      if (!col) continue;
      const filter = FIELD_PUSH_FILTERS[name] ?? neverPushFilter;
      const channels = resolveCollectionChannels(name, stored, envGlobalChannels());
      const cc = collectionConfigFor(cbl, col, filter, channels, name);
      if (typeof config.addCollection === 'function') {
        config.addCollection(col, cc);
        attached += 1;
      }
    }
    if (attached === 0) {
      skippedReason = 'no_collections';
      oneshotBusy = false;
      log.error('mfs.repl.start_fail', { op: 'StartReplicator', err: 'no_collections' });
      return { ok: false, reason: 'no_collections' };
    }
    config.setAuthenticator?.(new cbl.SessionAuthenticator(session.sessionId, session.cookieName || 'SyncGatewaySession'));
    config.setContinuous?.(continuous);
    const selfSigned = acceptSelfSigned(sgUrl);
    config.setAcceptOnlySelfSignedServerCertificate?.(selfSigned);
    config.setAcceptOnlySelfSignedCerts?.(selfSigned);
    if (cbl.ReplicatorType?.PUSH_AND_PULL) config.setReplicatorType?.(cbl.ReplicatorType.PUSH_AND_PULL);

    const replicator = await cbl.Replicator.create(config);
    nativeRepl = replicator;
    await replicator.addChangeListener?.((status) => {
      void onStatus(status);
    });
    await replicator.addDocumentChangeListener?.(async (change) => {
      if (!liveSession) return;
      for (const ev of parseReplicatedDocs(change)) {
        await handleReplicatedDoc(ev, liveSession);
      }
      schedulePendingRefresh();
    });
    await replicator.start(false);
    started = true;
    authRefreshTried = false;
    activityLevel = 2;
    log.info('mfs.repl.start', {
      op: 'StartReplicator',
      schema,
      continuous,
      phase: continuous ? 'continuous' : phase,
      collections: attached,
      channelFilterCollections: filteredCollectionCount(liveChannels),
    });
    schedulePendingRefresh();
    return { ok: true };
  } catch (err) {
    log.error('mfs.repl.start_fail', { op: 'StartReplicator', err });
    skippedReason = 'exception';
    oneshotBusy = false;
    oneshotPhase = 'idle';
    return { ok: false, reason: 'exception' };
  }
  } finally {
    startLock = false;
  }
}

export async function runOneshot(
  session: Session,
  nextHooks?: ReplicatorHooks,
  reason: OneshotReason = 'manual',
): Promise<{ ok: boolean; reason?: string }> {
  if (replSchema() !== 'oneshot') {
    return startReplicator(session, nextHooks);
  }
  const now = nowSec();
  if (
    !shouldRunOneshot({
      busy: oneshotBusy || (started && activityLevel !== 0),
      bootstrapDone: oneshotBootstrapDone,
      lastAt: lastOneshotAt,
      now,
      intervalSec: oneshotIntervalSec(),
      reason,
    })
  ) {
    return { ok: true, reason: 'skipped' };
  }
  const bootstrap = !oneshotBootstrapDone;
  return startReplicator(session, nextHooks, {
    continuous: false,
    collections: oneshotCollectionsFor(!bootstrap),
    phase: bootstrap ? 'bootstrap' : 'full',
  });
}

/** Persist per-collection channel lists (empty = no filter) and recreate the replicator. */
export async function applyCollectionChannels(
  session: Session,
  map: CollectionChannelMap,
  nextHooks?: ReplicatorHooks,
): Promise<{ ok: boolean; reason?: string }> {
  await saveCollectionChannels(map);
  liveChannels = snapshotChannelMap(map, envGlobalChannels());
  log.info('mfs.repl.channels', {
    op: 'ApplyCollectionChannels',
    channelFilterCollections: filteredCollectionCount(liveChannels),
  });
  return startReplicator(session, nextHooks ?? hooks ?? undefined);
}

export async function stopReplicator(): Promise<void> {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  lastStatusLog = '';
  const repl = nativeRepl;
  nativeRepl = null;
  started = false;
  try {
    await repl?.stop?.();
  } catch {
    // already stopped
  }
  if (repl) log.info('mfs.repl.stop', { op: 'StopReplicator' });
}

/** Foreground / keep-alive. Simple schema restarts a continuous replicator; oneshot fires a cycle. */
export async function ensureReplicatorRunning(session: Session | null, nextHooks?: ReplicatorHooks): Promise<void> {
  if (!session || session.strategy === 'demo') return;
  if (fatalTls) return;
  if (replSchema() === 'oneshot') {
    await runOneshot(session, nextHooks ?? hooks ?? undefined, oneshotBootstrapDone ? 'foreground' : 'bootstrap');
    return;
  }
  if (started && activityLevel !== 0) return;
  await startReplicator(session, nextHooks ?? hooks ?? undefined);
}

export function resetReplicatorTestState(): void {
  nativeRepl = null;
  started = false;
  skippedReason = undefined;
  activityLevel = 0;
  lastErrorCode = undefined;
  lastErrorClass = undefined;
  lastPullSuccessAt = undefined;
  lastPushSuccessAt = undefined;
  progressCompleted = undefined;
  progressTotal = undefined;
  authRefreshTried = false;
  fatalTls = false;
  pendingOverride = null;
  hooks = null;
  liveSession = null;
  liveChannels = snapshotChannelMap(null);
  timesHydrated = false;
  liveContinuous = true;
  liveActiveCollections = replicatorCollectionNames(FIELD_COLLECTIONS);
  oneshotPhase = 'idle';
  oneshotBootstrapDone = false;
  oneshotBusy = false;
  lastOneshotAt = undefined;
  oneshotFinishQueued = false;
  startLock = false;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  lastStatusLog = '';
  resetReplDocStats();
}

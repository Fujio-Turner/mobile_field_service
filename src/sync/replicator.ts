import { FIELD_COLLECTIONS, FIELD_SCOPE } from '../db/collections';
import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { log } from '../log/logger';
import { recordMetric } from '../metrics';
import type { StartSession } from '../ops/copyInbound';
import { pendingPushCountLocal } from '../ops/pendingPush';
import type { Session } from '../session/types';
import { acceptSelfSigned, sgReplicatorUrl } from '../session/sgSession';
import { activityName, isAuthFailureCode, isTlsCode, isTransientCode, metricErrorCode, type ActivityName } from './codes';
import { handleReplicatedDoc, parseReplicatedDocs } from './documentListener';
import { FIELD_PUSH_FILTERS, neverPushFilter, replicatorCollectionNames, type PushDoc } from './filters';

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
};

let nativeRepl: NativeReplicator | null = null;
let started = false;
let skippedReason: string | undefined;
let activityLevel = 0;
let lastErrorCode: number | undefined;
let lastPullSuccessAt: number | undefined;
let lastPushSuccessAt: number | undefined;
let progressCompleted: number | undefined;
let progressTotal: number | undefined;
let authRefreshTried = false;
let fatalTls = false;
let pendingOverride: number | null = null;
let hooks: ReplicatorHooks | null = null;
let liveSession: StartSession | null = null;

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
  };
}

async function pendingFromNative(repl: NativeReplicator): Promise<number | null> {
  if (typeof repl.pendingDocumentIdsInCollection !== 'function') return null;
  const db = getOpenedDatabase();
  if (!db) return null;
  try {
    let total = 0;
    for (const name of buildCollectionAllowList()) {
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
  activityLevel = Number.isFinite(level) ? level : 0;
  recordMetric('mfs_replicator_activity', activityLevel);

  const errObj = typeof st.getError === 'function' ? st.getError() : st.error;
  const code =
    errObj == null
      ? undefined
      : typeof errObj.getCode === 'function'
        ? errObj.getCode()
        : errObj.code;
  const progress = typeof st.getProgress === 'function' ? st.getProgress() : st.progress;
  if (progress) {
    progressCompleted = progress.completed;
    progressTotal = progress.total;
  }

  if (activityLevel === 3 || activityLevel === 4) {
    lastErrorCode = undefined;
  }
  if (activityLevel === 3) {
    lastPullSuccessAt = nowSec();
    lastPushSuccessAt = nowSec();
  }

  if (code != null) {
    lastErrorCode = code;
    recordMetric('mfs_replicator_errors_total', 1, { code: metricErrorCode(code) });
  }

  if (activityLevel === 0 && isAuthFailureCode(code)) {
    log.error('mfs.repl.auth_fail', { op: 'OnReplicatorAuthFailure', errCode: code });
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
    log.error('mfs.repl.tls', { op: 'OnReplicatorStatus', errCode: code });
    return;
  }
  if (isTransientCode(code) || activityLevel === 1) {
    log.warn('mfs.repl.offline', { op: 'OnReplicatorStatus', errCode: code });
  }
}

export async function startReplicator(session: Session, nextHooks?: ReplicatorHooks): Promise<{ ok: boolean; reason?: string }> {
  if (nextHooks) hooks = nextHooks;
  liveSession = sessionAsStart(session);
  skippedReason = undefined;

  if (session.strategy === 'demo') {
    skippedReason = 'demo';
    log.info('mfs.repl.skip', { op: 'StartReplicator', err: 'demo' });
    return { ok: false, reason: 'demo' };
  }
  const sgUrl = sgReplicatorUrl();
  if (!sgUrl || !session.sessionId) {
    skippedReason = 'missing_session';
    return { ok: false, reason: 'missing_session' };
  }
  if (!nativeDbAvailable() || !getOpenedDatabase()) {
    skippedReason = 'native_db_unavailable';
    log.warn('mfs.repl.skip', { op: 'StartReplicator', err: 'native_db_unavailable' });
    return { ok: false, reason: 'native_db_unavailable' };
  }

  await stopReplicator();
  fatalTls = false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cbl = require('cbl-reactnative') as {
      URLEndpoint?: new (url: string) => unknown;
      SessionAuthenticator?: new (id: string, cookie?: string) => unknown;
      CollectionConfiguration?: new (col: unknown) => {
        setPushFilter?: (fn: (doc: PushDoc, flags?: unknown) => boolean) => void;
      };
      ReplicatorConfiguration?: new (configs: unknown[], endpoint: unknown) => {
        setAuthenticator?: (a: unknown) => void;
        setContinuous?: (c: boolean) => void;
        setAcceptOnlySelfSignedCerts?: (v: boolean) => void;
        setAcceptOnlySelfSignedServerCertificate?: (v: boolean) => void;
        setReplicatorType?: (t: unknown) => void;
      };
      Replicator?: { create: (config: unknown) => Promise<NativeReplicator> };
      ReplicatorType?: { PUSH_AND_PULL?: unknown };
    };
    const db = getOpenedDatabase()!;
    const names = buildCollectionAllowList();
    const configs: unknown[] = [];
    for (const name of names) {
      const col = await db.collection(name, FIELD_SCOPE);
      if (!col || !cbl.CollectionConfiguration) continue;
      const cc = new cbl.CollectionConfiguration(col);
      const filter = FIELD_PUSH_FILTERS[name] ?? neverPushFilter;
      cc.setPushFilter?.(filter);
      configs.push(cc);
    }
    if (!cbl.URLEndpoint || !cbl.ReplicatorConfiguration || !cbl.Replicator || !cbl.SessionAuthenticator) {
      skippedReason = 'api_missing';
      return { ok: false, reason: 'api_missing' };
    }
    const endpoint = new cbl.URLEndpoint(sgUrl);
    const config = new cbl.ReplicatorConfiguration(configs, endpoint);
    config.setAuthenticator?.(new cbl.SessionAuthenticator(session.sessionId, session.cookieName || 'SyncGatewaySession'));
    config.setContinuous?.(true);
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
      void refreshPendingCount();
    });
    await replicator.start(false);
    started = true;
    authRefreshTried = false;
    activityLevel = 2;
    log.info('mfs.repl.start', { op: 'StartReplicator' });
    void refreshPendingCount();
    return { ok: true };
  } catch (err) {
    log.error('mfs.repl.start_fail', { op: 'StartReplicator', err });
    skippedReason = 'exception';
    return { ok: false, reason: 'exception' };
  }
}

export async function stopReplicator(): Promise<void> {
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

/** Foreground: recreate if iOS killed the replicator or it is STOPPED without fatal TLS. */
export async function ensureReplicatorRunning(session: Session | null, nextHooks?: ReplicatorHooks): Promise<void> {
  if (!session || session.strategy === 'demo') return;
  if (fatalTls) return;
  if (started && activityLevel !== 0) return;
  await startReplicator(session, nextHooks ?? hooks ?? undefined);
}

export function resetReplicatorTestState(): void {
  nativeRepl = null;
  started = false;
  skippedReason = undefined;
  activityLevel = 0;
  lastErrorCode = undefined;
  lastPullSuccessAt = undefined;
  lastPushSuccessAt = undefined;
  progressCompleted = undefined;
  progressTotal = undefined;
  authRefreshTried = false;
  fatalTls = false;
  pendingOverride = null;
  hooks = null;
  liveSession = null;
}

import type { ActivityName } from '../sync/codes';

/** Document events within this window count as “actively sending/downloading”. */
export const RECENT_DOC_SEC = 5;

/** Offline longer than this uses the warn tone (DESIGN stale-sync). */
export const STALE_SYNC_SEC = 15 * 60;

export type SyncStatusTone = 'ok' | 'accent' | 'warn' | 'danger' | 'muted';

export type SyncStatusKind =
  | 'demo'
  | 'connecting'
  | 'downloading'
  | 'sending'
  | 'syncing'
  | 'connected'
  | 'offline';

export type SyncStatusInput = {
  skippedReason?: string;
  started: boolean;
  activity: ActivityName;
  pending: number;
  lastPullSuccessAt?: number;
  lastPushSuccessAt?: number;
  lastPullDocAt?: number;
  lastPushDocAt?: number;
  progressCompleted?: number;
  progressTotal?: number;
  lastErrorCode?: number;
  nowSec: number;
};

export type SyncStatusView = {
  kind: SyncStatusKind;
  tone: SyncStatusTone;
  title: string;
  detail?: string;
  pending: number;
  accessibilityLabel: string;
};

export function lastSyncedAt(pull?: number, push?: number): number | undefined {
  if (pull == null) return push;
  if (push == null) return pull;
  return Math.max(pull, push);
}

export function formatSyncedAgo(epochSec: number | undefined, nowSec: number): string | null {
  if (epochSec == null || !Number.isFinite(epochSec)) return null;
  const delta = Math.max(0, nowSec - epochSec);
  if (delta < 60) return 'just now';
  if (delta < 3600) {
    const m = Math.floor(delta / 60);
    return m === 1 ? '1 min ago' : `${m} min ago`;
  }
  if (delta < 86400) {
    const h = Math.floor(delta / 3600);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  const d = Math.floor(delta / 86400);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

export function formatPending(n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const count = Math.floor(n);
  return count === 1 ? '1 waiting to send' : `${count} waiting to send`;
}

/** Compact elapsed for the Today clock HUD: `12m` / `2h` / `3d`. Omit under a minute. */
export function formatSyncedCompact(epochSec: number | undefined, nowSec: number): string | undefined {
  if (epochSec == null || !Number.isFinite(epochSec)) return undefined;
  const delta = Math.max(0, nowSec - epochSec);
  if (delta < 60) return undefined;
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  return `${Math.floor(delta / 86400)}d`;
}

export type SyncHud = {
  /** Green = in contact with SG. Yellow/red = not. Muted = demo. */
  connected: boolean;
  tone: SyncStatusTone;
  /** Shown only when not connected. */
  agoCompact?: string;
  pending: number;
  accessibilityLabel: string;
};

export function formatSyncHud(input: SyncStatusInput): SyncHud {
  const view = formatSyncStatus(input);
  const pending = view.pending;
  if (view.kind === 'demo') {
    return { connected: false, tone: 'warn', pending, accessibilityLabel: view.accessibilityLabel };
  }
  if (
    view.kind === 'connected' ||
    view.kind === 'downloading' ||
    view.kind === 'sending' ||
    view.kind === 'syncing' ||
    view.kind === 'connecting'
  ) {
    return {
      connected: true,
      tone: 'ok',
      pending,
      accessibilityLabel: view.accessibilityLabel,
    };
  }
  return {
    connected: false,
    tone: view.tone === 'danger' ? 'danger' : 'warn',
    agoCompact: formatSyncedCompact(lastSyncedAt(input.lastPullSuccessAt, input.lastPushSuccessAt), input.nowSec),
    pending,
    accessibilityLabel: view.accessibilityLabel,
  };
}

function joinDetail(parts: Array<string | undefined>): string | undefined {
  const out = parts.filter((p): p is string => Boolean(p));
  return out.length ? out.join(' · ') : undefined;
}

function withLabel(view: Omit<SyncStatusView, 'accessibilityLabel'>): SyncStatusView {
  return {
    ...view,
    accessibilityLabel: view.detail ? `${view.title}. ${view.detail}` : view.title,
  };
}

function recent(at: number | undefined, nowSec: number): boolean {
  return at != null && nowSec - at <= RECENT_DOC_SEC;
}

function progressLabel(completed: number | undefined, total: number | undefined): string | undefined {
  if (total == null || total <= 0) return undefined;
  return `${completed ?? 0} of ${total}`;
}

export function formatSyncStatus(input: SyncStatusInput): SyncStatusView {
  const pending = Math.max(0, Math.floor(input.pending || 0));
  const waiting = formatPending(pending);
  const ago = formatSyncedAgo(lastSyncedAt(input.lastPullSuccessAt, input.lastPushSuccessAt), input.nowSec);
  const lastLine = ago ? `last synced ${ago}` : 'not synced yet';
  const progress = progressLabel(input.progressCompleted, input.progressTotal);

  if (input.skippedReason === 'demo') {
    return withLabel({
      kind: 'demo',
      tone: 'muted',
      title: 'Local only',
      detail: waiting ? `Demo · ${waiting}` : 'Demo — work stays on this device',
      pending,
    });
  }

  if (input.skippedReason === 'missing_session') {
    return withLabel({
      kind: 'offline',
      tone: 'warn',
      title: 'Not connected',
      detail: joinDetail(['sign in to sync', waiting]),
      pending,
    });
  }

  if (input.activity === 'connecting' || (input.started && input.activity === 'stopped' && input.lastErrorCode == null && !ago)) {
    return withLabel({
      kind: 'connecting',
      tone: 'accent',
      title: 'Connecting…',
      detail: waiting,
      pending,
    });
  }

  if (input.activity === 'busy') {
    const pulling = recent(input.lastPullDocAt, input.nowSec);
    const pushing = recent(input.lastPushDocAt, input.nowSec) || pending > 0;
    if (pulling && !pushing) {
      return withLabel({
        kind: 'downloading',
        tone: 'accent',
        title: progress ? `Downloading ${progress}` : 'Downloading…',
        detail: waiting,
        pending,
      });
    }
    if (pushing && !pulling) {
      return withLabel({
        kind: 'sending',
        tone: 'accent',
        title: pending > 0 ? `Sending ${pending}…` : 'Sending…',
        detail: progress ? `Syncing ${progress}` : undefined,
        pending,
      });
    }
    return withLabel({
      kind: 'syncing',
      tone: 'accent',
      title: progress ? `Syncing ${progress}` : 'Syncing…',
      detail: waiting,
      pending,
    });
  }

  if (input.started && input.activity === 'idle') {
    return withLabel({
      kind: 'connected',
      tone: 'ok',
      title: 'Connected',
      detail: waiting,
      pending,
    });
  }

  const stale =
    input.lastErrorCode != null ||
    lastSyncedAt(input.lastPullSuccessAt, input.lastPushSuccessAt) == null ||
    input.nowSec - (lastSyncedAt(input.lastPullSuccessAt, input.lastPushSuccessAt) ?? 0) >= STALE_SYNC_SEC;
  return withLabel({
    kind: 'offline',
    tone: input.lastErrorCode != null ? 'danger' : stale ? 'warn' : 'muted',
    title: 'Not connected',
    detail: joinDetail([lastLine, waiting]),
    pending,
  });
}

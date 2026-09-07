import type { ActivityName } from '../../src/sync/codes';
import {
  STALE_SYNC_SEC,
  formatPending,
  formatSyncHud,
  formatSyncStatus,
  formatSyncedAgo,
  formatSyncedCompact,
  lastSyncedAt,
  type SyncStatusInput,
} from '../../src/ops/syncStatus';

const now = 1_700_000_000;

const base = (over: Partial<SyncStatusInput> = {}): SyncStatusInput => ({
  started: false,
  activity: 'stopped' as ActivityName,
  pending: 0,
  nowSec: now,
  ...over,
});

describe('formatSyncedAgo', () => {
  it('uses minutes and hours', () => {
    expect(formatSyncedAgo(undefined, now)).toBeNull();
    expect(formatSyncedAgo(now - 12, now)).toBe('just now');
    expect(formatSyncedAgo(now - 60, now)).toBe('1 min ago');
    expect(formatSyncedAgo(now - 12 * 60, now)).toBe('12 min ago');
    expect(formatSyncedAgo(now - 3600, now)).toBe('1 hour ago');
    expect(formatSyncedAgo(now - 5 * 3600, now)).toBe('5 hours ago');
    expect(formatSyncedAgo(now - 2 * 86400, now)).toBe('2 days ago');
  });
});

describe('formatPending', () => {
  it('names one vs many', () => {
    expect(formatPending(0)).toBeUndefined();
    expect(formatPending(1)).toBe('1 waiting to send');
    expect(formatPending(4)).toBe('4 waiting to send');
  });
});

describe('lastSyncedAt', () => {
  it('takes the later of pull and push', () => {
    expect(lastSyncedAt(10, 20)).toBe(20);
    expect(lastSyncedAt(undefined, 7)).toBe(7);
    expect(lastSyncedAt(3, undefined)).toBe(3);
  });
});

describe('formatSyncStatus', () => {
  it('demo stays local', () => {
    const v = formatSyncStatus(base({ skippedReason: 'demo', pending: 2 }));
    expect(v.kind).toBe('demo');
    expect(v.title).toBe('Local only');
    expect(v.detail).toContain('2 waiting to send');
  });

  it('idle started is connected', () => {
    const v = formatSyncStatus(base({ started: true, activity: 'idle' }));
    expect(v.kind).toBe('connected');
    expect(v.title).toBe('Connected');
    expect(v.tone).toBe('ok');
  });

  it('connected still names waiting docs', () => {
    const v = formatSyncStatus(base({ started: true, activity: 'idle', pending: 3 }));
    expect(v.detail).toBe('3 waiting to send');
  });

  it('busy with recent pull is downloading', () => {
    const v = formatSyncStatus(
      base({
        started: true,
        activity: 'busy',
        lastPullDocAt: now - 1,
        progressCompleted: 4,
        progressTotal: 20,
      }),
    );
    expect(v.kind).toBe('downloading');
    expect(v.title).toBe('Downloading 4 of 20');
  });

  it('busy with pending is sending', () => {
    const v = formatSyncStatus(base({ started: true, activity: 'busy', pending: 6 }));
    expect(v.kind).toBe('sending');
    expect(v.title).toBe('Sending 6…');
  });

  it('offline names last sync in minutes', () => {
    const v = formatSyncStatus(base({ lastPullSuccessAt: now - 20 * 60 }));
    expect(v.kind).toBe('offline');
    expect(v.title).toBe('Not connected');
    expect(v.detail).toBe('last synced 20 min ago');
    expect(v.tone).toBe('warn');
  });

  it('recent oneshot rest is muted not stale', () => {
    const v = formatSyncStatus(base({ lastPullSuccessAt: now - 120 }));
    expect(v.detail).toBe('last synced 2 min ago');
    expect(v.tone).toBe('muted');
    expect(now - (now - 120) < STALE_SYNC_SEC).toBe(true);
  });

  it('never synced', () => {
    const v = formatSyncStatus(base({}));
    expect(v.detail).toBe('not synced yet');
  });

  it('connecting', () => {
    const v = formatSyncStatus(base({ started: true, activity: 'connecting' }));
    expect(v.kind).toBe('connecting');
    expect(v.title).toBe('Connecting…');
  });
});

describe('formatSyncedCompact', () => {
  it('uses m/h/d and omits under a minute', () => {
    expect(formatSyncedCompact(undefined, now)).toBeUndefined();
    expect(formatSyncedCompact(now - 12, now)).toBeUndefined();
    expect(formatSyncedCompact(now - 12 * 60, now)).toBe('12m');
    expect(formatSyncedCompact(now - 2 * 3600, now)).toBe('2h');
    expect(formatSyncedCompact(now - 3 * 86400, now)).toBe('3d');
  });
});

describe('formatSyncHud', () => {
  it('green when connected, pending count only', () => {
    const v = formatSyncHud(base({ started: true, activity: 'idle', pending: 4 }));
    expect(v.connected).toBe(true);
    expect(v.tone).toBe('ok');
    expect(v.agoCompact).toBeUndefined();
    expect(v.pending).toBe(4);
  });

  it('yellow with hours when not connected', () => {
    const v = formatSyncHud(base({ lastPullSuccessAt: now - 5 * 3600, pending: 2 }));
    expect(v.connected).toBe(false);
    expect(v.tone).toBe('warn');
    expect(v.agoCompact).toBe('5h');
    expect(v.pending).toBe(2);
  });

  it('demo is yellow with no elapsed (not connected)', () => {
    const v = formatSyncHud(base({ skippedReason: 'demo', pending: 1 }));
    expect(v.connected).toBe(false);
    expect(v.tone).toBe('warn');
    expect(v.agoCompact).toBeUndefined();
    expect(v.pending).toBe(1);
  });
});

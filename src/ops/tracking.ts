import { nowSec, stampAuditCreate, stampAuditUpdate, type Audit } from '../audit';
import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { memorySave } from '../db/memoryStore';
import { saveJsonDoc } from '../db/saveJson';
import { haversineM } from '../geo/haversine';
import { deviceLocalDay, trackingDocId } from '../ids';
import { log } from '../log/logger';
import { recordMetric } from '../metrics';
import { appVersion } from '../version';
import { loadChild } from './childStore';
import type { StartSession } from './copyInbound';

export const TRACK_POINT_CAP = 4000;

/** Keep each per-day crumb doc for 30 calendar days after its `day`. */
export const TRACKING_TTL_DAYS = 30;

export type TrackPointResult = 'recorded' | 'skipped' | 'capped';

const totals = { recorded: 0, skipped: 0, capped: 0 };

export function trackPointTotals(): typeof totals {
  return { ...totals };
}

type TrackSkipCache = {
  id: string;
  last?: [number, number, number];
  capped: boolean;
};

let skipCache: TrackSkipCache | null = null;

export function resetTrackPointTotals(): void {
  totals.recorded = 0;
  totals.skipped = 0;
  totals.capped = 0;
  skipCache = null;
}

function trackingPointCount(doc: Record<string, unknown>): number {
  const n = Number(doc.pointCount);
  if (Number.isFinite(n) && n >= 0) return n;
  const map = doc.tracking as Record<string, TrackPoint> | undefined;
  return map ? Object.keys(map).length : 0;
}

/** Log payload for a crumb write — never include the tracking map. */
export function trackPointLogFields(docId: string, ts: number): Record<string, unknown> {
  return { event: 'mfs.track.point', docId, ts };
}

export function trackMinMoveM(): number {
  const raw = process.env.EXPO_PUBLIC_TRACK_MIN_MOVE_M;
  const n = raw != null && raw !== '' ? Number(raw) : 100;
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export function lastNLocalDays(n: number, from = new Date()): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
    days.push(deviceLocalDay(d));
  }
  return days;
}

export type TrackPoint = [number, number]; // [lat, lon] — ts is the map key

export type TrackingDoc = {
  type: 'tracking';
  employeeId: string;
  email?: string;
  day: string;
  thresholdM: number;
  last?: [number, number, number];
  capped: boolean;
  tracking: Record<string, TrackPoint>;
  pointCount?: number;
  /** Unix seconds. Local midnight of `day` + 30 calendar days. */
  expiresAt: number;
  audit: unknown;
};

/**
 * Expire at local midnight of `day` plus 30 calendar days
 * (Jan 15 → Feb 14 00:00 local — 30 days on the calendar including `day`).
 */
export function trackingExpiryDate(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error('tracking day must be YYYY-MM-DD');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + TRACKING_TTL_DAYS);
}

export function trackingExpiresAtSec(day: string): number {
  return Math.floor(trackingExpiryDate(day).getTime() / 1000);
}

export function trackingIsExpired(doc: Record<string, unknown>, now = nowSec()): boolean {
  const stamped = Number(doc.expiresAt ?? 0);
  if (stamped > 0) return stamped <= now;
  const day = String(doc.day ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return trackingExpiresAtSec(day) <= now;
  return false;
}

export function buildEmptyTracking(input: {
  day: string;
  employeeId: string;
  email?: string;
  thresholdM: number;
  session: StartSession;
  ver: string;
  dt: number;
}): Record<string, unknown> {
  return stampAuditCreate(
    {
      type: 'tracking',
      employeeId: input.employeeId,
      email: input.email,
      day: input.day,
      thresholdM: input.thresholdM,
      capped: false,
      tracking: {},
      pointCount: 0,
      expiresAt: trackingExpiresAtSec(input.day),
    },
    { by: input.session.username, ver: input.ver, dt: input.dt },
  );
}

async function saveTrackingDoc(id: string, body: Record<string, unknown>, day: string): Promise<void> {
  const next = { ...body, expiresAt: trackingExpiresAtSec(day) };
  delete (next as { history?: unknown }).history;
  if (nativeDbAvailable() && getOpenedDatabase()) {
    const col = (await collectionOf('tracking')) as {
      save: (doc: unknown) => Promise<void>;
      setDocumentExpiration?: (docId: string, date: Date) => Promise<void>;
    } | null;
    if (!col) throw new Error('missing');
    await saveJsonDoc(col, id, next);
    if (typeof col.setDocumentExpiration === 'function') {
      await col.setDocumentExpiration(id, trackingExpiryDate(day));
    }
    return;
  }
  memorySave('tracking', id, next);
}

/**
 * Append when haversine ≥ threshold. Map keyed by unix seconds → [lat, lon].
 * last = [lat, lon, ts]. Cap 4000 → capped true.
 */
export function applyTrackPoint(
  doc: Record<string, unknown>,
  fix: { lat: number; lon: number; ts: number; accuracyM?: number },
  thresholdM: number,
): { next: Record<string, unknown>; wrote: boolean; reason?: string } {
  if (doc.capped === true) {
    return { next: doc, wrote: false, reason: 'capped' };
  }
  if (fix.accuracyM != null && fix.accuracyM > thresholdM) {
    return { next: doc, wrote: false, reason: 'accuracy' };
  }
  const last = doc.last as [number, number, number] | undefined;
  if (last && fix.ts !== last[2]) {
    const dist = haversineM({ lat: last[0], lon: last[1] }, { lat: fix.lat, lon: fix.lon });
    if (dist < thresholdM) {
      return { next: doc, wrote: false, reason: 'below_threshold' };
    }
  }
  const existing = (doc.tracking as Record<string, TrackPoint> | undefined) ?? {};
  const key = String(fix.ts);
  const isNew = existing[key] == null;
  const count = trackingPointCount(doc);
  if (isNew && count >= TRACK_POINT_CAP) {
    return { next: { ...doc, capped: true }, wrote: false, reason: 'capped' };
  }
  existing[key] = [fix.lat, fix.lon];
  const pointCount = isNew ? count + 1 : count;
  return {
    next: {
      ...doc,
      tracking: existing,
      pointCount,
      last: [fix.lat, fix.lon, fix.ts] as [number, number, number],
      capped: pointCount >= TRACK_POINT_CAP,
    },
    wrote: true,
  };
}

export async function recordTrackPoint(
  session: StartSession,
  fix: { lat: number; lon: number; ts?: number; accuracyM?: number; day?: string },
): Promise<{ id: string; wrote: boolean; reason?: string; result: TrackPointResult }> {
  const day = fix.day ?? deviceLocalDay();
  const id = trackingDocId(day, session.employeeId);
  const thresholdM = trackMinMoveM();
  const ver = appVersion();
  const dt = nowSec();
  const ts = fix.ts ?? dt;
  if (skipCache?.id === id) {
    if (skipCache.capped) {
      totals.capped += 1;
      recordMetric('mfs_track_point_total', 1, { result: 'capped' });
      return { id, wrote: false, reason: 'capped', result: 'capped' };
    }
    const last = skipCache.last;
    if (last && ts !== last[2]) {
      if (fix.accuracyM != null && fix.accuracyM > thresholdM) {
        totals.skipped += 1;
        recordMetric('mfs_track_point_total', 1, { result: 'skipped' });
        return { id, wrote: false, reason: 'accuracy', result: 'skipped' };
      }
      const dist = haversineM({ lat: last[0], lon: last[1] }, { lat: fix.lat, lon: fix.lon });
      if (dist < thresholdM) {
        totals.skipped += 1;
        recordMetric('mfs_track_point_total', 1, { result: 'skipped' });
        return { id, wrote: false, reason: 'below_threshold', result: 'skipped' };
      }
    }
  }
  let raw = await loadChild('tracking', id);
  if (!raw || trackingIsExpired(raw, dt)) {
    raw = buildEmptyTracking({
      day,
      employeeId: session.employeeId,
      email: session.email,
      thresholdM,
      session,
      ver,
      dt,
    });
  }
  const { next, wrote, reason } = applyTrackPoint(raw, { ...fix, ts }, thresholdM);
  if (!wrote) {
    const result: TrackPointResult = reason === 'capped' ? 'capped' : 'skipped';
    if (reason === 'capped') totals.capped += 1;
    else totals.skipped += 1;
    recordMetric('mfs_track_point_total', 1, { result });
    skipCache = {
      id,
      last: (next.last as [number, number, number] | undefined) ?? skipCache?.last,
      capped: reason === 'capped' || next.capped === true,
    };
    if (reason === 'capped') {
      log.warn('mfs.track.point', { op: 'RecordTrackPoint', docId: id, ts, result });
    }
    return { id, wrote, reason, result };
  }
  delete (next as { history?: unknown }).history;
  const saved = stampAuditUpdate(next as { audit: Audit }, {
    by: session.username,
    ver,
    dt,
  }) as Record<string, unknown>;
  delete (saved as { history?: unknown }).history;
  await saveTrackingDoc(id, saved, day);
  skipCache = {
    id,
    last: saved.last as [number, number, number] | undefined,
    capped: saved.capped === true,
  };
  totals.recorded += 1;
  recordMetric('mfs_track_point_total', 1, { result: 'recorded' });
  log.info('mfs.track.point', { op: 'RecordTrackPoint', docId: id, ts });
  return { id, wrote: true, result: 'recorded' };
}

async function loadLiveTracking(id: string): Promise<Record<string, unknown> | null> {
  const doc = await loadChild('tracking', id);
  if (!doc || trackingIsExpired(doc)) return null;
  return doc;
}

export async function getTrackingDay(employeeId: string, day: string): Promise<Record<string, unknown> | null> {
  return loadLiveTracking(trackingDocId(day, employeeId));
}

export async function getTrackingLastNDays(
  employeeId: string,
  n = 7,
): Promise<Array<{ id: string; day: string; doc: Record<string, unknown> | null }>> {
  const days = lastNLocalDays(n);
  const out: Array<{ id: string; day: string; doc: Record<string, unknown> | null }> = [];
  for (const day of days) {
    const id = trackingDocId(day, employeeId);
    out.push({ id, day, doc: await loadLiveTracking(id) });
  }
  return out;
}

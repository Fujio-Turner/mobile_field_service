import { nowSec, stampAuditCreate, stampAuditUpdate } from '../audit';
import { haversineM } from '../geo/haversine';
import { deviceLocalDay, trackingDocId } from '../ids';
import { log } from '../log/logger';
import { recordMetric } from '../metrics';
import { appVersion } from '../version';
import { loadChild, saveChild } from './childStore';
import type { StartSession } from './copyInbound';

export const TRACK_POINT_CAP = 4000;

export type TrackPointResult = 'recorded' | 'skipped' | 'capped';

const totals = { recorded: 0, skipped: 0, capped: 0 };

export function trackPointTotals(): typeof totals {
  return { ...totals };
}

export function resetTrackPointTotals(): void {
  totals.recorded = 0;
  totals.skipped = 0;
  totals.capped = 0;
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
  audit: unknown;
};

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
    },
    { by: input.session.username, ver: input.ver, dt: input.dt },
  );
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
  if (Object.keys(existing).length >= TRACK_POINT_CAP) {
    return { next: { ...doc, capped: true }, wrote: false, reason: 'capped' };
  }
  const map = { ...existing, [String(fix.ts)]: [fix.lat, fix.lon] as TrackPoint };
  const pointCount = Object.keys(map).length;
  return {
    next: {
      ...doc,
      tracking: map,
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
  let raw = await loadChild('tracking', id);
  if (!raw) {
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
    if (reason === 'capped') {
      log.warn('mfs.track.point', { op: 'RecordTrackPoint', docId: id, ts, result });
    }
    return { id, wrote, reason, result };
  }
  delete (next as { history?: unknown }).history;
  const saved = stampAuditUpdate(next as never, { by: session.username, ver, dt });
  delete (saved as { history?: unknown }).history;
  await saveChild('tracking', id, saved as Record<string, unknown>);
  totals.recorded += 1;
  recordMetric('mfs_track_point_total', 1, { result: 'recorded' });
  log.info('mfs.track.point', { op: 'RecordTrackPoint', docId: id, ts });
  return { id, wrote: true, result: 'recorded' };
}

export async function getTrackingDay(employeeId: string, day: string): Promise<Record<string, unknown> | null> {
  return loadChild('tracking', trackingDocId(day, employeeId));
}

export async function getTrackingLastNDays(
  employeeId: string,
  n = 7,
): Promise<Array<{ id: string; day: string; doc: Record<string, unknown> | null }>> {
  const days = lastNLocalDays(n);
  const out: Array<{ id: string; day: string; doc: Record<string, unknown> | null }> = [];
  for (const day of days) {
    const id = trackingDocId(day, employeeId);
    out.push({ id, day, doc: await loadChild('tracking', id) });
  }
  return out;
}

import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { trackingDocId } from '../../src/ids';
import {
  applyTrackPoint,
  getTrackingDay,
  getTrackingLastNDays,
  lastNLocalDays,
  recordTrackPoint,
  resetTrackPointTotals,
  TRACK_POINT_CAP,
  TRACKING_TTL_DAYS,
  trackingExpiryDate,
  trackingExpiresAtSec,
  trackingIsExpired,
  trackPointLogFields,
} from '../../src/ops/tracking';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  resetTrackPointTotals();
  process.env.EXPO_PUBLIC_TRACK_MIN_MOVE_M = '100';
});

describe('tracking id + days', () => {
  it('builds track:{day}:{employeeId}', () => {
    expect(trackingDocId('2026-09-05', 'E-4412')).toBe('track:2026-09-05:E-4412');
    expect(trackingDocId('2026-09-05', 'E-4412')).not.toContain('@');
    expect(lastNLocalDays(7, new Date(2026, 8, 5, 12)).length).toBe(7);
    expect(lastNLocalDays(7, new Date(2026, 8, 5, 12))[0]).toBe('2026-09-05');
  });
});

describe('recordTrackPoint', () => {
  it('writes when move ≥ threshold; values are [lat,lon] only', async () => {
    const day = lastNLocalDays(1)[0];
    const a = await recordTrackPoint(session, {
      lat: 41.7658,
      lon: -72.6734,
      ts: 1_700_000_000,
      day,
    });
    expect(a.wrote).toBe(true);
    const id = trackingDocId(day, 'E-4412');
    const doc = memoryGet('tracking', id)!;
    const point = (doc.tracking as Record<string, number[]>)['1700000000'];
    expect(point).toEqual([41.7658, -72.6734]);
    expect(point).toHaveLength(2);
    expect((doc.last as number[])[2]).toBe(1_700_000_000);

    const near = await recordTrackPoint(session, {
      lat: 41.7659,
      lon: -72.6734,
      ts: 1_700_000_100,
      day,
    });
    expect(near.wrote).toBe(false);

    const far = await recordTrackPoint(session, {
      lat: 41.7675,
      lon: -72.67,
      ts: 1_700_000_200,
      day,
    });
    expect(far.wrote).toBe(true);

    const week = await getTrackingLastNDays('E-4412', 7);
    expect(week).toHaveLength(7);
    expect(week.every((d) => d.id === trackingDocId(d.day, 'E-4412'))).toBe(true);
    expect(week.some((d) => d.id === id && d.doc != null)).toBe(true);
    expect(doc.expiresAt).toBe(trackingExpiresAtSec(day));
    expect(doc.history).toBeUndefined();
    const log = trackPointLogFields(id, 1_700_000_000);
    expect(log).toEqual({ event: 'mfs.track.point', docId: id, ts: 1_700_000_000 });
    expect(JSON.stringify(log)).not.toMatch(/41\.7658/);
  });

  it('skips poor accuracy and overwrites the same unix second', async () => {
    const day = lastNLocalDays(1)[0];
    await recordTrackPoint(session, { lat: 41.7658, lon: -72.6734, ts: 50, day });
    const bad = await recordTrackPoint(session, {
      lat: 41.9,
      lon: -72.9,
      ts: 51,
      accuracyM: 500,
      day,
    });
    expect(bad.wrote).toBe(false);
    expect(bad.result).toBe('skipped');
    const sameTs = await recordTrackPoint(session, {
      lat: 41.766,
      lon: -72.673,
      ts: 50,
      day,
    });
    expect(sameTs.wrote).toBe(true);
    const point = (memoryGet('tracking', trackingDocId(day, 'E-4412'))!.tracking as Record<string, number[]>)['50'];
    expect(point).toEqual([41.766, -72.673]);
  });

  it('honors pointCount without walking the map', () => {
    const { wrote, reason } = applyTrackPoint(
      { type: 'tracking', capped: false, tracking: {}, pointCount: TRACK_POINT_CAP, last: [1, 2, 0] },
      { lat: 10, lon: 20, ts: 1 },
      100,
    );
    expect(wrote).toBe(false);
    expect(reason).toBe('capped');
  });

  it('caps at 4000 points', () => {
    const tracking: Record<string, [number, number]> = {};
    for (let i = 0; i < TRACK_POINT_CAP - 1; i++) tracking[String(i)] = [1, 2];
    const doc = {
      type: 'tracking',
      capped: false,
      tracking,
      last: [1, 2, TRACK_POINT_CAP - 2] as [number, number, number],
    };
    const { next, wrote } = applyTrackPoint(doc, { lat: 10, lon: 20, ts: 99999 }, 100);
    expect(wrote).toBe(true);
    expect(next.capped).toBe(true);
    const blocked = applyTrackPoint(next, { lat: 11, lon: 21, ts: 100000 }, 100);
    expect(blocked.wrote).toBe(false);
    expect(blocked.reason).toBe('capped');
  });
});

describe('tracking TTL', () => {
  it('is 30 calendar days after the tracking day', () => {
    expect(TRACKING_TTL_DAYS).toBe(30);
    const exp = trackingExpiryDate('2026-01-15');
    expect(exp.getFullYear()).toBe(2026);
    expect(exp.getMonth()).toBe(1);
    expect(exp.getDate()).toBe(14);
    expect(trackingExpiresAtSec('2026-01-15')).toBe(Math.floor(exp.getTime() / 1000));
  });

  it('hides expired day docs from GetTrackingDay', async () => {
    const id = trackingDocId('2026-09-05', 'E-4412');
    memorySave('tracking', id, {
      type: 'tracking',
      employeeId: 'E-4412',
      day: '2026-09-05',
      capped: false,
      tracking: { '1': [41.76, -72.67] },
      expiresAt: 1,
    });
    expect(trackingIsExpired(memoryGet('tracking', id)!, 2)).toBe(true);
    expect(await getTrackingDay('E-4412', '2026-09-05')).toBeNull();
  });

  it('uses day when expiresAt is missing (pre-TTL docs)', () => {
    expect(trackingIsExpired({ type: 'tracking', day: '2020-01-01' })).toBe(true);
    expect(trackingIsExpired({ type: 'tracking', day: lastNLocalDays(1)[0] })).toBe(false);
  });
});

import { memoryGet, memoryReset } from '../../src/db/memoryStore';
import { trackingDocId } from '../../src/ids';
import {
  applyTrackPoint,
  getTrackingLastNDays,
  lastNLocalDays,
  recordTrackPoint,
  resetTrackPointTotals,
  TRACK_POINT_CAP,
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
    const a = await recordTrackPoint(session, {
      lat: 41.7658,
      lon: -72.6734,
      ts: 1_700_000_000,
      day: '2026-09-05',
    });
    expect(a.wrote).toBe(true);
    const id = trackingDocId('2026-09-05', 'E-4412');
    const doc = memoryGet('tracking', id)!;
    const point = (doc.tracking as Record<string, number[]>)['1700000000'];
    expect(point).toEqual([41.7658, -72.6734]);
    expect(point).toHaveLength(2);
    expect((doc.last as number[])[2]).toBe(1_700_000_000);

    const near = await recordTrackPoint(session, {
      lat: 41.7659,
      lon: -72.6734,
      ts: 1_700_000_100,
      day: '2026-09-05',
    });
    expect(near.wrote).toBe(false);

    const far = await recordTrackPoint(session, {
      lat: 41.7675,
      lon: -72.67,
      ts: 1_700_000_200,
      day: '2026-09-05',
    });
    expect(far.wrote).toBe(true);

    const week = await getTrackingLastNDays('E-4412', 7);
    expect(week).toHaveLength(7);
    expect(week.every((d) => d.id === trackingDocId(d.day, 'E-4412'))).toBe(true);
    expect(week.some((d) => d.id === id && d.doc != null)).toBe(true);
    expect(doc.history).toBeUndefined();
    const log = trackPointLogFields(id, 1_700_000_000);
    expect(log).toEqual({ event: 'mfs.track.point', docId: id, ts: 1_700_000_000 });
    expect(JSON.stringify(log)).not.toMatch(/41\.7658/);
  });

  it('skips poor accuracy and overwrites the same unix second', async () => {
    await recordTrackPoint(session, { lat: 41.7658, lon: -72.6734, ts: 50, day: '2026-09-05' });
    const bad = await recordTrackPoint(session, {
      lat: 41.9,
      lon: -72.9,
      ts: 51,
      accuracyM: 500,
      day: '2026-09-05',
    });
    expect(bad.wrote).toBe(false);
    expect(bad.result).toBe('skipped');
    const sameTs = await recordTrackPoint(session, {
      lat: 41.766,
      lon: -72.673,
      ts: 50,
      day: '2026-09-05',
    });
    expect(sameTs.wrote).toBe(true);
    const point = (memoryGet('tracking', trackingDocId('2026-09-05', 'E-4412'))!.tracking as Record<string, number[]>)[
      '50'
    ];
    expect(point).toEqual([41.766, -72.673]);
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

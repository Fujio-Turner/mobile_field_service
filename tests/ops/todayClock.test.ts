import {
  clockLabel,
  endOfLocalDaySec,
  formatHms,
  pickClockTarget,
  remainingSec,
} from '../../src/ops/todayClock';
import type { TodayRow } from '../../src/ops/todayTypes';

const row = (over: Partial<TodayRow> & Pick<TodayRow, 'key' | 'sourceId' | 'openId'>): TodayRow => ({
  number: 'WO-1',
  priority: 'normal',
  status: 'assigned',
  summary: 'job',
  siteName: 'Site',
  startDt: 100,
  openCollection: 'workordersin',
  badge: 'none',
  ...over,
});

describe('formatHms', () => {
  it('pads minutes and seconds under an hour', () => {
    expect(formatHms(0)).toBe('00:00');
    expect(formatHms(5)).toBe('00:05');
    expect(formatHms(65)).toBe('01:05');
  });

  it('includes hours when needed and floors negatives', () => {
    expect(formatHms(3661)).toBe('1:01:01');
    expect(formatHms(-9)).toBe('00:00');
  });
});

describe('pickClockTarget', () => {
  const now = 1_700_000_000;
  const dayEnd = now + 8 * 3600;

  it('counts down to the next start', () => {
    const target = pickClockTarget(
      [
        row({ key: 'a', sourceId: 'a', openId: 'a', number: 'WO-late', startDt: now - 10 }),
        row({ key: 'b', sourceId: 'b', openId: 'b', number: 'WO-next', siteName: 'Pump', startDt: now + 90 }),
      ],
      now,
      dayEnd,
    );
    expect(target).toMatchObject({ kind: 'starts', at: now + 90, number: 'WO-next', siteName: 'Pump' });
    expect(remainingSec(target, now)).toBe(90);
    expect(clockLabel(target.kind)).toBe('Starts in');
  });

  it('counts down to in-progress end when nothing is upcoming', () => {
    const target = pickClockTarget(
      [
        row({
          key: 'a',
          sourceId: 'a',
          openId: 'a',
          badge: 'started',
          status: 'in_progress',
          startDt: now - 100,
          endDt: now + 40,
          number: 'WO-open',
        }),
      ],
      now,
      dayEnd,
    );
    expect(target.kind).toBe('ends');
    expect(target.at).toBe(now + 40);
    expect(remainingSec(target, now)).toBe(40);
  });

  it('ticks late-by for a not-started job already due', () => {
    const target = pickClockTarget(
      [row({ key: 'a', sourceId: 'a', openId: 'a', startDt: now - 15, badge: 'none' })],
      now,
      dayEnd,
    );
    expect(target.kind).toBe('overdue');
    expect(remainingSec(target, now)).toBe(15);
    expect(clockLabel('overdue')).toBe('Late by');
  });

  it('falls back to end of local day', () => {
    const target = pickClockTarget([], now, dayEnd);
    expect(target).toEqual({ kind: 'day', at: dayEnd });
    expect(endOfLocalDaySec(new Date(2026, 8, 5, 14, 0, 0))).toBe(
      Math.floor(new Date(2026, 8, 6).getTime() / 1000),
    );
  });
});

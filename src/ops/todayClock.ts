import type { TodayRow } from './todayTypes';

export type ClockTargetKind = 'starts' | 'ends' | 'overdue' | 'day';

export type ClockTarget = {
  kind: ClockTargetKind;
  at: number;
  number?: string;
  siteName?: string;
};

export function endOfLocalDaySec(from = new Date()): number {
  return Math.floor(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1).getTime() / 1000);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** H:MM:SS when ≥ 1h, else MM:SS. Never negative. */
export function formatHms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${pad2(m)}:${pad2(sec)}`;
}

export function formatClockTime(now: Date): string {
  return now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatClockDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function remainingSec(target: ClockTarget, nowSec: number): number {
  if (target.kind === 'overdue') return Math.max(0, nowSec - target.at);
  return Math.max(0, target.at - nowSec);
}

export function clockLabel(kind: ClockTargetKind): string {
  if (kind === 'starts') return 'Starts in';
  if (kind === 'ends') return 'Ends in';
  if (kind === 'overdue') return 'Late by';
  return 'Day ends in';
}

/**
 * Next window for the Today header: upcoming start, then in-progress end,
 * then earliest not-started that is already due, else local midnight.
 */
export function pickClockTarget(rows: TodayRow[], nowSec: number, dayEndSec: number): ClockTarget {
  const upcoming = rows
    .filter((r) => r.startDt > nowSec)
    .sort((a, b) => a.startDt - b.startDt || a.number.localeCompare(b.number));
  if (upcoming[0]) {
    return {
      kind: 'starts',
      at: upcoming[0].startDt,
      number: upcoming[0].number,
      siteName: upcoming[0].siteName,
    };
  }

  const active = rows.filter(
    (r) => r.badge === 'started' || r.badge === 'amendment' || r.status === 'in_progress',
  );
  const ending = active
    .filter((r) => r.endDt != null && r.endDt > nowSec)
    .sort((a, b) => (a.endDt ?? 0) - (b.endDt ?? 0));
  if (ending[0]) {
    return {
      kind: 'ends',
      at: ending[0].endDt as number,
      number: ending[0].number,
      siteName: ending[0].siteName,
    };
  }

  const overdue = rows
    .filter((r) => r.startDt > 0 && r.startDt <= nowSec && r.badge === 'none')
    .sort((a, b) => a.startDt - b.startDt || a.number.localeCompare(b.number));
  if (overdue[0]) {
    return {
      kind: 'overdue',
      at: overdue[0].startDt,
      number: overdue[0].number,
      siteName: overdue[0].siteName,
    };
  }

  return { kind: 'day', at: dayEndSec };
}

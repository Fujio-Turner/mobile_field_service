import { deviceLocalDay } from '../ids';
import type { InboundHit, OutboundHit, OutboundRef, TodayRow } from './todayTypes';

/** Prefer `scheduled.day`; fall back to the device-local date of `startDt`. */
export function outboundScheduledDay(hit: Pick<OutboundHit, 'day' | 'startDt'>): string {
  if (hit.day && /^\d{4}-\d{2}-\d{2}$/.test(hit.day)) return hit.day;
  if (hit.startDt > 0) return deviceLocalDay(new Date(hit.startDt * 1000));
  return '';
}

function inboundRow(hit: InboundHit, open: { openId: string; openCollection: TodayRow['openCollection']; badge: TodayRow['badge'] }): TodayRow {
  return {
    key: hit.id,
    sourceId: hit.id,
    number: hit.number,
    kind: hit.kind,
    priority: hit.priority,
    status: hit.status,
    summary: hit.summary,
    siteName: hit.siteName,
    startDt: hit.startDt,
    endDt: hit.endDt,
    openId: open.openId,
    openCollection: open.openCollection,
    badge: open.badge,
  };
}

function outboundRow(hit: OutboundHit, badge: TodayRow['badge']): TodayRow {
  return {
    key: hit.id,
    sourceId: hit.sourceId || hit.id,
    number: hit.number,
    kind: hit.kind,
    priority: hit.priority,
    status: hit.status,
    summary: hit.summary,
    siteName: hit.siteName,
    startDt: hit.startDt,
    endDt: hit.endDt,
    openId: hit.id,
    openCollection: 'workordersout',
    badge,
    role: hit.role,
  };
}

/**
 * Page 0: UNION active outbound + inbound today, one row per source.id, prefer outbound.
 * Pages 1+: inbound only, skip sources already shown on page 0.
 */
export function collapseTodayPage(input: {
  employeeId: string;
  /** Device-local day for Today (`YYYY-MM-DD`). Reassigned leftovers from other days are omitted. */
  day: string;
  inbound: InboundHit[];
  activeOutbound: OutboundHit[];
  outboundBySource: Map<string, OutboundRef>;
  skipSourceIds?: Set<string>;
  includeActiveOutbound: boolean;
}): TodayRow[] {
  const skip = input.skipSourceIds ?? new Set<string>();
  const inboundById = new Map(input.inbound.map((h) => [h.id, h]));
  const used = new Set<string>(skip);
  const rows: TodayRow[] = [];

  if (input.includeActiveOutbound) {
    for (const out of input.activeOutbound) {
      if (out.dropped) continue;
      const sourceId = out.sourceId || out.id;
      const inboundHit = inboundById.get(sourceId);
      let badge: TodayRow['badge'] = 'started';
      if (out.role === 'amendment') badge = 'amendment';
      else if (!inboundHit || inboundHit.assignedEmployeeId !== input.employeeId) {
        badge = 'reassigned';
      }
      if (badge === 'reassigned' && outboundScheduledDay(out) !== input.day) continue;
      rows.push(outboundRow(out, badge));
      used.add(sourceId);
    }
  }

  for (const inn of input.inbound) {
    if (used.has(inn.id)) continue;
    const ref = input.outboundBySource.get(inn.id);
    if (ref) {
      const terminal = ref.status === 'complete' || ref.status === 'cancelled';
      rows.push(
        inboundRow(inn, {
          openId: ref.id,
          openCollection: 'workordersout',
          badge: terminal ? 'done' : ref.role === 'amendment' ? 'amendment' : 'started',
        }),
      );
    } else {
      rows.push(
        inboundRow(inn, {
          openId: inn.id,
          openCollection: 'workordersin',
          badge: 'none',
        }),
      );
    }
    used.add(inn.id);
  }

  rows.sort((a, b) => b.startDt - a.startDt || a.number.localeCompare(b.number));
  return rows;
}

export function sourceIdsFromRows(rows: TodayRow[]): Set<string> {
  return new Set(rows.map((r) => r.sourceId));
}

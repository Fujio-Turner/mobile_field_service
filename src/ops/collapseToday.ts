import type { InboundHit, OutboundHit, OutboundRef, TodayRow } from './todayTypes';

function inboundRow(hit: InboundHit, open: { openId: string; openCollection: TodayRow['openCollection']; badge: TodayRow['badge'] }): TodayRow {
  return {
    key: hit.id,
    sourceId: hit.id,
    number: hit.number,
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
      const sourceId = out.sourceId || out.id;
      const inboundHit = inboundById.get(sourceId);
      let badge: TodayRow['badge'] = 'started';
      if (out.role === 'amendment') badge = 'amendment';
      else if (!inboundHit || inboundHit.assignedEmployeeId !== input.employeeId) {
        badge = 'reassigned';
      }
      rows.push(outboundRow(out, badge));
      used.add(sourceId);
    }
  }

  for (const inn of input.inbound) {
    if (used.has(inn.id)) continue;
    const ref = input.outboundBySource.get(inn.id);
    if (ref) {
      rows.push(
        inboundRow(inn, {
          openId: ref.id,
          openCollection: 'workordersout',
          badge: ref.role === 'amendment' ? 'amendment' : 'started',
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

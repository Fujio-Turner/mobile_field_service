import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { runQuery } from '../db/query';
import { deviceLocalDay } from '../ids';
import { collapseTodayPage, sourceIdsFromRows } from './collapseToday';
import { findOutboundForSources } from './findOutboundForSources';
import { seedInboundAsHits } from './todaySeedFallback';
import { ACTIVE_OUTBOUND_SQL, INBOUND_TODAY_SQL } from './todaySql';
import {
  TODAY_PAGE_SIZE,
  type InboundHit,
  type OutboundHit,
  type TodayRow,
} from './todayTypes';

export function parseInboundHits(rows: Record<string, unknown>[]): InboundHit[] {
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    number: String(r.number ?? ''),
    priority: String(r.priority ?? 'normal'),
    status: String(r.status ?? ''),
    summary: String(r.summary ?? ''),
    siteName: String(r.siteName ?? ''),
    startDt: Number(r.startDt ?? 0),
    endDt: r.endDt == null ? undefined : Number(r.endDt),
    assignedEmployeeId: String(r.assignedEmployeeId ?? ''),
  }));
}

export function parseOutboundHits(rows: Record<string, unknown>[]): OutboundHit[] {
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    sourceId: String(r.sourceId ?? ''),
    number: String(r.number ?? ''),
    priority: String(r.priority ?? 'normal'),
    status: String(r.status ?? ''),
    summary: String(r.summary ?? ''),
    siteName: String(r.siteName ?? ''),
    startDt: Number(r.startDt ?? 0),
    endDt: r.endDt == null ? undefined : Number(r.endDt),
    role: String(r.role ?? 'primary'),
    assignedEmployeeId: String(r.assignedEmployeeId ?? ''),
  }));
}

export type ListTodayInput = {
  employeeId: string;
  day?: string;
  limit?: number;
  offset?: number;
  /** Source ids already shown on page 0 (outbound). Pages 1+ skip these. */
  skipSourceIds?: Set<string>;
};

export type ListTodayResult = {
  rows: TodayRow[];
  preview: boolean;
  inboundCount: number;
};

export async function listTodayWork(input: ListTodayInput): Promise<ListTodayResult> {
  const day = input.day ?? deviceLocalDay();
  const limit = input.limit ?? TODAY_PAGE_SIZE;
  const offset = input.offset ?? 0;
  const includeActiveOutbound = offset === 0;

  if (!nativeDbAvailable() || !getOpenedDatabase()) {
    const inbound = seedInboundAsHits(input.employeeId, day);
    const sliced = inbound.slice(offset, offset + limit);
    return {
      preview: true,
      inboundCount: sliced.length,
      rows: collapseTodayPage({
        employeeId: input.employeeId,
        inbound: sliced,
        activeOutbound: [],
        outboundBySource: new Map(),
        skipSourceIds: input.skipSourceIds,
        includeActiveOutbound: false,
      }),
    };
  }

  const db = getOpenedDatabase();
  if (!db) return { preview: false, rows: [], inboundCount: 0 };

  const inboundRows = await runQuery(db, INBOUND_TODAY_SQL, {
    employeeId: input.employeeId,
    day,
    limit,
    offset,
  });
  const inbound = parseInboundHits(inboundRows);

  let activeOutbound: OutboundHit[] = [];
  if (includeActiveOutbound) {
    const outRows = await runQuery(db, ACTIVE_OUTBOUND_SQL, { employeeId: input.employeeId });
    activeOutbound = parseOutboundHits(outRows);
  }

  const outboundBySource = await findOutboundForSources(
    input.employeeId,
    inbound.map((h) => h.id),
  );

  return {
    preview: false,
    inboundCount: inbound.length,
    rows: collapseTodayPage({
      employeeId: input.employeeId,
      inbound,
      activeOutbound,
      outboundBySource,
      skipSourceIds: input.skipSourceIds,
      includeActiveOutbound,
    }),
  };
}

export { sourceIdsFromRows, TODAY_PAGE_SIZE };

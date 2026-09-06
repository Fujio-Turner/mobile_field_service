import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { timeQuery } from '../metrics';
import { runQuery } from '../db/query';
import { deviceLocalDay } from '../ids';
import { collapseTodayPage, sourceIdsFromRows } from './collapseToday';
import { findOutboundForSources, sourceIdsNeedingOutboundLookup } from './findOutboundForSources';
import { memoryActiveOutbound, memoryInboundHits, memoryOutboundRefs } from './memoryToday';
import { seedActiveOutboundAsHits, seedInboundAsHits } from './todaySeedFallback';
import { ACTIVE_OUTBOUND_SQL, inboundTodaySql } from './todaySql';
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
    kind: r.kind != null && String(r.kind) !== '' ? String(r.kind) : undefined,
    priority: String(r.priority ?? 'normal'),
    status: String(r.status ?? ''),
    summary: String(r.summary ?? ''),
    siteName: String(r.siteName ?? ''),
    startDt: Number(r.startDt ?? 0),
    endDt: r.endDt == null ? undefined : Number(r.endDt),
    assignedEmployeeId: String(r.assignedEmployeeId ?? ''),
  }));
}

/** Cheap identity for “did this inbound row actually change?” — skip kit inspect when equal. */
export function inboundHitFingerprint(hit: InboundHit): string {
  return `${hit.id}\t${hit.status}\t${hit.assignedEmployeeId}\t${hit.summary}\t${hit.startDt}\t${hit.priority}\t${hit.kind ?? ''}`;
}

export function changedInboundIds(prev: InboundHit[], next: InboundHit[]): string[] {
  const prevMap = new Map(prev.map((h) => [h.id, inboundHitFingerprint(h)]));
  const changed: string[] = [];
  const seen = new Set<string>();
  for (const h of next) {
    seen.add(h.id);
    if (prevMap.get(h.id) !== inboundHitFingerprint(h)) changed.push(h.id);
  }
  for (const id of prevMap.keys()) {
    if (!seen.has(id)) changed.push(id);
  }
  return changed;
}

export function parseOutboundHits(rows: Record<string, unknown>[]): OutboundHit[] {
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    sourceId: String(r.sourceId ?? ''),
    number: String(r.number ?? ''),
    kind: r.kind != null && String(r.kind) !== '' ? String(r.kind) : undefined,
    priority: String(r.priority ?? 'normal'),
    status: String(r.status ?? ''),
    summary: String(r.summary ?? ''),
    siteName: String(r.siteName ?? ''),
    startDt: Number(r.startDt ?? 0),
    endDt: r.endDt == null ? undefined : Number(r.endDt),
    role: String(r.role ?? 'primary'),
    assignedEmployeeId: String(r.assignedEmployeeId ?? ''),
    dropped: r.dropped === true,
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
    const inbound = [
      ...seedInboundAsHits(input.employeeId, day),
      ...memoryInboundHits(input.employeeId, day),
    ];
    const sliced = inbound.slice(offset, offset + limit);
    const memoryOut = includeActiveOutbound ? memoryActiveOutbound(input.employeeId) : [];
    const seedOut = includeActiveOutbound
      ? seedActiveOutboundAsHits(input.employeeId).filter(
          (row) => !memoryOut.some((m) => m.sourceId === row.sourceId || m.id === row.id),
        )
      : [];
    const activeOutbound = [...seedOut, ...memoryOut];
    const outboundBySource = memoryOutboundRefs(
      input.employeeId,
      sourceIdsNeedingOutboundLookup(
        sliced.map((h) => h.id),
        activeOutbound,
      ),
    );
    return {
      preview: true,
      inboundCount: sliced.length,
      rows: collapseTodayPage({
        employeeId: input.employeeId,
        inbound: sliced,
        activeOutbound,
        outboundBySource,
        skipSourceIds: input.skipSourceIds,
        includeActiveOutbound,
      }),
    };
  }

  const db = getOpenedDatabase();
  if (!db) return { preview: false, rows: [], inboundCount: 0 };

  const inboundRows = await timeQuery('today', () =>
    runQuery(db, inboundTodaySql(limit, offset), {
      employeeId: input.employeeId,
      day,
    }),
  );
  const inbound = parseInboundHits(inboundRows);

  let activeOutbound: OutboundHit[] = [];
  if (includeActiveOutbound) {
    const outRows = await runQuery(db, ACTIVE_OUTBOUND_SQL, { employeeId: input.employeeId });
    activeOutbound = parseOutboundHits(outRows);
  }

  const outboundBySource = await findOutboundForSources(
    input.employeeId,
    sourceIdsNeedingOutboundLookup(
      inbound.map((h) => h.id),
      activeOutbound,
    ),
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

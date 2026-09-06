import { nowSec } from '../audit';
import { SEED_EMPLOYEE_ID, SEED_REASSIGN_WOIN_ID, SEED_REASSIGN_WOOUT_ID, seedInboundJobs } from '../db/seedData';
import { appVersion } from '../version';
import type { InboundHit, OutboundHit } from './todayTypes';

function jobToInboundHit(
  id: string,
  doc: {
    number: string;
    kind?: string;
    priority: string;
    status: string;
    summary: string;
    assignedTo: { employeeId: string };
    site: { name: string };
    scheduled: { startDt: number; endDt: number };
  },
): InboundHit {
  return {
    id,
    number: doc.number,
    kind: doc.kind,
    priority: doc.priority,
    status: doc.status,
    summary: doc.summary,
    siteName: doc.site.name,
    startDt: doc.scheduled.startDt,
    endDt: doc.scheduled.endDt,
    assignedEmployeeId: doc.assignedTo.employeeId,
  };
}

/** Expo Go / no native: same seed jobs the DB would write. */
export function seedInboundAsHits(employeeId: string, day: string): InboundHit[] {
  return seedInboundJobs(appVersion(), nowSec(), day)
    .filter((row) => (row.doc as { assignedTo: { employeeId: string } }).assignedTo.employeeId === employeeId)
    .map(({ id, doc }) =>
      jobToInboundHit(
        id,
        doc as {
          number: string;
          kind?: string;
          priority: string;
          status: string;
          summary: string;
          assignedTo: { employeeId: string };
          site: { name: string };
          scheduled: { startDt: number; endDt: number };
        },
      ),
    );
}

/** Jon's leftover outbound for WO-10460 (inbound assigned elsewhere). */
export function seedActiveOutboundAsHits(employeeId: string): OutboundHit[] {
  if (employeeId !== SEED_EMPLOYEE_ID) return [];
  const inbound = seedInboundJobs(appVersion(), nowSec()).find((row) => row.id === SEED_REASSIGN_WOIN_ID);
  if (!inbound) return [];
  const doc = inbound.doc as {
    number: string;
    kind?: string;
    priority: string;
    summary: string;
    site: { name: string };
    scheduled: { startDt: number; endDt?: number };
  };
  return [
    {
      id: SEED_REASSIGN_WOOUT_ID,
      sourceId: SEED_REASSIGN_WOIN_ID,
      number: doc.number,
      kind: doc.kind,
      priority: doc.priority,
      status: 'in_progress',
      summary: doc.summary,
      siteName: doc.site.name,
      startDt: Number(doc.scheduled.startDt ?? 0),
      endDt: doc.scheduled.endDt != null ? Number(doc.scheduled.endDt) : undefined,
      role: 'primary',
      assignedEmployeeId: SEED_EMPLOYEE_ID,
    },
  ];
}

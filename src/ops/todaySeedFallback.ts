import { nowSec } from '../audit';
import { seedInboundJobs, SEED_EMPLOYEE_ID } from '../db/seedData';
import { appVersion } from '../version';
import type { InboundHit } from './todayTypes';

/** Expo Go / no native: same seed jobs the DB would write. */
export function seedInboundAsHits(employeeId: string, day: string): InboundHit[] {
  if (employeeId !== SEED_EMPLOYEE_ID) return [];
  return seedInboundJobs(appVersion(), nowSec(), day).map(({ id, doc }) => {
    const d = doc as {
      number: string;
      priority: string;
      status: string;
      summary: string;
      assignedTo: { employeeId: string };
      site: { name: string };
      scheduled: { startDt: number; endDt: number };
    };
    return {
      id,
      number: d.number,
      priority: d.priority,
      status: d.status,
      summary: d.summary,
      siteName: d.site.name,
      startDt: d.scheduled.startDt,
      endDt: d.scheduled.endDt,
      assignedEmployeeId: d.assignedTo.employeeId,
    };
  });
}

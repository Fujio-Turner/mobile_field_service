import { nowSec } from '../audit';
import { collectionOf, getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { seedInboundJobs } from '../db/seedData';
import { appVersion } from '../version';
import { getWorkOrderInFromCollection, parseWorkOrderIn, type WorkOrderIn } from './workOrderIn';

export function getWorkOrderInFromSeed(id: string): WorkOrderIn | null {
  const jobs = seedInboundJobs(appVersion(), nowSec());
  const hit = jobs.find((j) => j.id === id);
  if (!hit) return null;
  return parseWorkOrderIn(id, hit.doc as unknown as Record<string, unknown>);
}

export async function getWorkOrderIn(id: string): Promise<WorkOrderIn | null> {
  if (!nativeDbAvailable() || !getOpenedDatabase()) {
    return getWorkOrderInFromSeed(id);
  }
  const col = (await collectionOf('workordersin')) as {
    document: (docId: string) => Promise<unknown>;
  } | null;
  if (!col) return null;
  return getWorkOrderInFromCollection(col, id);
}

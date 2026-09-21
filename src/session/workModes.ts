import {
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_EMPLOYEE_ID,
  SEED_MAYA_EMPLOYEE_ID,
  SEED_PRIYA_EMPLOYEE_ID,
} from '../db/seedData';

export const WORK_MODES = ['assets', 'customer', 'sales'] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export type SearchKind = 'note' | 'product' | 'asset' | 'customer';

export function parseWorkModes(raw: unknown): WorkMode[] {
  if (!Array.isArray(raw)) return ['assets'];
  const next = raw.filter((m): m is WorkMode => m === 'assets' || m === 'customer' || m === 'sales');
  return next.length > 0 ? [...new Set(next)] : ['assets'];
}

/** Prefer `users.workModes[]` on the session; seed employeeId is only a fallback. */
export function workModesFromSession(session: { workModes?: unknown; employeeId?: string } | null | undefined): WorkMode[] {
  if (session && session.workModes != null) return parseWorkModes(session.workModes);
  return workModesForEmployee(session?.employeeId);
}

export function showsTodayJobs(modes: WorkMode[]): boolean {
  return modes.includes('assets') || modes.includes('customer');
}

export function showsTodayOrders(modes: WorkMode[]): boolean {
  return modes.includes('customer') || modes.includes('sales');
}

/** Walk-up labor ticket (`CreateWorkOrderIn`). Sales uses customer + order instead. */
export function showsWalkUpJob(modes: WorkMode[]): boolean {
  return modes.includes('assets') || modes.includes('customer');
}

/** Map is shown in every mode; contents change with `searchKinds` / map layers. */
export function showsMapTab(_modes: WorkMode[]): boolean {
  return true;
}

export function searchKinds(modes: WorkMode[], opts?: { kitJob?: boolean }): SearchKind[] {
  const kinds: SearchKind[] = ['note'];
  if (modes.includes('assets')) kinds.push('asset');
  if (modes.includes('sales') || modes.includes('customer')) {
    kinds.push('product', 'customer');
  }
  if (modes.includes('customer') && opts?.kitJob && !kinds.includes('asset')) {
    kinds.push('asset');
  }
  return kinds;
}

export function mapPlotsCustomers(modes: WorkMode[]): boolean {
  return modes.includes('sales') || modes.includes('customer');
}

export function mapPlotsAssets(modes: WorkMode[], opts?: { kitFilter?: boolean }): boolean {
  if (modes.includes('assets')) return true;
  if (modes.includes('customer') && opts?.kitFilter) return true;
  return false;
}

export function workModesForEmployee(employeeId: string | undefined): WorkMode[] {
  if (employeeId === SEED_MAYA_EMPLOYEE_ID) return ['customer'];
  if (employeeId === SEED_PRIYA_EMPLOYEE_ID) return ['sales'];
  if (employeeId === SEED_EMPLOYEE_ID || employeeId === SEED_DISPATCH_EMPLOYEE_ID) return ['assets'];
  return ['assets'];
}
